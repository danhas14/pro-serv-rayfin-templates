import type { OperationalStatus } from '@/data/twin';

export interface StatusTheme {
  /** Solid accent used for dots, strokes and bar fills. */
  color: string;
  /** Translucent fill for map overlays. */
  fill: string;
  /** Tailwind classes for pill badges. */
  badge: string;
  label: string;
}

export const STATUS_THEME: Record<OperationalStatus, StatusTheme> = {
  Normal: {
    color: '#2ee07a',
    fill: 'rgba(46, 224, 122, 0.30)',
    badge: 'border-[#2ee07a]/40 bg-[#2ee07a]/12 text-[#7ff0b2]',
    label: 'Normal',
  },
  'Elevated Risk': {
    color: '#f3c623',
    fill: 'rgba(243, 198, 35, 0.32)',
    badge: 'border-[#f3c623]/40 bg-[#f3c623]/12 text-[#f7dc7d]',
    label: 'Elevated Risk',
  },
  'Over Capacity': {
    color: '#ff8c3a',
    fill: 'rgba(255, 140, 58, 0.34)',
    badge: 'border-[#ff8c3a]/45 bg-[#ff8c3a]/12 text-[#ffbb86]',
    label: 'Over Capacity',
  },
  Critical: {
    color: '#ff4d5e',
    fill: 'rgba(255, 77, 94, 0.36)',
    badge: 'border-[#ff4d5e]/45 bg-[#ff4d5e]/14 text-[#ff9aa5]',
    label: 'Critical',
  },
};

/** Legend order used by the map key and the status roll-up. */
export const STATUS_ORDER: OperationalStatus[] = [
  'Normal',
  'Elevated Risk',
  'Over Capacity',
  'Critical',
];

const HEAT_STOPS: [number, [number, number, number]][] = [
  [0, [46, 224, 122]],
  [0.4, [243, 198, 35]],
  [0.7, [255, 140, 58]],
  [1, [255, 77, 94]],
];

/** Interpolate the normal → elevated → risk → critical ramp at `t` (0–1). */
export function heatColor(t: number, alpha = 1): string {
  const value = Math.min(1, Math.max(0, t));
  let lower = HEAT_STOPS[0];
  let upper = HEAT_STOPS[HEAT_STOPS.length - 1];

  for (let i = 0; i < HEAT_STOPS.length - 1; i += 1) {
    if (value >= HEAT_STOPS[i][0] && value <= HEAT_STOPS[i + 1][0]) {
      lower = HEAT_STOPS[i];
      upper = HEAT_STOPS[i + 1];
      break;
    }
  }

  const span = upper[0] - lower[0];
  const ratio = span === 0 ? 0 : (value - lower[0]) / span;
  const channel = (index: number) =>
    Math.round(lower[1][index] + (upper[1][index] - lower[1][index]) * ratio);

  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${alpha})`;
}
