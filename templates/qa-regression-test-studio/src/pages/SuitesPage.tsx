/**
 * Suites: the unit the customer actually schedules — the monthly Windows 11
 * patch pass, and the larger per-application regression suites run after a
 * major upgrade.
 *
 * A Fabric App is a static SPA with no server-side timer, so the schedule set
 * here is executed by the `regression-test-scheduler` Container Apps Job, which
 * ticks every 15 minutes and runs whatever has come due. Editing the cron here
 * is all that is needed — see docs/SCHEDULING.md.
 */
import { useEffect, useState } from 'react';

import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/hooks/AuthContext';
import { useAzureAi } from '@/hooks/AzureAiContext';
import { formatDateTime } from '@/lib/format';
import { runSuite, type SuiteRunProgress } from '@/services/testRunner';
import {
  addSuiteMember,
  createSuite,
  deleteSuite,
  listSuiteMembers,
  listSuites,
  listTests,
  removeSuiteMember,
  updateSuite,
  type SuiteMemberRow,
  type SuiteRow,
  type TestRow,
} from '@/services/testStore';

export function SuitesPage() {
  const { user } = useAuth();
  const { connected } = useAzureAi();

  const [suites, setSuites] = useState<SuiteRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [members, setMembers] = useState<Record<string, SuiteMemberRow[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<SuiteRunProgress | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const refresh = async () => {
    const [s, t] = await Promise.all([listSuites(), listTests()]);
    setSuites(s);
    setTests(t);
    const entries = await Promise.all(
      s.map(async (suite) => [suite.id, await listSuiteMembers(suite.id)] as const)
    );
    setMembers(Object.fromEntries(entries));
  };

  useEffect(() => {
    refresh()
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load.')
      )
      .finally(() => setLoading(false));
  }, []);

  const testName = (id: string) => tests.find((t) => t.id === id)?.name ?? '—';

  async function create() {
    if (!newName.trim()) return;
    await createSuite({
      name: newName.trim(),
      description: '',
      schedule_cron: '',
      schedule_enabled: false,
      created_by: user?.id ?? 'unknown',
      created_at: new Date(),
    });
    setNewName('');
    await refresh();
  }

  async function execute(suite: SuiteRow) {
    setRunningId(suite.id);
    setProgress({ completed: 0, total: members[suite.id]?.length ?? 0 });
    try {
      await runSuite(suite.id, suite.name, {
        createdBy: user?.id ?? 'unknown',
        onProgress: setProgress,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The suite run failed.');
    } finally {
      setRunningId(null);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Suites</h1>
        <p className="mt-1 text-sm text-gray-500">
          Group tests so a whole regression pass runs in one go.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Monthly Windows 11 patch validation"
          className="w-80 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={() => void create()}
          disabled={!newName.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          New suite
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : suites.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
          No suites yet.
        </p>
      ) : (
        <div className="space-y-4">
          {suites.map((suite) => {
            const suiteMembers = members[suite.id] ?? [];
            const isOpen = expanded === suite.id;
            const isRunning = runningId === suite.id;

            return (
              <section
                key={suite.id}
                className="rounded-xl border border-gray-200 bg-white"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {suite.name}
                      </span>
                      <StatusBadge status={suite.last_run_status} />
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {suiteMembers.length} test
                      {suiteMembers.length === 1 ? '' : 's'} · last run{' '}
                      {formatDateTime(suite.last_run_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isRunning && progress && (
                      <span className="text-xs text-blue-700">
                        Running {progress.completed + 1} of {progress.total}…
                      </span>
                    )}
                    <button
                      onClick={() => void execute(suite)}
                      disabled={
                        !connected || suiteMembers.length === 0 || isRunning
                      }
                      title={
                        !connected
                          ? 'Connect to Azure AI to execute tests'
                          : undefined
                      }
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Run suite
                    </button>
                    <button
                      onClick={() => setExpanded(isOpen ? null : suite.id)}
                      className="text-xs text-blue-700 hover:underline"
                    >
                      {isOpen ? 'Close' : 'Manage'}
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Delete "${suite.name}"?`)) return;
                        await deleteSuite(suite.id);
                        await refresh();
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </header>

                {isOpen && (
                  <div className="space-y-4 px-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-medium text-gray-700">
                          Schedule (cron)
                        </span>
                        <input
                          value={suite.schedule_cron ?? ''}
                          placeholder="0 2 * * 1"
                          onChange={(e) =>
                            setSuites((prev) =>
                              prev.map((s) =>
                                s.id === suite.id
                                  ? { ...s, schedule_cron: e.target.value }
                                  : s
                              )
                            )
                          }
                          onBlur={(e) =>
                            void updateSuite(suite.id, {
                              schedule_cron: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <span className="mt-1 block text-xs text-gray-500">
                          Runs unattended in UTC, checked every 15 minutes.
                        </span>
                      </label>

                      <label className="mt-6 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={suite.schedule_enabled}
                          onChange={(e) => {
                            setSuites((prev) =>
                              prev.map((s) =>
                                s.id === suite.id
                                  ? { ...s, schedule_enabled: e.target.checked }
                                  : s
                              )
                            );
                            void updateSuite(suite.id, {
                              schedule_enabled: e.target.checked,
                            });
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">
                          Schedule enabled
                        </span>
                      </label>
                    </div>

                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Tests in this suite
                      </h3>
                      {suiteMembers.length === 0 ? (
                        <p className="mt-2 text-sm text-gray-500">
                          None yet.
                        </p>
                      ) : (
                        <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
                          {suiteMembers.map((member) => (
                            <li
                              key={member.id}
                              className="flex items-center justify-between px-3 py-2"
                            >
                              <span className="text-sm text-gray-800">
                                {member.sort_order}. {testName(member.test_id)}
                              </span>
                              <button
                                onClick={async () => {
                                  await removeSuiteMember(member.id);
                                  await refresh();
                                }}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <select
                        id={`add-${suite.id}`}
                        defaultValue=""
                        className="w-72 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="" disabled>
                          Add a test…
                        </option>
                        {tests
                          .filter(
                            (t) =>
                              !suiteMembers.some((m) => m.test_id === t.id)
                          )
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={async () => {
                          const select = document.getElementById(
                            `add-${suite.id}`
                          ) as HTMLSelectElement | null;
                          if (!select?.value) return;
                          await addSuiteMember({
                            suite_id: suite.id,
                            test_id: select.value,
                            sort_order: suiteMembers.length + 1,
                          });
                          select.value = '';
                          await refresh();
                        }}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
