/**
 * Loads the twin from the North Valley Corrections Twin semantic model.
 *
 * Results arrive as row-major arrays, so every projection is resolved by column
 * name rather than by positional index — a reordered `SUMMARIZECOLUMNS` then
 * fails loudly here instead of silently mis-assigning values.
 */

import type { QueryTable } from '@microsoft/fabric-app-data';

import { BUILDING_HOTSPOTS, EMPTY_HOTSPOT } from '@/data/geometry';
import type {
  Building,
  BuildingReading,
  BuildingType,
  OperationalStatus,
  TwinData,
  TwinMonth,
} from '@/data/twin';
import { TWIN_CONNECTION } from '@/fabric.generated';
import { getFabricClient } from '@/lib/fabric-client';
import {
  BUILDING_HISTORY_QUERY,
  BUILDING_INVENTORY_QUERY,
  FACILITY_HISTORY_QUERY,
} from '@/queries/twin';

class TwinQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwinQueryError';
  }
}

/** Resolve column indexes by name so row order cannot drift unnoticed. */
function indexer(table: QueryTable, label: string) {
  const lookup = new Map(table.columns.map((c, i) => [c.name, i]));
  return (name: string): number => {
    const index = lookup.get(name);
    if (index === undefined) {
      throw new TwinQueryError(
        `${label}: the semantic model did not return column "${name}". Got: ${table.columns
          .map((c) => c.name)
          .join(', ')}`
      );
    }
    return index;
  };
}

const num = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const str = (value: unknown): string => (value == null ? '' : String(value));

const bool = (value: unknown): boolean =>
  value === true || String(value).toLowerCase() === 'true';

async function runQuery(query: string, label: string): Promise<QueryTable> {
  const result = await getFabricClient()
    .semanticModel(TWIN_CONNECTION)
    .query(query);

  if (result.status === 'error') {
    throw new TwinQueryError(`${label}: ${result.error.message}`);
  }
  return result.table;
}

function mapBuildings(table: QueryTable): Building[] {
  const at = indexer(table, 'Building inventory');
  const id = at('Building[Building ID]');
  const name = at('Building[Building]');
  const short = at('Building[Short Name]');
  const type = at('Building[Building Type]');
  const status = at('Building[Operational Status]');
  const residential = at('Building[Is Residential]');
  const note = at('Building[Operational Note]');
  const capacity = at('[Capacity]');
  const inmates = at('[Inmates]');
  const officers = at('[Officers]');
  const incidents = at('[Incidents]');

  return table.rows.map((row) => {
    const buildingId = str(row[id]);
    return {
      id: buildingId,
      name: str(row[name]),
      shortName: str(row[short]),
      type: str(row[type]) as BuildingType,
      capacity: num(row[capacity]),
      inmates: num(row[inmates]),
      officers: num(row[officers]),
      incidents: num(row[incidents]),
      status: str(row[status]) as OperationalStatus,
      residential: bool(row[residential]),
      hotspot: BUILDING_HOTSPOTS[buildingId] ?? EMPTY_HOTSPOT,
      note: str(row[note]),
    };
  });
}

function mapReadings(table: QueryTable): BuildingReading[] {
  const at = indexer(table, 'Building history');
  const id = at('Building[Building ID]');
  const month = at('Month[Month Key]');
  const inmates = at('[Inmates]');
  const officers = at('[Officers]');
  const incidents = at('[Incidents]');

  return table.rows.map((row) => ({
    buildingId: str(row[id]),
    monthKey: num(row[month]),
    inmates: num(row[inmates]),
    officers: num(row[officers]),
    incidents: num(row[incidents]),
  }));
}

interface FacilityHistory {
  months: TwinMonth[];
  populationTrend: number[];
  incidentTrend: number[];
  staffingTrend: number[];
  designCapacity: number;
}

function mapFacility(table: QueryTable): FacilityHistory {
  const at = indexer(table, 'Facility history');
  const key = at('Month[Month Key]');
  const name = at('Month[Month]');
  const abbr = at('Month[Month Abbreviation]');
  const population = at('[Population]');
  const officers = at('[Officers]');
  const incidents = at('[Incidents]');
  const capacity = at('[DesignCapacity]');

  const rows = [...table.rows].sort((a, b) => num(a[key]) - num(b[key]));

  return {
    months: rows.map((row) => ({
      key: num(row[key]),
      name: str(row[name]),
      abbr: str(row[abbr]),
    })),
    populationTrend: rows.map((row) => num(row[population])),
    incidentTrend: rows.map((row) => num(row[incidents])),
    staffingTrend: rows.map((row) => num(row[officers])),
    designCapacity: rows.length ? num(rows[rows.length - 1][capacity]) : 0,
  };
}

/** Fetch the full twin. The three queries are independent, so they run together. */
export async function loadTwin(): Promise<TwinData> {
  const [inventory, history, facility] = await Promise.all([
    runQuery(BUILDING_INVENTORY_QUERY, 'Building inventory'),
    runQuery(BUILDING_HISTORY_QUERY, 'Building history'),
    runQuery(FACILITY_HISTORY_QUERY, 'Facility history'),
  ]);

  return mapTwin(inventory, history, facility);
}

/**
 * Assemble {@link TwinData} from the three query results.
 *
 * Exported separately from {@link loadTwin} so the mapping can be tested
 * against representative result tables without a Fabric host.
 */
export function mapTwin(
  inventory: QueryTable,
  history: QueryTable,
  facility: QueryTable
): TwinData {
  const mapped = mapFacility(facility);
  const last = mapped.populationTrend.length - 1;

  const data: TwinData = {
    buildings: mapBuildings(inventory),
    readings: mapReadings(history),
    months: mapped.months,
    populationTrend: mapped.populationTrend,
    incidentTrend: mapped.incidentTrend,
    staffingTrend: mapped.staffingTrend,
    designCapacity: mapped.designCapacity,
    totalInmates: last >= 0 ? mapped.populationTrend[last] : 0,
    totalOfficers: last >= 0 ? mapped.staffingTrend[last] : 0,
  };

  if (data.buildings.length === 0 || data.months.length === 0) {
    throw new TwinQueryError(
      'The semantic model returned no buildings or no reporting periods.'
    );
  }

  return data;
}

export { TwinQueryError };
