/**
 * Shape of the operational data this application renders.
 *
 * The values are served by the **North Valley Corrections Twin** semantic model
 * in your Fabric workspace (see `fabric.yaml`). This module owns only the
 * contract plus the facility metadata and scenario content that are not part of
 * the model — nothing here duplicates a figure the model reports.
 */

import type { HotspotPoint } from '@/data/geometry';

export type { HotspotPoint };

export type OperationalStatus =
  | 'Normal'
  | 'Elevated Risk'
  | 'Over Capacity'
  | 'Critical';

export type BuildingType =
  | 'Medium Security Housing'
  | 'High Security Housing'
  | 'Protective Custody'
  | 'Restricted Housing'
  | 'Healthcare'
  | 'Admissions'
  | 'Rehabilitation'
  | 'Recreation'
  | 'Food Services'
  | 'Administration'
  | 'Operations';

export interface Building {
  id: string;
  name: string;
  /** Short label used on the map and in tight table columns. */
  shortName: string;
  type: BuildingType;
  capacity: number;
  inmates: number;
  officers: number;
  incidents: number;
  status: OperationalStatus;
  /**
   * Residential buildings hold assigned beds. Non-residential buildings report
   * the inmates *present* at that location — those inmates are counted against
   * their assigned housing unit, never twice.
   */
  residential: boolean;
  /** Footprint traced over the aerial photograph, joined from `geometry.ts`. */
  hotspot: readonly HotspotPoint[];
  /** Operator-facing context shown in the building detail panel. */
  note: string;
}

/** One building's reading for one reporting period. */
export interface BuildingReading {
  buildingId: string;
  monthKey: number;
  inmates: number;
  officers: number;
  incidents: number;
}

export interface TwinMonth {
  key: number;
  name: string;
  abbr: string;
}

/** Everything the dashboard needs, as returned by the semantic model. */
export interface TwinData {
  buildings: Building[];
  months: TwinMonth[];
  /** Monthly readings for every building, used for per-building history. */
  readings: BuildingReading[];
  /** Facility population at each month end. */
  populationTrend: number[];
  /** Reportable incidents recorded in each month. */
  incidentTrend: number[];
  /** Correctional officers on strength at each month end. */
  staffingTrend: number[];
  /** Rated design capacity of the complex in the current period. */
  designCapacity: number;
  /** Facility-wide population roll-up for the current period. */
  totalInmates: number;
  /** Facility-wide authorised strength for the current period. */
  totalOfficers: number;
}

/**
 * Static facility metadata. These are naming and designation attributes rather
 * than measured values — every number on the dashboard comes from the model.
 */
export const FACILITY = {
  name: 'North Valley Correctional Complex',
  code: 'NVCC',
  region: 'North Valley Corrections District',
  /** Operator-set posture designation, not a computed metric. */
  status: 'Stable',
} as const;

/**
 * Maximum inmates per on-post officer before a unit is flagged understaffed.
 * Tighter ratios apply where supervision intensity is highest. These are policy
 * thresholds applied to the model's measures, not data from the model.
 */
export const SUPERVISION_RATIO_TARGET: Record<BuildingType, number | null> = {
  'Medium Security Housing': 8,
  'High Security Housing': 8,
  'Protective Custody': 8,
  'Restricted Housing': 4,
  Healthcare: 6,
  Admissions: 6,
  Rehabilitation: 14,
  Recreation: 15,
  'Food Services': 4,
  Administration: null,
  Operations: 4,
};

export interface PredictiveAlert {
  id: string;
  severity: 'critical' | 'risk' | 'elevated';
  buildingId: string | null;
  title: string;
  detail: string;
  horizon: string;
}

/**
 * Standing watch items. The narrative is editorial; the supporting figures
 * rendered beneath each card are computed from the model at render time.
 */
export const PREDICTIVE_ALERTS: readonly PredictiveAlert[] = [
  {
    id: 'alert-b-capacity',
    severity: 'critical',
    buildingId: 'housing-b',
    title: 'Housing Unit B projected to exceed 110% capacity',
    detail:
      'Unit B is already over rating. The nine-month admission trend puts it past 110% of rated capacity, removing the last temporary-bunk headroom.',
    horizon: 'Within 30 days',
  },
  {
    id: 'alert-d-staffing',
    severity: 'risk',
    buildingId: 'housing-d',
    title: 'Housing Unit D staffing ratio below recommended threshold',
    detail:
      'Unit D supervises a high-security population above the recommended inmates-per-officer ratio while also running over rated capacity.',
    horizon: 'Active now',
  },
  {
    id: 'alert-divergence',
    severity: 'elevated',
    buildingId: null,
    title: 'Population rising while officer staffing declines',
    detail:
      'Facility population and officer strength have moved in opposite directions every month this year. The widening gap compounds supervision load across all units.',
    horizon: 'Sustained 9 months',
  },
];
