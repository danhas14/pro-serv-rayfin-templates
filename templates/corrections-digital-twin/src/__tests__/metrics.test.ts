import { describe, expect, it } from 'vitest';

import { DEV_TWIN } from '@/lib/twin-fixture';
import { buildTwin, linearFit, project, type MapView } from '@/lib/metrics';

const twin = buildTwin(DEV_TWIN);

describe('linearFit / project', () => {
  it('recovers the slope of a perfectly linear series', () => {
    const { slope, intercept } = linearFit([10, 20, 30, 40]);
    expect(slope).toBeCloseTo(10);
    expect(intercept).toBeCloseTo(10);
  });

  it('projects forward from the end of the series', () => {
    expect(project([10, 20, 30, 40], 2)).toBeCloseTo(60);
  });
});

describe('facility roll-ups', () => {
  it('reports the incident total as the sum of every building', () => {
    const summed = twin.data.buildings.reduce((t, b) => t + b.incidents, 0);
    expect(twin.summary.totalIncidents).toBe(summed);
    expect(twin.summary.totalIncidents).toBe(121);
  });

  it('splits officer strength into posted and relief without losing any', () => {
    expect(twin.summary.postedOfficers + twin.summary.reliefOfficers).toBe(
      twin.summary.totalOfficers
    );
    expect(twin.summary.reliefOfficers).toBeGreaterThanOrEqual(0);
  });

  it('derives the occupancy rate from rated design capacity', () => {
    expect(Math.round(twin.summary.occupancyRate * 100)).toBe(93);
  });

  it('flags exactly the two over-capacity buildings', () => {
    expect(twin.summary.overcrowded.map((m) => m.building.id).sort()).toEqual([
      'housing-b',
      'housing-d',
    ]);
  });
});

describe('building metrics', () => {
  it('computes occupancy from inmates against rated capacity', () => {
    expect(Math.round((twin.metricsFor('housing-b')?.occupancy ?? 0) * 100)).toBe(
      108
    );
    expect(Math.round((twin.metricsFor('housing-d')?.occupancy ?? 0) * 100)).toBe(
      103
    );
  });

  it('ends every monthly series on the current reported value', () => {
    for (const metrics of twin.buildingMetrics) {
      const last = metrics.inmateSeries.length - 1;
      expect(metrics.inmateSeries[last]).toBe(metrics.building.inmates);
      expect(metrics.incidentSeries[last]).toBe(metrics.building.incidents);
      expect(metrics.officerSeries[last]).toBe(metrics.building.officers);
    }
  });

  it('builds one series entry per reporting period', () => {
    for (const metrics of twin.buildingMetrics) {
      expect(metrics.inmateSeries).toHaveLength(twin.monthCount);
      expect(metrics.incidentSeries).toHaveLength(twin.monthCount);
      expect(metrics.officerSeries).toHaveLength(twin.monthCount);
    }
  });

  it('marks a unit understaffed only when it exceeds its type target', () => {
    expect(twin.metricsFor('housing-d')?.understaffed).toBe(true);
    expect(twin.metricsFor('housing-c')?.understaffed).toBe(false);
  });

  it('treats the administration building as having no supervision ratio', () => {
    const admin = twin.metricsFor('administration');
    expect(admin?.supervisionRatio).toBeNull();
    expect(admin?.understaffed).toBe(false);
  });
});

describe('heat values', () => {
  it('stays within 0 and 1 for every building and view', () => {
    const views: MapView[] = ['status', 'population', 'incidents', 'coverage'];
    for (const view of views) {
      for (const metrics of twin.buildingMetrics) {
        const value = twin.heatValue(metrics, view);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('puts the busiest unit at the top of the population ramp', () => {
    expect(twin.heatValue(twin.metricsFor('housing-b')!, 'population')).toBe(1);
  });
});

describe('facility trends', () => {
  it('surfaces the monthly series the model returned', () => {
    expect(twin.trends.population.values).toEqual(twin.data.populationTrend);
    expect(twin.trends.incidents.values).toEqual(twin.data.incidentTrend);
    expect(twin.trends.staffing.values).toEqual(twin.data.staffingTrend);
    expect(twin.trends.population.values).toHaveLength(twin.monthCount);
  });

  it('projects population past 5,100 and staffing downward', () => {
    expect(twin.trends.population.forecast6).toBeGreaterThan(5100);
    expect(twin.trends.staffing.forecast6).toBeLessThan(
      twin.data.staffingTrend[twin.data.staffingTrend.length - 1]
    );
  });
});

describe('operational risk score', () => {
  it('stays on a 0–100 scale with weights summing to one', () => {
    expect(twin.risk.score).toBeGreaterThanOrEqual(0);
    expect(twin.risk.score).toBeLessThanOrEqual(100);
    const weights = twin.risk.components.reduce((s, c) => s + c.weight, 0);
    expect(weights).toBeCloseTo(1);
  });
});

describe('resilience to sparse model output', () => {
  it('builds without throwing when a building has no readings', () => {
    const sparse = buildTwin({
      ...DEV_TWIN,
      readings: DEV_TWIN.readings.filter((r) => r.buildingId !== 'medical'),
    });
    const medical = sparse.metricsFor('medical');
    expect(medical).toBeDefined();
    expect(medical?.inmateSeries).toEqual(
      new Array(sparse.monthCount).fill(0)
    );
  });

  it('does not divide by zero when the model returns no capacity', () => {
    const zeroed = buildTwin({ ...DEV_TWIN, designCapacity: 0 });
    expect(zeroed.summary.occupancyRate).toBe(0);
    expect(Number.isFinite(zeroed.risk.score)).toBe(true);
  });
});
