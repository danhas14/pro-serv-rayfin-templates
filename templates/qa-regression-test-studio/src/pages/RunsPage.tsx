/**
 * Run history and the failure/exception report.
 *
 * The CSV export exists because it is the customer's current deliverable: they
 * record steps and results in Excel today, and a migration that cannot hand
 * back a spreadsheet is a migration their auditors will reject. It is generated
 * from the same rows the UI shows, so the export can never disagree with the
 * screen.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime, formatDuration, passRate } from '@/lib/format';
import { listRuns, listTests, type RunRow, type TestRow } from '@/services/testStore';

/** RFC 4180 escaping — a summary containing a comma or quote is normal here. */
function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function RunsPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    Promise.all([listRuns(500), listTests()])
      .then(([r, t]) => {
        setRuns(r);
        setTests(t);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load runs.')
      )
      .finally(() => setLoading(false));
  }, []);

  const testName = (id: string) => tests.find((t) => t.id === id)?.name ?? '—';

  const visible = useMemo(
    () =>
      statusFilter === 'All'
        ? runs
        : statusFilter === 'Problems'
          ? runs.filter((r) => r.status === 'Failed' || r.status === 'Error')
          : runs.filter((r) => r.status === statusFilter),
    [runs, statusFilter]
  );

  const rate = passRate(runs);

  function exportCsv() {
    const header = [
      'Run ID',
      'Test',
      'Suite',
      'Status',
      'Triggered by',
      'Started',
      'Completed',
      'Duration (s)',
      'Failed step',
      'Failure reason',
      'Summary',
    ];
    const lines = [
      header.map(csvCell).join(','),
      ...visible.map((run) =>
        [
          run.id,
          testName(run.test_id),
          run.suite_name ?? '',
          run.status,
          run.triggered_by,
          run.started_at ? new Date(run.started_at).toISOString() : '',
          run.completed_at ? new Date(run.completed_at).toISOString() : '',
          run.duration_seconds ?? '',
          run.failed_step_number ?? '',
          run.failure_reason ?? '',
          run.summary ?? '',
        ]
          .map(csvCell)
          .join(',')
      ),
    ];

    // BOM so Excel opens UTF-8 correctly — the target audience lives in Excel.
    const blob = new Blob(['\uFEFF', lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `regression-runs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Run history</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every execution, with the evidence attached.
            {rate != null && ` Overall pass rate ${rate}%.`}
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={visible.length === 0}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Export to Excel (CSV)
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {['All', 'Problems', 'Passed', 'Failed', 'Error'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-500">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No runs to show.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Test</th>
                <th className="px-4 py-2 font-medium">Suite</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Started</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                <th className="px-4 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((run) => (
                <tr key={run.id} className="align-top hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/runs/${run.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {testName(run.test_id)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {run.suite_name ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {formatDateTime(run.started_at)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {formatDuration(run.duration_seconds)}
                  </td>
                  <td className="max-w-md px-4 py-2.5 text-gray-600">
                    {run.failure_reason ?? run.summary ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
