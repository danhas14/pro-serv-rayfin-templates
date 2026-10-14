/**
 * Derived analytics for the digital twin.
 *
 * Base facts — buildings, monthly readings and facility roll-ups — come from
 * the semantic model. This module turns them into the ratios, regressions,
 * forecasts and risk scoring the dashboard and the Operations Assistant render.
 * It is a pure function of {@link TwinData}: no module-level state, so the whole
 * derived layer is rebuilt whenever the model returns new data.
 */

import {
  FACILITY,
  SUPERVISION_RATIO_TARGET,
  type Building,
  type OperationalStatus,
  type TwinData,
} from '@/data/twin';

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export interface Fit {
  slope: number;
  intercept: number;
}

/** Ordinary least squares over an evenly spaced series (x = 0..n-1). */
export function linearFit(values: readonly number[]): Fit {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((acc, v) => acc + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (i - meanX) * (values[i] - meanY);
    sxx += (i - meanX) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return { slope, intercept: meanY - slope * meanX };
}

/** Project a series `monthsAhead` beyond its final observation. */
export function project(values: readonly number[], monthsAhead: number): number {
  const { slope, intercept } = linearFit(values);
  return intercept + slope * (values.length - 1 + monthsAhead);
}

export interface BuildingMetrics {
  building: Building;
  /** Occupancy as a fraction of rated capacity (1.08 = 108%). */
  occupancy: number;
  /** Inmates supervised per assigned officer. */
  supervisionRatio: number | null;
  /** Maximum ratio allowed for this building type, or null if not applicable. */
  ratioTarget: number | null;
  understaffed: boolean;
  /** Officers per 100 inmates. */
  coveragePer100: number | null;
  /** 0 (well covered) → 1 (worst coverage relative to target). */
  coveragePressure: number;
  incidentsPer100: number;
  overCapacity: boolean;
  bedsAvailable: number;
  inmateSeries: number[];
  incidentSeries: number[];
  officerSeries: number[];
  occupancySeries: number[];
  /** Change in monthly incidents per month over the trailing six periods. */
  incidentSlope: number;
  inmateSlope: number;
  /** Projected inmate count six periods out. */
  forecastInmates: number;
  forecastOccupancy: number;
}

export interface TrendSeries {
  label: string;
  values: number[];
  fit: Fit;
  ytdChange: number;
  momChange: number;
  forecast6: number;
}

export interface RiskComponent {
  key: string;
  label: string;
  weight: number;
  pressure: number;
  readout: string;
}

export interface ExecutiveMetric {
  key: string;
  label: string;
  value: number;
  format: 'percent' | 'percent-abs' | 'score';
  direction: 'up' | 'down';
  sentiment: 'good' | 'warn' | 'bad';
  caption: string;
}

export interface FacilitySummary {
  totalInmates: number;
  instrumentedInmates: number;
  totalOfficers: number;
  postedOfficers: number;
  reliefOfficers: number;
  totalIncidents: number;
  occupancyRate: number;
  designCapacity: number;
  overcrowded: BuildingMetrics[];
  understaffed: BuildingMetrics[];
  facilityRatio: number;
  incidentsPer1000: number;
}

export type MapView = 'status' | 'population' | 'incidents' | 'coverage';

/** The full derived model the UI renders. */
export interface Twin {
  data: TwinData;
  months: string[];
  monthAbbr: string[];
  monthCount: number;
  buildingMetrics: BuildingMetrics[];
  metricsById: Map<string, BuildingMetrics>;
  metricsFor: (id: string) => BuildingMetrics | undefined;
  summary: FacilitySummary;
  trends: Record<'population' | 'incidents' | 'staffing', TrendSeries>;
  risk: { score: number; band: string; components: RiskComponent[] };
  executiveMetrics: ExecutiveMetric[];
  reportingPeriod: string;
  heatValue: (metrics: BuildingMetrics, view: MapView) => number;
  heatReadout: (metrics: BuildingMetrics, view: MapView) => string;
}

const STATUS_PRESSURE: Record<OperationalStatus, number> = {
  Normal: 0,
  'Elevated Risk': 0.6,
  'Over Capacity': 0.6,
  Critical: 1,
};

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

export const MAP_VIEWS: {
  id: MapView;
  label: string;
  description: string;
  legend: [string, string];
}[] = [
  {
    id: 'status',
    label: 'Operational Status',
    description: 'Each building shaded by its current operational status.',
    legend: ['Normal', 'Critical'],
  },
  {
    id: 'population',
    label: 'Population Density',
    description: 'Shaded by inmate population relative to the busiest unit.',
    legend: ['Lightly populated', 'Most populated'],
  },
  {
    id: 'incidents',
    label: 'Incident Density',
    description: 'Shaded by incidents recorded this reporting period.',
    legend: ['No incidents', 'Highest volume'],
  },
  {
    id: 'coverage',
    label: 'Staff Coverage',
    description:
      'Shaded by inmates-per-officer against the target ratio for each building type.',
    legend: ['Well covered', 'Thinly covered'],
  },
];

/** Build the full derived model from one semantic-model fetch. */
export function buildTwin(data: TwinData): Twin {
  const monthCount = data.months.length;
  const monthKeys = data.months.map((m) => m.key);

  type Reading = TwinData['readings'][number];

  // Index readings by building so each series is assembled in month order.
  const byBuilding = new Map<string, Map<number, Reading>>();
  for (const reading of data.readings) {
    let slot = byBuilding.get(reading.buildingId);
    if (!slot) {
      slot = new Map<number, Reading>();
      byBuilding.set(reading.buildingId, slot);
    }
    slot.set(reading.monthKey, reading);
  }

  const buildingMetrics = data.buildings.map((building): BuildingMetrics => {
    const readings = byBuilding.get(building.id);
    const seriesFor = (pick: (r: Reading) => number) =>
      monthKeys.map((key) => {
        const reading = readings?.get(key);
        return reading ? pick(reading) : 0;
      });

    const inmateSeries = seriesFor((r) => r.inmates);
    const incidentSeries = seriesFor((r) => r.incidents);
    const officerSeries = seriesFor((r) => r.officers);

    const { capacity, inmates, officers, incidents, type } = building;
    const occupancy = capacity > 0 ? inmates / capacity : 0;
    const supervisionRatio =
      officers > 0 && inmates > 0 ? inmates / officers : null;
    const ratioTarget = SUPERVISION_RATIO_TARGET[type] ?? null;
    const understaffed =
      supervisionRatio !== null &&
      ratioTarget !== null &&
      supervisionRatio > ratioTarget;

    const trailing = (series: number[]) => series.slice(-6);
    const forecastInmates = Math.max(0, Math.round(project(inmateSeries, 6)));

    return {
      building,
      occupancy,
      supervisionRatio,
      ratioTarget,
      understaffed,
      coveragePer100: inmates > 0 ? (officers / inmates) * 100 : null,
      coveragePressure:
        supervisionRatio !== null && ratioTarget
          ? clamp(supervisionRatio / ratioTarget, 0, 1.4) / 1.4
          : 0,
      incidentsPer100: inmates > 0 ? (incidents / inmates) * 100 : 0,
      overCapacity: inmates > capacity,
      bedsAvailable: capacity - inmates,
      inmateSeries,
      incidentSeries,
      officerSeries,
      occupancySeries: inmateSeries.map((v) => (capacity > 0 ? v / capacity : 0)),
      incidentSlope: linearFit(trailing(incidentSeries)).slope,
      inmateSlope: linearFit(trailing(inmateSeries)).slope,
      forecastInmates,
      forecastOccupancy: capacity > 0 ? forecastInmates / capacity : 0,
    };
  });

  const metricsById = new Map(buildingMetrics.map((m) => [m.building.id, m]));
  const metricsFor = (id: string) => metricsById.get(id);

  const totalIncidents = sum(data.buildings.map((b) => b.incidents));
  const postedOfficers = sum(data.buildings.map((b) => b.officers));
  const instrumentedInmates = sum(
    data.buildings.filter((b) => b.residential).map((b) => b.inmates)
  );

  const summary: FacilitySummary = {
    totalInmates: data.totalInmates,
    instrumentedInmates,
    totalOfficers: data.totalOfficers,
    postedOfficers,
    reliefOfficers: Math.max(0, data.totalOfficers - postedOfficers),
    totalIncidents,
    occupancyRate:
      data.designCapacity > 0 ? data.totalInmates / data.designCapacity : 0,
    designCapacity: data.designCapacity,
    overcrowded: buildingMetrics.filter((m) => m.overCapacity),
    understaffed: buildingMetrics.filter((m) => m.understaffed),
    facilityRatio:
      data.totalOfficers > 0 ? data.totalInmates / data.totalOfficers : 0,
    incidentsPer1000:
      data.totalInmates > 0 ? (totalIncidents / data.totalInmates) * 1000 : 0,
  };

  const series = (label: string, values: number[]): TrendSeries => {
    const last = values.length - 1;
    return {
      label,
      values,
      fit: linearFit(values),
      ytdChange: values[0] ? (values[last] - values[0]) / values[0] : 0,
      momChange:
        last > 0 && values[last - 1]
          ? (values[last] - values[last - 1]) / values[last - 1]
          : 0,
      forecast6: Math.round(project(values, 6)),
    };
  };

  const trends = {
    population: series('Facility Population Trend', data.populationTrend),
    incidents: series('Incidents by Month', data.incidentTrend),
    staffing: series('Officer Staffing Trend', data.staffingTrend),
  };

  const meanIncidents = monthCount ? sum(data.incidentTrend) / monthCount : 0;
  const meanStaffing = monthCount ? sum(data.staffingTrend) / monthCount : 0;
  const incidentMomentum = meanIncidents
    ? clamp(trends.incidents.fit.slope / meanIncidents / 0.06, 0, 1)
    : 0;
  const staffingErosion = meanStaffing
    ? clamp(-trends.staffing.fit.slope / meanStaffing / 0.01, 0, 1)
    : 0;

  const components: RiskComponent[] = [
    {
      key: 'capacity',
      label: 'Capacity pressure',
      weight: 0.25,
      pressure: clamp((summary.occupancyRate - 0.85) / 0.2),
      readout: `${(summary.occupancyRate * 100).toFixed(0)}% of rated capacity`,
    },
    {
      key: 'incidents',
      label: 'Incident intensity',
      weight: 0.25,
      pressure: clamp(summary.incidentsPer1000 / 30),
      readout: `${summary.incidentsPer1000.toFixed(1)} per 1,000 inmates`,
    },
    {
      key: 'staffing',
      label: 'Supervision load',
      weight: 0.2,
      pressure: clamp((summary.facilityRatio - 6.5) / 2.5),
      readout: `${summary.facilityRatio.toFixed(2)} inmates per officer`,
    },
    {
      key: 'status',
      label: 'Unit status mix',
      weight: 0.15,
      pressure: data.buildings.length
        ? sum(data.buildings.map((b) => STATUS_PRESSURE[b.status] ?? 0)) /
          data.buildings.length
        : 0,
      readout: `${data.buildings.filter((b) => b.status !== 'Normal').length} of ${data.buildings.length} units off-normal`,
    },
    {
      key: 'trend',
      label: 'Trend divergence',
      weight: 0.15,
      pressure: (incidentMomentum + staffingErosion) / 2,
      readout: 'Incidents rising, staffing falling',
    },
  ];

  const score = Math.round(
    components.reduce((acc, c) => acc + c.weight * c.pressure, 0) * 100
  );
  const band =
    score < 25
      ? 'Low'
      : score < 45
        ? 'Guarded'
        : score < 65
          ? 'Elevated'
          : score < 85
            ? 'High'
            : 'Severe';

  const risk = { score, band, components };

  const first = (values: number[]) => values[0] ?? 0;
  const last = (values: number[]) => values[values.length - 1] ?? 0;

  const executiveMetrics: ExecutiveMetric[] = [
    {
      key: 'population-growth',
      label: 'Population Growth Rate',
      value: trends.population.ytdChange,
      format: 'percent',
      direction: 'up',
      sentiment: 'bad',
      caption: `${first(data.populationTrend).toLocaleString()} → ${last(data.populationTrend).toLocaleString()} year to date`,
    },
    {
      key: 'incident-growth',
      label: 'Incident Growth Rate',
      value: trends.incidents.ytdChange,
      format: 'percent',
      direction: 'up',
      sentiment: 'bad',
      caption: `${first(data.incidentTrend)} → ${last(data.incidentTrend)} monthly incidents`,
    },
    {
      key: 'staffing-change',
      label: 'Staffing Change Rate',
      value: trends.staffing.ytdChange,
      format: 'percent',
      direction: 'down',
      sentiment: 'bad',
      caption: `${first(data.staffingTrend)} → ${last(data.staffingTrend)} officers on strength`,
    },
    {
      key: 'capacity-utilisation',
      label: 'Capacity Utilization',
      value: summary.occupancyRate,
      format: 'percent-abs',
      direction: 'up',
      sentiment: 'warn',
      caption: `${summary.totalInmates.toLocaleString()} of ${summary.designCapacity.toLocaleString()} rated beds`,
    },
    {
      key: 'risk-score',
      label: 'Operational Risk Score',
      value: risk.score,
      format: 'score',
      direction: 'up',
      sentiment: risk.score >= 45 ? 'bad' : 'warn',
      caption: `${risk.band} — weighted across ${components.length} risk factors`,
    },
  ];

  const maxInmates = Math.max(1, ...data.buildings.map((b) => b.inmates));
  const maxIncidents = Math.max(1, ...data.buildings.map((b) => b.incidents));

  const heatValue = (metrics: BuildingMetrics, view: MapView): number => {
    switch (view) {
      case 'population':
        return metrics.building.inmates / maxInmates;
      case 'incidents':
        return metrics.building.incidents / maxIncidents;
      case 'coverage':
        return metrics.coveragePressure;
      case 'status':
      default:
        return STATUS_PRESSURE[metrics.building.status] ?? 0;
    }
  };

  const heatReadout = (metrics: BuildingMetrics, view: MapView): string => {
    switch (view) {
      case 'population':
        return `${metrics.building.inmates.toLocaleString()} inmates`;
      case 'incidents':
        return `${metrics.building.incidents} incident${metrics.building.incidents === 1 ? '' : 's'}`;
      case 'coverage':
        return metrics.supervisionRatio === null
          ? 'No inmate population'
          : `${metrics.supervisionRatio.toFixed(1)} inmates / officer`;
      case 'status':
      default:
        return metrics.building.status;
    }
  };

  return {
    data,
    months: data.months.map((m) => m.name),
    monthAbbr: data.months.map((m) => m.abbr),
    monthCount,
    buildingMetrics,
    metricsById,
    metricsFor,
    summary,
    trends,
    risk,
    executiveMetrics,
    reportingPeriod: data.months[monthCount - 1]?.name ?? '',
    heatValue,
    heatReadout,
  };
}

export { FACILITY };
