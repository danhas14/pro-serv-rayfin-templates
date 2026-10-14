/**
 * Generate the `semantic-model/` TMDL folder for the corrections digital twin.
 *
 * The model's tables are inline M literals (no upstream data source), so the
 * definition is generated from `src/lib/twin-fixture.ts` — the same snapshot the
 * app falls back to in local development. Generating both from one source means
 * the deployed model and the dev snapshot cannot drift apart.
 *
 * Usage:  npx tsx scripts/generate-semantic-model.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEV_TWIN } from '../src/lib/twin-fixture';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'semantic-model');

const T = '\t';
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const lit = (v: string | number | boolean) =>
  typeof v === 'string' ? q(v) : typeof v === 'boolean' ? String(v) : String(v);

/** Indent every non-empty line of a block by `depth` tabs. */
const indent = (text: string, depth: number) =>
  text
    .split('\n')
    .map((l) => (l.length ? T.repeat(depth) + l : l))
    .join('\n');

/** Quote a TMDL identifier only when it is not a bare word. */
const esc = (name: string) =>
  /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name}'`;

/** Build an inline `#table(...)` M expression. */
function mTable(
  cols: { name: string; type: string }[],
  rows: (string | number | boolean)[][]
): string {
  const header = cols.map((c) => `#"${c.name}" = ${c.type}`).join(', ');
  const body = rows
    .map((r) => `${T.repeat(2)}{${r.map(lit).join(', ')}}`)
    .join(',\n');
  return [
    'let',
    `${T}Source = #table(`,
    `${T.repeat(2)}type table [${header}],`,
    `${T.repeat(2)}{`,
    body,
    `${T.repeat(2)}}`,
    `${T})`,
    'in',
    `${T}Source`,
  ].join('\n');
}

interface Col {
  name: string;
  dataType: 'string' | 'int64' | 'boolean' | 'dateTime';
  hidden?: boolean;
  summarizeBy?: 'none' | 'sum';
  sortBy?: string;
  formatString?: string;
  description?: string;
}

interface Measure {
  name: string;
  expression: string;
  formatString: string;
  displayFolder: string;
  description: string;
}

function renderColumn(c: Col): string {
  const out: string[] = [];
  if (c.description) out.push(`/// ${c.description}`);
  out.push(`column ${esc(c.name)}`);
  out.push(`${T}dataType: ${c.dataType}`);
  if (c.hidden) out.push(`${T}isHidden`);
  if (c.formatString) out.push(`${T}formatString: ${c.formatString}`);
  out.push(`${T}summarizeBy: ${c.summarizeBy ?? 'none'}`);
  out.push(`${T}sourceColumn: ${c.name}`);
  if (c.sortBy) out.push(`${T}sortByColumn: ${esc(c.sortBy)}`);
  return out.join('\n');
}

function renderMeasure(m: Measure): string {
  const out: string[] = [];
  out.push(`/// ${m.description}`);
  const lines = m.expression.trim().split('\n');
  if (lines.length === 1) {
    out.push(`measure ${esc(m.name)} = ${lines[0]}`);
  } else {
    out.push(`measure ${esc(m.name)} =`);
    out.push(indent(lines.join('\n'), 2));
  }
  out.push(`${T}formatString: ${m.formatString}`);
  out.push(`${T}displayFolder: ${m.displayFolder}`);
  return out.join('\n');
}

function renderTable(
  name: string,
  description: string,
  cols: Col[],
  measures: Measure[],
  mExpression: string
): string {
  const parts: string[] = [];
  parts.push(`/// ${description}`);
  parts.push(`table ${esc(name)}`);
  parts.push('');
  for (const c of cols) {
    parts.push(indent(renderColumn(c), 1));
    parts.push('');
  }
  for (const m of measures) {
    parts.push(indent(renderMeasure(m), 1));
    parts.push('');
  }
  parts.push(`${T}partition ${esc(name)} = m`);
  parts.push(`${T.repeat(2)}mode: import`);
  parts.push(`${T.repeat(2)}source =`);
  parts.push(indent(mExpression, 4));
  parts.push('');
  return parts.join('\n');
}

/* ------------------------------------------------------------------ */
/* Partitions, generated from the shared fixture                       */
/* ------------------------------------------------------------------ */

const b = DEV_TWIN.buildings;
const months = DEV_TWIN.months;
const readings = DEV_TWIN.readings;

const buildingM = mTable(
  [
    { name: 'Building ID', type: 'text' },
    { name: 'Building', type: 'text' },
    { name: 'Short Name', type: 'text' },
    { name: 'Building Type', type: 'text' },
    { name: 'Capacity', type: 'Int64.Type' },
    { name: 'Operational Status', type: 'text' },
    { name: 'Is Residential', type: 'logical' },
    { name: 'Operational Note', type: 'text' },
  ],
  b.map((x) => [
    x.id,
    x.name,
    x.shortName,
    x.type,
    x.capacity,
    x.status,
    x.residential,
    x.note,
  ])
);

const monthM = mTable(
  [
    { name: 'Month Key', type: 'Int64.Type' },
    { name: 'Month', type: 'text' },
    { name: 'Month Abbreviation', type: 'text' },
    { name: 'Month Start Date', type: 'text' },
  ],
  months.map((m) => [
    m.key,
    m.name,
    m.abbr,
    `2026-${String(m.key).padStart(2, '0')}-01`,
  ])
).replace(
  'in\n\tSource',
  'in\n\tTable.TransformColumnTypes(Source, {{"Month Start Date", type date}})'
);

const buildingMetricsM = mTable(
  [
    { name: 'Building ID', type: 'text' },
    { name: 'Month Key', type: 'Int64.Type' },
    { name: 'Inmate Count', type: 'Int64.Type' },
    { name: 'Officer Count', type: 'Int64.Type' },
    { name: 'Incident Count', type: 'Int64.Type' },
  ],
  readings.map((r) => [
    r.buildingId,
    r.monthKey,
    r.inmates,
    r.officers,
    r.incidents,
  ])
);

const facilityMetricsM = mTable(
  [
    { name: 'Month Key', type: 'Int64.Type' },
    { name: 'Population Count', type: 'Int64.Type' },
    { name: 'Officer Count', type: 'Int64.Type' },
    { name: 'Incident Count', type: 'Int64.Type' },
    { name: 'Design Capacity Count', type: 'Int64.Type' },
  ],
  months.map((m, i) => [
    m.key,
    DEV_TWIN.populationTrend[i],
    DEV_TWIN.staffingTrend[i],
    DEV_TWIN.incidentTrend[i],
    DEV_TWIN.designCapacity,
  ])
);

/**
 * Semi-additive pattern: a stock (population, officer strength) resolves to the
 * latest month in filter context rather than summing across periods.
 */
const latest = (table: string, column: string) => `
VAR LastMonth = MAX ( 'Month'[Month Key] )
RETURN
    CALCULATE (
        SUM ( '${table}'[${column}] ),
        REMOVEFILTERS ( 'Month' ),
        'Month'[Month Key] = LastMonth
    )`;

const TABLES: Record<string, string> = {
  Building: renderTable(
    'Building',
    'One row per physical structure modelled in the digital twin, including its rated capacity and current operational status.',
    [
      { name: 'Building ID', dataType: 'string', hidden: true, description: 'Stable slug identifier used to join building metrics and to key the map overlay.' },
      { name: 'Building', dataType: 'string', description: 'Full name of the structure as used in operational reporting.' },
      { name: 'Short Name', dataType: 'string', description: 'Abbreviated label used on the facility map and in narrow table columns.' },
      { name: 'Building Type', dataType: 'string', description: 'Functional classification, for example Medium Security Housing or Healthcare. Determines the supervision ratio target.' },
      { name: 'Capacity', dataType: 'int64', hidden: true, summarizeBy: 'sum', description: 'Rated bed capacity. Hidden in favour of the Rated Capacity measure.' },
      { name: 'Operational Status', dataType: 'string', description: 'Current status: Normal, Elevated Risk, Over Capacity or Critical.' },
      { name: 'Is Residential', dataType: 'boolean', hidden: true, description: 'True when the building holds assigned beds. Non-residential buildings report inmates present rather than housed.' },
      { name: 'Operational Note', dataType: 'string', description: 'Operator-facing commentary shown in the building detail panel.' },
    ],
    [
      { name: 'Rated Capacity', expression: "SUM ( 'Building'[Capacity] )", formatString: '#,0', displayFolder: 'Capacity', description: 'Total rated bed capacity of the buildings in scope.' },
      { name: 'Occupancy Rate', expression: 'DIVIDE ( [Inmates], [Rated Capacity] )', formatString: '0.0%', displayFolder: 'Capacity', description: 'Inmates as a share of rated bed capacity. Above 100% means the unit holds more inmates than it is rated for.' },
      { name: 'Beds Available', expression: '[Rated Capacity] - [Inmates]', formatString: '#,0', displayFolder: 'Capacity', description: 'Unused rated beds. Negative when a unit is over its rating.' },
      { name: '# Buildings', expression: "COUNTROWS ( 'Building' )", formatString: '#,0', displayFolder: 'Counts', description: 'Number of buildings in scope.' },
      { name: '# Overcrowded Buildings', expression: "COUNTROWS (\n    FILTER (\n        VALUES ( 'Building'[Building ID] ),\n        [Inmates] > [Rated Capacity]\n    )\n)", formatString: '#,0', displayFolder: 'Counts', description: 'Buildings holding more inmates than their rated capacity at the latest month in context.' },
    ],
    buildingM
  ),

  Month: renderTable(
    'Month',
    'Reporting-period calendar at monthly grain covering the trailing reporting periods.',
    [
      { name: 'Month Key', dataType: 'int64', hidden: true, description: 'Sequential reporting-period number. Sorts the month name chronologically.' },
      { name: 'Month', dataType: 'string', sortBy: 'Month Key', description: 'Full month name of the reporting period.' },
      { name: 'Month Abbreviation', dataType: 'string', sortBy: 'Month Key', description: 'Three-letter month abbreviation used as the x-axis label on trend charts.' },
      { name: 'Month Start Date', dataType: 'dateTime', formatString: 'yyyy-mm-dd', description: 'First day of the reporting period.' },
    ],
    [],
    monthM
  ),

  'Building Metrics': renderTable(
    'Building Metrics',
    'Monthly operational readings per building. Population and officer counts are point-in-time stocks at month end; incidents are a flow accumulated over the month.',
    [
      { name: 'Building ID', dataType: 'string', hidden: true, description: 'Foreign key to the Building dimension.' },
      { name: 'Month Key', dataType: 'int64', hidden: true, description: 'Foreign key to the Month dimension.' },
      { name: 'Inmate Count', dataType: 'int64', hidden: true, summarizeBy: 'sum', description: 'Inmates recorded at this building at month end. Hidden in favour of the Inmates measure.' },
      { name: 'Officer Count', dataType: 'int64', hidden: true, summarizeBy: 'sum', description: 'Officers posted to this building at month end. Hidden in favour of the Officers measure.' },
      { name: 'Incident Count', dataType: 'int64', hidden: true, summarizeBy: 'sum', description: 'Reportable incidents recorded at this building during the month.' },
    ],
    [
      { name: 'Inmates', expression: latest('Building Metrics', 'Inmate Count'), formatString: '#,0', displayFolder: 'Population', description: 'Inmates held across the buildings in scope, taken at the latest month in context. Population is a point-in-time stock, so it is never summed across months.' },
      { name: 'Officers', expression: latest('Building Metrics', 'Officer Count'), formatString: '#,0', displayFolder: 'Staffing', description: 'Correctional officers posted to the buildings in scope at the latest month in context. Officer strength is a stock, so it is never summed across months.' },
      { name: 'Incidents', expression: "SUM ( 'Building Metrics'[Incident Count] )", formatString: '#,0', displayFolder: 'Incidents', description: 'Reportable incidents accumulated over every month in context. Use Monthly Incidents for a single-period figure.' },
      { name: 'Monthly Incidents', expression: latest('Building Metrics', 'Incident Count'), formatString: '#,0', displayFolder: 'Incidents', description: 'Reportable incidents recorded during the latest month in context, used for the current-period incident KPI.' },
      { name: 'Inmates per Officer', expression: 'DIVIDE ( [Inmates], [Officers] )', formatString: '0.00', displayFolder: 'Staffing', description: 'Inmates supervised per posted officer. Lower is better; each building type carries its own target.' },
      { name: 'Incidents per 100 Inmates', expression: 'DIVIDE ( [Monthly Incidents] * 100, [Inmates] )', formatString: '0.0', displayFolder: 'Incidents', description: 'Incidents in the latest month per 100 inmates, which normalises incident volume for population size.' },
    ],
    buildingMetricsM
  ),

  'Facility Metrics': renderTable(
    'Facility Metrics',
    'Facility-wide monthly roll-up from the corrections management system. These totals span the entire complex and are therefore larger than the sum of the individually modelled buildings.',
    [
      { name: 'Month Key', dataType: 'int64', hidden: true, description: 'Foreign key to the Month dimension.' },
      { name: 'Population Count', dataType: 'int64', hidden: true, summarizeBy: 'sum', description: 'Facility-wide inmate population at month end, covering the whole complex.' },
      { name: 'Officer Count', dataType: 'int64', hidden: true, summarizeBy: 'sum', description: 'Facility-wide officer strength at month end, including relief and perimeter posts.' },
      { name: 'Incident Count', dataType: 'int64', hidden: true, summarizeBy: 'sum', description: 'Facility-wide reportable incidents recorded during the month.' },
      { name: 'Design Capacity Count', dataType: 'int64', hidden: true, summarizeBy: 'sum', description: 'Rated design capacity of the complex, the denominator for the facility occupancy rate.' },
    ],
    [
      { name: 'Facility Population', expression: latest('Facility Metrics', 'Population Count'), formatString: '#,0', displayFolder: 'Facility', description: 'Facility-wide inmate population at the latest month in context. Spans the entire complex, so it exceeds the sum of the individually modelled buildings.' },
      { name: 'Facility Officers', expression: latest('Facility Metrics', 'Officer Count'), formatString: '#,0', displayFolder: 'Facility', description: 'Facility-wide officer strength at the latest month in context, including relief and perimeter posts.' },
      { name: 'Facility Incidents', expression: latest('Facility Metrics', 'Incident Count'), formatString: '#,0', displayFolder: 'Facility', description: 'Facility-wide reportable incidents recorded during the latest month in context.' },
      { name: 'Facility Design Capacity', expression: latest('Facility Metrics', 'Design Capacity Count'), formatString: '#,0', displayFolder: 'Facility', description: 'Rated design capacity of the complex at the latest month in context.' },
      { name: 'Facility Occupancy Rate', expression: 'DIVIDE ( [Facility Population], [Facility Design Capacity] )', formatString: '0.0%', displayFolder: 'Facility', description: 'Facility-wide population as a share of rated design capacity. The headline occupancy rate reported to district command.' },
      { name: 'Facility Inmates per Officer', expression: 'DIVIDE ( [Facility Population], [Facility Officers] )', formatString: '0.00', displayFolder: 'Facility', description: 'Facility-wide supervision load: inmates per correctional officer across the whole complex.' },
    ],
    facilityMetricsM
  ),
};

/* ------------------------------------------------------------------ */
/* Emit                                                                */
/* ------------------------------------------------------------------ */

mkdirSync(join(OUT, 'definition', 'tables'), { recursive: true });

writeFileSync(
  join(OUT, '.platform'),
  JSON.stringify(
    {
      $schema:
        'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json',
      metadata: {
        type: 'SemanticModel',
        displayName: 'North Valley Corrections Twin',
      },
      config: {
        version: '2.0',
        logicalId: '7b1f4d62-5a90-4c3e-8d17-2e6b9f0a4c58',
      },
    },
    null,
    2
  ) + '\n'
);

writeFileSync(
  join(OUT, 'definition.pbism'),
  JSON.stringify(
    {
      $schema:
        'https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json',
      version: '4.2',
      settings: {},
    },
    null,
    2
  ) + '\n'
);

writeFileSync(
  join(OUT, 'definition', 'database.tmdl'),
  'database\n\tcompatibilityLevel: 1601\n'
);

writeFileSync(
  join(OUT, 'definition', 'model.tmdl'),
  [
    'model Model',
    `${T}culture: en-US`,
    `${T}defaultPowerBIDataSourceVersion: powerBI_V3`,
    `${T}discourageImplicitMeasures`,
    `${T}sourceQueryCulture: en-US`,
    `${T}dataAccessOptions`,
    `${T.repeat(2)}legacyRedirects`,
    `${T.repeat(2)}returnErrorValuesAsNull`,
    '',
    ...Object.keys(TABLES).map((t) => `ref table ${esc(t)}`),
    '',
  ].join('\n')
);

writeFileSync(
  join(OUT, 'definition', 'relationships.tmdl'),
  [
    'relationship building_metrics_to_building',
    `${T}fromColumn: 'Building Metrics'.'Building ID'`,
    `${T}toColumn: Building.'Building ID'`,
    '',
    'relationship building_metrics_to_month',
    `${T}fromColumn: 'Building Metrics'.'Month Key'`,
    `${T}toColumn: 'Month'.'Month Key'`,
    '',
    'relationship facility_metrics_to_month',
    `${T}fromColumn: 'Facility Metrics'.'Month Key'`,
    `${T}toColumn: 'Month'.'Month Key'`,
    '',
  ].join('\n')
);

for (const [name, body] of Object.entries(TABLES)) {
  writeFileSync(join(OUT, 'definition', 'tables', `${name}.tmdl`), body);
}

console.log(
  `wrote semantic-model/: ${Object.keys(TABLES).length} tables, ` +
    `${b.length} buildings, ${months.length} months, ${readings.length} readings`
);
