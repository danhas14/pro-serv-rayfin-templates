import { describe, expect, it } from 'vitest';

import type { QueryTable } from '@microsoft/fabric-app-data';

import {
  BUILDING_HISTORY_COLUMNS,
  BUILDING_INVENTORY_COLUMNS,
  FACILITY_HISTORY_COLUMNS,
} from '@/queries/twin';
import { TwinQueryError, mapTwin } from '@/lib/twin-loader';

const table = (columns: readonly string[], rows: unknown[][]): QueryTable => ({
  columns: columns.map((name) => ({ name }) as QueryTable['columns'][number]),
  rows,
});

const inventory = () =>
  table(BUILDING_INVENTORY_COLUMNS, [
    [
      'housing-b',
      'Housing Unit B',
      'Unit B',
      'Medium Security Housing',
      'Over Capacity',
      true,
      'Over rating on temporary bunks.',
      500,
      540,
      62,
      22,
    ],
    [
      'education',
      'Education Center',
      'Education',
      'Rehabilitation',
      'Normal',
      'False',
      'Programming space.',
      300,
      238,
      15,
      1,
    ],
  ]);

const history = () =>
  table(BUILDING_HISTORY_COLUMNS, [
    ['housing-b', 1, 459, 63, 14],
    ['housing-b', 2, 540, 62, 22],
    ['education', 1, 207, 15, 1],
    ['education', 2, 238, 15, 1],
  ]);

const facility = () =>
  table(FACILITY_HISTORY_COLUMNS, [
    [1, 'January', 'Jan', 4102, 641, 82, 5175],
    [2, 'February', 'Feb', 4812, 615, 121, 5175],
  ]);

describe('mapTwin', () => {
  it('maps the building dimension and its current readings', () => {
    const data = mapTwin(inventory(), history(), facility());
    const unitB = data.buildings.find((b) => b.id === 'housing-b');

    expect(unitB).toMatchObject({
      name: 'Housing Unit B',
      shortName: 'Unit B',
      type: 'Medium Security Housing',
      capacity: 500,
      inmates: 540,
      officers: 62,
      incidents: 22,
      status: 'Over Capacity',
      residential: true,
    });
  });

  it('joins the traced hotspot geometry onto each building', () => {
    const data = mapTwin(inventory(), history(), facility());
    expect(
      data.buildings.find((b) => b.id === 'housing-b')?.hotspot.length
    ).toBeGreaterThan(2);
  });

  it('reads the DAX boolean string form for non-residential buildings', () => {
    const data = mapTwin(inventory(), history(), facility());
    expect(data.buildings.find((b) => b.id === 'education')?.residential).toBe(
      false
    );
  });

  it('takes the facility totals from the final reporting period', () => {
    const data = mapTwin(inventory(), history(), facility());
    expect(data.totalInmates).toBe(4812);
    expect(data.totalOfficers).toBe(615);
    expect(data.designCapacity).toBe(5175);
    expect(data.populationTrend).toEqual([4102, 4812]);
    expect(data.incidentTrend).toEqual([82, 121]);
    expect(data.staffingTrend).toEqual([641, 615]);
  });

  it('orders the monthly series by month key regardless of row order', () => {
    const shuffled = table(FACILITY_HISTORY_COLUMNS, [
      [2, 'February', 'Feb', 4812, 615, 121, 5175],
      [1, 'January', 'Jan', 4102, 641, 82, 5175],
    ]);
    const data = mapTwin(inventory(), history(), shuffled);
    expect(data.months.map((m) => m.abbr)).toEqual(['Jan', 'Feb']);
    expect(data.populationTrend).toEqual([4102, 4812]);
  });

  it('resolves values by column name, not position', () => {
    // Same data, columns projected in a different order.
    const reordered = table(
      [...FACILITY_HISTORY_COLUMNS].reverse(),
      [
        [5175, 82, 641, 4102, 'Jan', 'January', 1],
        [5175, 121, 615, 4812, 'Feb', 'February', 2],
      ]
    );
    const data = mapTwin(inventory(), history(), reordered);
    expect(data.totalInmates).toBe(4812);
    expect(data.staffingTrend).toEqual([641, 615]);
  });

  it('throws a descriptive error when a projected column is missing', () => {
    const missing = table(
      FACILITY_HISTORY_COLUMNS.filter((c) => c !== '[Population]'),
      [[1, 'January', 'Jan', 641, 82, 5175]]
    );
    expect(() => mapTwin(inventory(), history(), missing)).toThrow(
      /did not return column "\[Population\]"/
    );
  });

  it('rejects an empty model rather than rendering a blank dashboard', () => {
    const empty = table(BUILDING_INVENTORY_COLUMNS, []);
    expect(() => mapTwin(empty, history(), facility())).toThrow(TwinQueryError);
  });
});
