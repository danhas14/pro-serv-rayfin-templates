/**
 * The no-code test authoring surface.
 *
 * Every action is chosen from a fixed list and every target is typed as a
 * sentence, which is what makes this usable by a business analyst: there is
 * nowhere to put a CSS selector, and nothing to install. The agent turns the
 * sentence into a durable locator on the first run and stores it back on the
 * step, so the plain-language description stays the thing humans maintain while
 * the machine keeps its own precise version underneath.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { RunTestDialog } from '@/components/RunTestDialog';
import { ScriptEditor } from '@/components/ScriptEditor';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/hooks/AuthContext';
import { useAzureAi } from '@/hooks/AzureAiContext';
import { collectSecretKeys, parseLocator } from '@/lib/testDefinition';
import { formatDateTime } from '@/lib/format';
import { runTest } from '@/services/testRunner';
import {
  isRunnerConfigured,
  runTestWithScreenshots,
} from '@/services/containerAppRunner';
import { generatePlaywrightScript } from '@/services/scriptGenerator';
import {
  createAssertion,
  createStep,
  deleteAssertion,
  deleteStep,
  listApplications,
  listAssertions,
  listRunsForTest,
  listSteps,
  updateAssertion,
  updateStep,
  updateTest,
  getTest,
  getScriptForTest,
  createScript,
  updateScript,
  type ApplicationRow,
  type AssertionRow,
  type RunRow,
  type ScriptRow,
  type StepRow,
  type TestRow,
} from '@/services/testStore';

const ACTIONS = [
  { value: 'navigate', label: 'Go to a page', needs: 'value' },
  { value: 'click', label: 'Click something', needs: 'target' },
  { value: 'type', label: 'Type into a field', needs: 'both' },
  { value: 'select', label: 'Pick from a dropdown', needs: 'both' },
  { value: 'confirmValue', label: 'Confirm value', needs: 'both' },
  { value: 'waitForText', label: 'Wait for text to appear', needs: 'both' },
  { value: 'waitForElement', label: 'Wait for something to appear', needs: 'target' },
  { value: 'extractText', label: 'Read a value and remember it', needs: 'target' },
  { value: 'hover', label: 'Hover over something', needs: 'target' },
  { value: 'press', label: 'Press a key', needs: 'value' },
  { value: 'screenshot', label: 'Capture a screenshot', needs: 'none' },
] as const;

const ASSERTION_TYPES = [
  { value: 'urlContains', label: 'The address contains' },
  { value: 'textVisible', label: 'This text is visible' },
  { value: 'textNotVisible', label: 'This text is NOT visible' },
  { value: 'elementVisible', label: 'This element is visible' },
  { value: 'confirmValue', label: 'Confirm value' },
  { value: 'valueEquals', label: 'This field equals' },
  { value: 'noErrorsDisplayed', label: 'No error messages are shown' },
];

/**
 * Which inputs each check needs, and what to prompt for.
 *
 * `confirmValue` is the one that reads a field rather than matching a literal:
 * the target names the field and the detail is an optional plain-language
 * description of the expected shape, so an analyst can write "filled" or
 * "numeric, 6-10 digits" without learning a matching syntax.
 */
const ASSERTION_FIELDS: Record<
  string,
  { target?: string; expected?: string }
> = {
  urlContains: { expected: 'Text the address should contain' },
  textVisible: { expected: 'Text that should appear on screen' },
  textNotVisible: { expected: 'Text that should NOT appear' },
  elementVisible: { target: 'The element that should be on screen' },
  confirmValue: {
    target: 'The field to read, e.g. the Adding Officer field',
    expected: 'Filled; numeric Officer ID, 6-10 digits (optional)',
  },
  valueEquals: {
    target: 'The field to read',
    expected: 'The exact value it must equal',
  },
  noErrorsDisplayed: {},
};

const DEVICE_PROFILES = [
  { value: 'Desktop', label: 'Desktop browser' },
  { value: 'MobileIOS', label: 'Mobile browser — iOS' },
  { value: 'MobileAndroid', label: 'Mobile browser — Android' },
  { value: 'Tablet', label: 'Tablet browser' },
];

function actionNeeds(action: string) {
  return ACTIONS.find((a) => a.value === action)?.needs ?? 'both';
}

export function TestEditorPage() {
  const { testId = '' } = useParams();
  const { user } = useAuth();
  const { connected } = useAzureAi();
  const navigate = useNavigate();

  const [test, setTest] = useState<TestRow | null>(null);
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [assertions, setAssertions] = useState<AssertionRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [showRun, setShowRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [script, setScript] = useState<ScriptRow | null>(null);
  const [savingScript, setSavingScript] = useState(false);
  const hasScript = !!script;

  const refresh = useCallback(async () => {
    const [t, a, s, asr, r, script] = await Promise.all([
      getTest(testId),
      listApplications(),
      listSteps(testId),
      listAssertions(testId),
      listRunsForTest(testId),
      getScriptForTest(testId),
    ]);
    setTest(t);
    setApps(a);
    setSteps(s);
    setAssertions(asr);
    setRuns(r);
    setScript(script);
  }, [testId]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load the test.')
      )
      .finally(() => setLoading(false));
  }, [refresh]);

  /** Persist a header change immediately — there is no explicit Save button. */
  async function patchTest(data: Partial<TestRow>) {
    if (!test) return;
    setTest({ ...test, ...data });
    try {
      await updateTest(test.id, { ...data, updated_at: new Date() });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function addStep() {
    const next = steps.length
      ? Math.max(...steps.map((s) => s.step_number)) + 1
      : 1;
    await createStep({
      test_id: testId,
      step_number: next,
      action: 'click',
      target: '',
      value: '',
      notes: '',
      optional: false,
    });
    await refresh();
  }

  async function patchStep(id: string, data: Partial<StepRow>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    await updateStep(id, data);
  }

  async function removeStep(step: StepRow) {
    await deleteStep(step.id);
    // Renumber so the agent always receives a contiguous ascending sequence.
    const remaining = steps
      .filter((s) => s.id !== step.id)
      .sort((a, b) => a.step_number - b.step_number);
    await Promise.all(
      remaining.map((s, i) =>
        s.step_number === i + 1
          ? Promise.resolve()
          : updateStep(s.id, { step_number: i + 1 })
      )
    );
    await refresh();
  }

  async function moveStep(step: StepRow, direction: -1 | 1) {
    const ordered = [...steps].sort((a, b) => a.step_number - b.step_number);
    const index = ordered.findIndex((s) => s.id === step.id);
    const swapWith = ordered[index + direction];
    if (!swapWith) return;
    await Promise.all([
      updateStep(step.id, { step_number: swapWith.step_number }),
      updateStep(swapWith.id, { step_number: step.step_number }),
    ]);
    await refresh();
  }

  async function addAssertion() {
    const next = assertions.length
      ? Math.max(...assertions.map((a) => a.assertion_number)) + 1
      : 1;
    await createAssertion({
      test_id: testId,
      assertion_number: next,
      type: 'textVisible',
      target: '',
      expected: '',
      severity: 'Major',
      description: '',
    });
    await refresh();
  }

  async function patchAssertion(id: string, data: Partial<AssertionRow>) {
    setAssertions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...data } : a))
    );
    await updateAssertion(id, data);
  }

  async function execute(secrets: Record<string, string>) {
    setRunning(true);
    try {
      const run = await runTest(testId, {
        createdBy: user?.id ?? 'unknown',
        secrets,
      });
      setShowRun(false);
      navigate(`/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The run could not start.');
      setShowRun(false);
    } finally {
      setRunning(false);
    }
  }

  async function regenerateScript() {
    if (!test || steps.length === 0) return;

    // Regenerating replaces the stored script outright, so hand-written work
    // would disappear without a word.
    if (
      script?.status === 'edited' &&
      !window.confirm(
        'This script has been edited by hand. Regenerating it from the steps ' +
        'will replace those edits and they cannot be recovered.\n\nContinue?'
      )
    ) {
      return;
    }

    setRegenerating(true);
    setError(null);
    try {
      const app = apps.find((a) => a.id === test.application_id);

      const result = await generatePlaywrightScript({
        applicationName: app?.name ?? 'Application',
        startUrl: app?.start_url ?? '',
        testName: test.name,
        steps,
        assertions,
      });

      const existing = await getScriptForTest(testId);
      const now = new Date();
      if (existing) {
        await updateScript(existing.id, {
          script_body: result.script,
          generated_by_model: result.model,
          version_hash: String(Date.now()),
          status: 'generated',
          updated_at: now,
        });
      } else {
        await createScript({
          test_id: testId,
          script_body: result.script,
          status: 'generated',
          generated_by_model: result.model,
          version_hash: String(Date.now()),
          created_by: user?.id ?? 'unknown',
          created_at: now,
          updated_at: now,
        });
      }
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not regenerate the script.'
      );
    } finally {
      setRegenerating(false);
    }
  }

  async function saveScript(body: string) {
    if (!script) return;
    setSavingScript(true);
    setError(null);
    try {
      const now = new Date();
      await updateScript(script.id, {
        script_body: body,
        status: 'edited',
        version_hash: String(Date.now()),
        updated_at: now,
      });
      setScript({
        ...script,
        script_body: body,
        status: 'edited',
        updated_at: now,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save the script.'
      );
    } finally {
      setSavingScript(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (!test) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Test not found. <Link to="/tests" className="underline">Back to tests</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={test.name}
            onChange={(e) => setTest({ ...test, name: e.target.value })}
            onBlur={(e) => void patchTest({ name: e.target.value })}
            className="w-full border-0 bg-transparent p-0 text-xl font-semibold text-gray-900 focus:outline-none"
          />
          <input
            value={test.description ?? ''}
            placeholder="What business process does this cover?"
            onChange={(e) => setTest({ ...test, description: e.target.value })}
            onBlur={(e) => void patchTest({ description: e.target.value })}
            className="mt-1 w-full border-0 bg-transparent p-0 text-sm text-gray-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-600">Saved</span>}
          <button
            onClick={() => setShowRun(true)}
            disabled={!connected || steps.length === 0}
            title={
              !connected
                ? 'Connect to Azure AI to execute tests'
                : steps.length === 0
                  ? 'Add at least one step first'
                  : undefined
            }
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Run test
          </button>
          {isRunnerConfigured() && (
            <button
              onClick={async () => {
                setCapturing(true);
                try {
                  const result = await runTestWithScreenshots(
                    { testId, triggeredBy: 'Manual', createdBy: user?.name ?? 'app' },
                    // Called from a click, so a consent popup is allowed here.
                    { interactive: true }
                  );
                  setError(null);
                  navigate(`/runs/${result.runId}`);
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : 'Could not run the test with screenshots.'
                  );
                } finally {
                  setCapturing(false);
                }
              }}
              disabled={capturing || steps.length === 0 || !hasScript}
              className="rounded-md border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                !hasScript
                  ? 'Generate a Playwright script first'
                  : 'Run with Playwright — captures a screenshot per step'
              }
            >
              {capturing ? 'Running…' : 'Run with screenshots'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------ setup */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Setup</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Application</span>
            <select
              value={test.application_id}
              onChange={(e) => void patchTest({ application_id: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Device</span>
            <select
              value={test.device_profile}
              onChange={(e) => void patchTest({ device_profile: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {DEVICE_PROFILES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Sign-in</span>
            <select
              value={test.auth_method}
              onChange={(e) => void patchTest({ auth_method: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="None">Not required</option>
              <option value="FormLogin">Username and password form</option>
              <option value="SSO">Single sign-on</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">State</span>
            <select
              value={test.status}
              onChange={(e) => void patchTest({ status: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="Draft">Draft</option>
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              Tags (comma separated)
            </span>
            <input
              value={test.tags ?? ''}
              onChange={(e) => setTest({ ...test, tags: e.target.value })}
              onBlur={(e) => void patchTest({ tags: e.target.value })}
              placeholder="smoke, patch-validation"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              Timeout (seconds)
            </span>
            <input
              type="number"
              min={30}
              value={test.timeout_seconds}
              onChange={(e) =>
                setTest({ ...test, timeout_seconds: Number(e.target.value) })
              }
              onBlur={(e) =>
                void patchTest({ timeout_seconds: Number(e.target.value) || 300 })
              }
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-2 lg:col-span-2 lg:mt-5">
            <input
              type="checkbox"
              checked={test.capture_screenshot_every_step}
              onChange={(e) =>
                void patchTest({
                  capture_screenshot_every_step: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              Capture a screenshot after every step (evidence for audit)
            </span>
          </label>
        </div>
      </section>

      {/* ------------------------------------------------------------ steps */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Steps</h2>
            <p className="text-xs text-gray-500">
              Describe each action the way you would explain it to a colleague.
            </p>
          </div>
          <div className="flex gap-2">
            {isRunnerConfigured() && (
              <button
                onClick={() => void regenerateScript()}
                disabled={regenerating || steps.length === 0 || !connected}
                className="rounded-md border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  hasScript
                    ? 'Rebuild the Playwright script from the current steps'
                    : 'Generate a Playwright script for these steps'
                }
              >
                {regenerating
                  ? 'Generating…'
                  : hasScript
                    ? 'Regenerate script'
                    : 'Generate script'}
              </button>
            )}
            <button
              onClick={() => void addStep()}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Add step
            </button>
          </div>
        </header>

        {steps.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No steps yet. Add the first one to begin.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {[...steps]
              .sort((a, b) => a.step_number - b.step_number)
              .map((step, index, all) => {
                const needs = actionNeeds(step.action);
                const locator = parseLocator(step.locator_json);
                return (
                  <li key={step.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-2 w-6 shrink-0 text-xs font-medium text-gray-400">
                        {step.step_number}
                      </span>

                      <div className="grid flex-1 gap-2 sm:grid-cols-12">
                        <select
                          value={step.action}
                          onChange={(e) =>
                            void patchStep(step.id, { action: e.target.value })
                          }
                          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none sm:col-span-3"
                        >
                          {ACTIONS.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label}
                            </option>
                          ))}
                        </select>

                        {(needs === 'target' || needs === 'both') && (
                          <input
                            value={step.target ?? ''}
                            placeholder={
                              step.action === 'confirmValue'
                                ? 'the Adding Officer field'
                                : 'the Save button in the invoice dialog'
                            }
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((s) =>
                                  s.id === step.id
                                    ? { ...s, target: e.target.value }
                                    : s
                                )
                              )
                            }
                            onBlur={(e) =>
                              void patchStep(step.id, { target: e.target.value })
                            }
                            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none sm:col-span-5"
                          />
                        )}

                        {(needs === 'value' || needs === 'both') && (
                          <input
                            value={step.value ?? ''}
                            placeholder={
                              step.action === 'navigate'
                                ? 'https://…'
                                : step.action === 'confirmValue'
                                  ? 'Filled; numeric, 6-10 digits (optional)'
                                  : 'value, or {{secret:password}}'
                            }
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((s) =>
                                  s.id === step.id
                                    ? { ...s, value: e.target.value }
                                    : s
                                )
                              )
                            }
                            onBlur={(e) =>
                              void patchStep(step.id, { value: e.target.value })
                            }
                            className={`rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none ${
                              needs === 'both' ? 'sm:col-span-4' : 'sm:col-span-9'
                            }`}
                          />
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 pt-1.5">
                        <button
                          onClick={() => void moveStep(step, -1)}
                          disabled={index === 0}
                          className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => void moveStep(step, 1)}
                          disabled={index === all.length - 1}
                          className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => void removeStep(step)}
                          className="text-xs text-red-500 hover:text-red-700"
                          aria-label="Delete step"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-4 pl-9">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={step.optional}
                          onChange={(e) =>
                            void patchStep(step.id, { optional: e.target.checked })
                          }
                          className="h-3.5 w-3.5 rounded border-gray-300"
                        />
                        Optional
                      </label>

                      {step.action === 'extractText' && (
                        <label className="flex items-center gap-1.5 text-xs text-gray-600">
                          Remember as
                          <input
                            value={step.extract_as ?? ''}
                            placeholder="orderNumber"
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((s) =>
                                  s.id === step.id
                                    ? { ...s, extract_as: e.target.value }
                                    : s
                                )
                              )
                            }
                            onBlur={(e) =>
                              void patchStep(step.id, {
                                extract_as: e.target.value,
                              })
                            }
                            className="w-28 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                          />
                        </label>
                      )}

                      <label className="flex items-center gap-1.5 text-xs text-gray-600">
                        Wait (ms)
                        <input
                          type="number"
                          min={0}
                          value={step.wait_ms ?? ''}
                          onChange={(e) =>
                            setSteps((prev) =>
                              prev.map((s) =>
                                s.id === step.id
                                  ? {
                                      ...s,
                                      wait_ms: e.target.value
                                        ? Number(e.target.value)
                                        : undefined,
                                    }
                                  : s
                              )
                            )
                          }
                          onBlur={(e) =>
                            void patchStep(step.id, {
                              wait_ms: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                          className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                        />
                      </label>

                      {locator && (
                        <span
                          className="text-xs text-gray-400"
                          title={locator.rationale}
                        >
                          Learned locator: {locator.strategy}
                          {locator.name ? ` “${locator.name}”` : ''} ·{' '}
                          {locator.confidence ?? 'Unknown'} confidence
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      {/* ----------------------------------------------------------- script */}
      <ScriptEditor
        script={script}
        saving={savingScript}
        onSave={saveScript}
      />

      {/* ------------------------------------------------------- assertions */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              What must be true afterwards
            </h2>
            <p className="text-xs text-gray-500">
              Critical and Major failures fail the run; Minor only warns.
            </p>
          </div>
          <button
            onClick={() => void addAssertion()}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Add check
          </button>
        </header>

        {assertions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No checks yet. Without at least one, a run only proves the steps did
            not error.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {assertions.map((assertion) => {
              const fields =
                ASSERTION_FIELDS[assertion.type] ?? ASSERTION_FIELDS.textVisible;
              return (
                <li key={assertion.id} className="px-4 py-3">
                  <div className="grid gap-2 sm:grid-cols-12">
                    <select
                      value={assertion.type}
                      onChange={(e) =>
                        void patchAssertion(assertion.id, {
                          type: e.target.value,
                        })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none sm:col-span-3"
                    >
                      {ASSERTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>

                    {fields.target && (
                      <input
                        value={assertion.target ?? ''}
                        placeholder={fields.target}
                        onChange={(e) =>
                          setAssertions((prev) =>
                            prev.map((a) =>
                              a.id === assertion.id
                                ? { ...a, target: e.target.value }
                                : a
                            )
                          )
                        }
                        onBlur={(e) =>
                          void patchAssertion(assertion.id, {
                            target: e.target.value,
                          })
                        }
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none sm:col-span-3"
                      />
                    )}

                    {fields.expected && (
                      <input
                        value={assertion.expected ?? ''}
                        placeholder={fields.expected}
                        onChange={(e) =>
                          setAssertions((prev) =>
                            prev.map((a) =>
                              a.id === assertion.id
                                ? { ...a, expected: e.target.value }
                                : a
                            )
                          )
                        }
                        onBlur={(e) =>
                          void patchAssertion(assertion.id, {
                            expected: e.target.value,
                          })
                        }
                        className={`rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none ${
                          fields.target ? 'sm:col-span-3' : 'sm:col-span-6'
                        }`}
                      />
                    )}

                    <select
                      value={assertion.severity}
                      onChange={(e) =>
                        void patchAssertion(assertion.id, {
                          severity: e.target.value,
                        })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none sm:col-span-2 sm:col-start-10"
                    >
                      <option value="Critical">Critical</option>
                      <option value="Major">Major</option>
                      <option value="Minor">Minor</option>
                    </select>

                    <button
                      onClick={async () => {
                        await deleteAssertion(assertion.id);
                        await refresh();
                      }}
                      className="text-xs text-red-500 hover:text-red-700 sm:col-span-1"
                      aria-label="Delete check"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------- run history */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <header className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Run history</h2>
        </header>
        {runs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            This test has not been run yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {runs.slice(0, 10).map((run) => (
              <li
                key={run.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <Link
                  to={`/runs/${run.id}`}
                  className="text-sm text-blue-700 hover:underline"
                >
                  {formatDateTime(run.started_at)}
                </Link>
                <StatusBadge status={run.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {showRun && (
        <RunTestDialog
          testName={test.name}
          secretKeys={collectSecretKeys(steps)}
          busy={running}
          onCancel={() => setShowRun(false)}
          onRun={(secrets) => void execute(secrets)}
        />
      )}
    </div>
  );
}
