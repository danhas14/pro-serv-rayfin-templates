export const formatInt = (value: number): string =>
  Math.round(value).toLocaleString('en-US');

export const formatPercent = (fraction: number, digits = 0): string =>
  `${(fraction * 100).toFixed(digits)}%`;

/** Signed percentage, e.g. "+17.3%" / "−4.1%". */
export const formatDelta = (fraction: number, digits = 1): string => {
  const pct = fraction * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(digits)}%`;
};

export const formatRatio = (value: number | null, digits = 2): string =>
  value === null ? '—' : value.toFixed(digits);

/** Tailwind class names joined with spaces, skipping falsy entries. */
export const cx = (
  ...classes: (string | false | null | undefined)[]
): string => classes.filter(Boolean).join(' ');
