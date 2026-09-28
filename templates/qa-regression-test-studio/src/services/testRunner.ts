/**
 * Orchestrates one test run end to end: build the payload, call the agent,
 * persist the evidence, and feed healed locators back into the test.
 *
 * The run row is written *before* the agent is called, with status `Running`.
 * That ordering matters — an agent call can take minutes, and if the browser
 * tab is closed halfway through, a `Running` row that never completes is a
 * truthful record of an abandoned run. Writing the row only on success would
 * silently lose it.
 *
 * Failures are also persisted rather than thrown away. A run that could not be
 * carried out is recorded as `Error` with the reason attached, because "the
 * test never ran" is itself something the customer needs to see in the failure
 * report instead of discovering an unexplained gap in the history.
 */
import { AgentContractError, AgentInvocationError, invokeAgent } from './agentClient';
import {
  createAssertionResult,
  createRun,
  createStepResult,
  getFullTest,
  listSuiteMembers,
  updateRun,
  updateStep,
  updateSuite,
  updateTest,
  type RunRow,
} from './testStore';
import { buildTestDefinition } from '@/lib/testDefinition';
import type { AgentTestResult } from '@/types/agent';

export interface RunOptions {
  /** Entra subject claim of the person or process launching the run. */
  createdBy: string;
  /** `{{secret:key}}` values. Held in memory only; never persisted. */
  secrets?: Record<string, string>;
  triggeredBy?: 'Manual' | 'Scheduled' | 'Api';
  suiteRunId?: string;
  suiteName?: string;
  signal?: AbortSignal;
}

/** Truncate to a column's limit so one long field cannot fail the whole write. */
function fit(value: string | null | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * Build a function that strips any secret value out of text before it is
 * stored.
 *
 * The agent is *instructed* never to reproduce a secret, but an instruction to
 * a language model is guidance, not a control: a `type` step whose value is a
 * password can easily come back as an observation quoting what was typed. These
 * runs use real credentials for the applications under test, and the run
 * history is shared across the team and exported to CSV, so a single leaked
 * value would be durable and widely readable.
 *
 * This is the enforcement the instruction cannot provide. Values are sorted
 * longest-first so an overlapping shorter secret cannot partially mask a longer
 * one, and very short values are skipped because redacting a two-character
 * string would corrupt unrelated text without protecting anything meaningful.
 *
 * Exported for testing — a security control with no test is a hope.
 */
export function makeRedactor(
  secrets: Record<string, string>
): (t?: string) => string | undefined {
  const entries = Object.entries(secrets)
    .filter(([, value]) => typeof value === 'string' && value.length >= 4)
    .sort((a, b) => b[1].length - a[1].length);

  if (entries.length === 0) return (text) => text;

  return (text) => {
    if (!text) return text;
    let out = text;
    for (const [key, value] of entries) {
      out = out.split(value).join(`<secret:${key}>`);
    }
    return out;
  };
}

/**
 * Persist the agent's per-step and per-assertion detail.
 *
 * Written sequentially rather than in parallel: each is a separate GraphQL
 * mutation, and firing forty at once against the data endpoint is a reliable
 * way to get throttled halfway through and end up with partial evidence.
 */
async function persistResult(
  runId: string,
  result: AgentTestResult,
  redact: (text?: string) => string | undefined
): Promise<void> {
  for (const step of result.stepResults) {
    const locator = step.resolvedLocator ?? null;
    await createStepResult({
      run_id: runId,
      step_number: step.stepNumber,
      action: fit(step.action, 32) ?? 'unknown',
      target: fit(redact(step.target ?? undefined), 1000),
      status: step.status ?? 'Skipped',
      observation: fit(redact(step.observation), 4000),
      screenshot_ref: fit(step.screenshotRef, 1000),
      duration_seconds: step.durationSeconds ?? undefined,
      locator_json: locator
        ? fit(redact(JSON.stringify(locator)), 2000)
        : undefined,
      locator_confidence: fit(locator?.confidence, 16),
      // Only a step that actually ran can have healed. The agent may report a
      // locator with `healed: true` on a Skipped step — it re-resolved the
      // target, did not find it, and skipped. Recording that as healing would
      // raise the "the UI changed" alarm on a step that never executed, which
      // is the fastest way to teach people to ignore the alarm.
      healed: locator?.healed === true && step.status === 'Passed',
    });
  }

  for (const assertion of result.assertionResults) {
    await createAssertionResult({
      run_id: runId,
      assertion_number: assertion.assertionNumber,
      status: assertion.status ?? 'Failed',
      expected: fit(redact(assertion.expected), 2000),
      actual: fit(redact(assertion.actual), 2000),
      severity: fit(assertion.severity, 16) ?? 'Major',
    });
  }
}

/**
 * Write newly resolved locators back onto the test definition.
 *
 * This is the self-healing loop and the reason the suite survives the
 * customer's application upgrades without developer involvement: once the agent
 * has worked out that "the Save button" is now `role=button name=Save changes`,
 * that knowledge is stored on the step and replayed on every later run, so the
 * language model is doing discovery work once rather than every time.
 *
 * Only locators from steps that actually passed are stored — persisting a
 * locator from a failed step would bake a wrong guess into the test.
 */
async function healLocators(
  stepIdByNumber: Map<number, string>,
  result: AgentTestResult
): Promise<number> {
  let healed = 0;

  for (const step of result.stepResults) {
    if (step.status !== 'Passed') continue;

    const locator = step.resolvedLocator;
    if (!locator?.strategy) continue;

    const stepId = stepIdByNumber.get(step.stepNumber);
    if (!stepId) continue;

    await updateStep(stepId, {
      locator_json: fit(JSON.stringify(locator), 2000),
      locator_confidence: fit(locator.confidence, 16),
    });
    if (locator.healed) healed++;
  }

  return healed;
}

/** Execute one test and return the completed run row. */
export async function runTest(
  testId: string,
  opts: RunOptions
): Promise<RunRow> {
  const full = await getFullTest(testId);
  if (!full) {
    throw new Error('Test not found, or its application has been deleted.');
  }
  if (full.steps.length === 0) {
    throw new Error('This test has no steps yet, so there is nothing to run.');
  }

  const startedAt = new Date();
  const redact = makeRedactor(opts.secrets ?? {});
  const run = await createRun({
    test_id: testId,
    suite_run_id: opts.suiteRunId,
    suite_name: opts.suiteName,
    status: 'Running',
    triggered_by: opts.triggeredBy ?? 'Manual',
    started_at: startedAt,
    created_by: opts.createdBy,
  });

  try {
    const { result, responseId } = await invokeAgent(
      {
        testDefinition: buildTestDefinition(full),
        secrets: opts.secrets ?? {},
      },
      { signal: opts.signal }
    );

    await persistResult(run.id, result, redact);

    const stepIdByNumber = new Map(
      full.steps.map((s) => [s.step_number, s.id])
    );
    await healLocators(stepIdByNumber, result);

    const completedAt = new Date();
    const patch = {
      status: result.status,
      completed_at: completedAt,
      duration_seconds:
        result.durationSeconds ||
        (completedAt.getTime() - startedAt.getTime()) / 1000,
      failed_step_number: result.failedStepNumber ?? undefined,
      failure_reason: fit(redact(result.failureReason ?? undefined), 2000),
      summary: fit(redact(result.summary), 4000),
      agent_response_id: fit(responseId, 200),
    };
    await updateRun(run.id, patch);

    await updateTest(testId, {
      last_run_status: result.status,
      last_run_at: completedAt,
    });

    return { ...run, ...patch };
  } catch (err) {
    // An `Error` status means the test could not be carried out — an agent,
    // browser, or network problem — as opposed to `Failed`, which means the
    // application under test misbehaved. Keeping them distinct is what makes
    // the failure report trustworthy.
    //
    // `err.identity` is deliberately not read here: identity claims about the
    // signed-in user must not land in the shared run history or the CSV export.
    const reason =
      err instanceof AgentInvocationError
        ? [err.message, err.detail].filter(Boolean).join(' ')
        : err instanceof AgentContractError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unknown error executing the test.';

    const safeReason = redact(reason) ?? 'Unknown error executing the test.';

    const completedAt = new Date();
    const patch = {
      status: 'Error',
      completed_at: completedAt,
      duration_seconds: (completedAt.getTime() - startedAt.getTime()) / 1000,
      failure_reason: fit(safeReason, 2000),
      summary: fit(`The test could not be executed. ${safeReason}`, 4000),
    };
    await updateRun(run.id, patch);
    await updateTest(testId, {
      last_run_status: 'Error',
      last_run_at: completedAt,
    });

    return { ...run, ...patch };
  }
}

export interface SuiteRunProgress {
  completed: number;
  total: number;
  current?: string;
}

/**
 * Execute every test in a suite, one after another.
 *
 * Sequential on purpose. The tests share a single Browser Automation tool and
 * often the same application login, so running them concurrently produces
 * interference that looks like a product defect — exactly the false positive
 * that erodes trust in an automated suite.
 */
export async function runSuite(
  suiteId: string,
  suiteName: string,
  opts: RunOptions & { onProgress?: (p: SuiteRunProgress) => void }
): Promise<RunRow[]> {
  const members = await listSuiteMembers(suiteId);
  const suiteRunId = crypto.randomUUID();
  const runs: RunRow[] = [];

  for (const [index, member] of members.entries()) {
    opts.onProgress?.({ completed: index, total: members.length });

    if (opts.signal?.aborted) break;

    const run = await runTest(member.test_id, {
      ...opts,
      suiteRunId,
      suiteName,
      triggeredBy: opts.triggeredBy ?? 'Manual',
    });
    runs.push(run);
  }

  opts.onProgress?.({ completed: runs.length, total: members.length });

  // Worst outcome wins, so a suite is never reported greener than its contents.
  const status = runs.some((r) => r.status === 'Error')
    ? 'Error'
    : runs.some((r) => r.status === 'Failed')
      ? 'Failed'
      : 'Passed';

  await updateSuite(suiteId, {
    last_run_at: new Date(),
    last_run_status: status,
  });

  return runs;
}
