/** Test list with filtering, creation, and one-click execution. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { RunTestDialog } from '@/components/RunTestDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/hooks/AuthContext';
import { useAzureAi } from '@/hooks/AzureAiContext';
import { collectSecretKeys } from '@/lib/testDefinition';
import { formatDateTime, parseTags } from '@/lib/format';
import { runTest } from '@/services/testRunner';
import {
  createTest,
  deleteTest,
  listApplications,
  listSteps,
  listTests,
  type ApplicationRow,
  type TestRow,
} from '@/services/testStore';

export function TestsPage() {
  const { user } = useAuth();
  const { connected } = useAzureAi();
  const navigate = useNavigate();

  const [tests, setTests] = useState<TestRow[]>([]);
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [creating, setCreating] = useState(false);

  const [runTarget, setRunTarget] = useState<TestRow | null>(null);
  const [secretKeys, setSecretKeys] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const refresh = () =>
    Promise.all([listTests(), listApplications()])
      .then(([t, a]) => {
        setTests(t);
        setApps(a);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load.')
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return tests.filter((t) => {
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        t.name.toLowerCase().includes(needle) ||
        (t.tags ?? '').toLowerCase().includes(needle)
      );
    });
  }, [tests, filter, statusFilter]);

  const appName = (id: string) => apps.find((a) => a.id === id)?.name ?? '—';

  async function createBlank() {
    if (apps.length === 0) {
      setError('Register an application first — a test has to run against one.');
      return;
    }
    setCreating(true);
    try {
      const now = new Date();
      const created = await createTest({
        name: 'Untitled test',
        description: '',
        application_id: apps[0].id,
        device_profile: 'Desktop',
        auth_method: 'None',
        tags: '',
        timeout_seconds: 300,
        capture_screenshot_every_step: false,
        status: 'Draft',
        created_by: user?.id ?? 'unknown',
        created_at: now,
        updated_at: now,
      });
      navigate(`/tests/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the test.');
    } finally {
      setCreating(false);
    }
  }

  async function openRunDialog(test: TestRow) {
    const steps = await listSteps(test.id);
    setSecretKeys(collectSecretKeys(steps));
    setRunTarget(test);
  }

  async function execute(secrets: Record<string, string>) {
    if (!runTarget) return;
    setRunning(true);
    try {
      const run = await runTest(runTarget.id, {
        createdBy: user?.id ?? 'unknown',
        secrets,
      });
      setRunTarget(null);
      navigate(`/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The run could not start.');
      setRunTarget(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tests</h1>
          <p className="mt-1 text-sm text-gray-500">
            Written in plain language. No selectors, no code.
          </p>
        </div>
        <button
          onClick={() => void createBlank()}
          disabled={creating}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          New test
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search by name or tag…"
          className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {['All', 'Draft', 'Active', 'Archived'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-500">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No tests match. Create one to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Test</th>
                <th className="px-4 py-2 font-medium">Application</th>
                <th className="px-4 py-2 font-medium">State</th>
                <th className="px-4 py-2 font-medium">Last run</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((test) => (
                <tr key={test.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/tests/${test.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {test.name}
                    </Link>
                    <div className="mt-0.5 flex gap-1">
                      {parseTags(test.tags).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {appName(test.application_id)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={test.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={test.last_run_status} />
                      <span className="text-xs text-gray-500">
                        {formatDateTime(test.last_run_at)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => void openRunDialog(test)}
                        disabled={!connected}
                        title={
                          connected
                            ? undefined
                            : 'Connect to Azure AI to execute tests'
                        }
                        className="text-xs font-medium text-blue-700 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
                      >
                        Run
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Delete "${test.name}"?`)) return;
                          try {
                            await deleteTest(test.id);
                            await refresh();
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : 'Could not delete the test.'
                            );
                          }
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {runTarget && (
        <RunTestDialog
          testName={runTarget.name}
          secretKeys={secretKeys}
          busy={running}
          onCancel={() => setRunTarget(null)}
          onRun={(secrets) => void execute(secrets)}
        />
      )}
    </div>
  );
}
