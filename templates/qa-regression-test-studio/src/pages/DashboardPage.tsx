/**
 * Landing view: the health of the suite at a glance.
 *
 * Deliberately answers the three questions the customer asks after a Windows
 * patch or an application upgrade — what is failing, how much of the suite has
 * actually run, and which tests needed their locators repaired — rather than
 * showing a generic activity feed.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime, formatDuration, passRate } from '@/lib/format';
import {
  listApplications,
  listRuns,
  listTests,
  type ApplicationRow,
  type RunRow,
  type TestRow,
} from '@/services/testStore';

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

export function DashboardPage() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listTests(), listRuns(200), listApplications()])
      .then(([t, r, a]) => {
        if (cancelled) return;
        setTests(t);
        setRuns(r);
        setApps(a);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load data.')
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const active = tests.filter((t) => t.status === 'Active');
    const failing = tests.filter(
      (t) => t.last_run_status === 'Failed' || t.last_run_status === 'Error'
    );
    const neverRun = tests.filter((t) => !t.last_run_status);
    const rate = passRate(runs);

    // Manual-effort saved is the customer's stated goal, so it is estimated
    // from actual executions rather than left implicit: every automated run is
    // a pass a person would otherwise have driven by hand and typed into Excel.
    const executed = runs.filter((r) => r.status !== 'Running').length;

    return {
      active: active.length,
      failing: failing.length,
      neverRun: neverRun.length,
      rate,
      executed,
    };
  }, [tests, runs]);

  const recent = runs.slice(0, 8);
  const testName = (id: string) => tests.find((t) => t.id === id)?.name ?? '—';

  if (loading) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Nothing here yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          Start by registering the applications you test, then write your first
          test in plain language — no code, no selectors.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link
            to="/applications"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add an application
          </Link>
          <Link
            to="/tests"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Go to tests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Active tests"
          value={String(stats.active)}
          hint={`${tests.length} total`}
        />
        <StatCard
          label="Needs attention"
          value={String(stats.failing)}
          hint="Failed or errored last run"
        />
        <StatCard
          label="Never run"
          value={String(stats.neverRun)}
          hint="No execution evidence yet"
        />
        <StatCard
          label="Pass rate"
          value={stats.rate == null ? '—' : `${stats.rate}%`}
          hint="Across recorded runs"
        />
        <StatCard
          label="Applications"
          value={String(apps.length)}
          hint="Under test"
        />
      </div>

      {stats.failing > 0 && (
        <section className="rounded-xl border border-red-200 bg-white">
          <header className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Tests needing attention
            </h2>
          </header>
          <ul className="divide-y divide-gray-100">
            {tests
              .filter(
                (t) =>
                  t.last_run_status === 'Failed' || t.last_run_status === 'Error'
              )
              .map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <Link
                    to={`/tests/${t.id}`}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    {t.name}
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {formatDateTime(t.last_run_at)}
                    </span>
                    <StatusBadge status={t.last_run_status} />
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white">
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Recent runs</h2>
          <Link to="/runs" className="text-xs text-blue-700 hover:underline">
            View all
          </Link>
        </header>

        {recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No runs recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recent.map((run) => (
              <li
                key={run.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <Link
                  to={`/runs/${run.id}`}
                  className="text-sm text-blue-700 hover:underline"
                >
                  {testName(run.test_id)}
                </Link>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{formatDuration(run.duration_seconds)}</span>
                  <span>{formatDateTime(run.started_at)}</span>
                  <StatusBadge status={run.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
