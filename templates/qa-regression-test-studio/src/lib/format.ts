/** Small formatting helpers shared across the run and test views. */

export function formatDateTime(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds?: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${mins}m ${rest}s`;
}

/** Comma-separated tag string to a trimmed array, ignoring empties. */
export function parseTags(tags?: string | null): string[] {
  return (tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Percentage of runs that passed, or null when there are none to divide by. */
export function passRate(
  runs: Array<{ status: string }>
): number | null {
  const finished = runs.filter((r) =>
    ['Passed', 'Failed', 'Error'].includes(r.status)
  );
  if (finished.length === 0) return null;
  const passed = finished.filter((r) => r.status === 'Passed').length;
  return Math.round((passed / finished.length) * 100);
}
