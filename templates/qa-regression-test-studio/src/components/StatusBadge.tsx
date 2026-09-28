/**
 * Status pill used everywhere a run, step, or assertion outcome is shown.
 *
 * `Failed` and `Error` are given visibly different colours rather than both
 * being red: the distinction between "the application is broken" and "the test
 * could not run" is the first thing a triaging analyst needs, and collapsing it
 * into one colour makes a flaky environment look like a product regression.
 */
const STYLES: Record<string, string> = {
  Passed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Failed: 'bg-red-50 text-red-700 ring-red-600/20',
  Error: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  Running: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Queued: 'bg-gray-50 text-gray-600 ring-gray-500/20',
  Skipped: 'bg-gray-50 text-gray-500 ring-gray-400/20',
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Draft: 'bg-gray-50 text-gray-600 ring-gray-500/20',
  Archived: 'bg-gray-100 text-gray-500 ring-gray-400/20',
  Critical: 'bg-red-50 text-red-700 ring-red-600/20',
  Major: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  Minor: 'bg-gray-50 text-gray-600 ring-gray-500/20',
};

export function StatusBadge({
  status,
  title,
}: {
  status?: string | null;
  title?: string;
}) {
  const label = status ?? 'Never run';
  const style = STYLES[label] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20';

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}
