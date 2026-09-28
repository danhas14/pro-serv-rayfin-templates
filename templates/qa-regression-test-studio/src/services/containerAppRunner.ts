/**
 * Client for the Container App Playwright runner.
 *
 * The runner executes the generated Playwright script on the official Playwright
 * image, captures a screenshot per step to OneLake, and writes results straight
 * to the SQL database — so results appear in run history with no callback.
 *
 * This replaces the Fabric notebook path. A Python notebook cannot drive
 * Chromium: Spark nodes lack the browser's system libraries, installing them
 * needs sudo, and Python notebooks cannot attach a custom Environment.
 *
 * Unlike the agent path, the call is synchronous — it returns once the run has
 * finished, which for a typical test is well under a minute.
 */
import { getRunnerToken } from '@/services/entraAuth';

export function getRunnerUrl(): string {
  return (import.meta.env.VITE_RUNNER_URL ?? '').replace(/\/+$/, '');
}

export function isRunnerConfigured(): boolean {
  return getRunnerUrl().length > 0;
}

export interface RunnerParams {
  testId: string;
  triggeredBy?: string;
  suiteRunId?: string;
  suiteName?: string;
  createdBy?: string;
}

export interface RunnerResult {
  runId: string;
  status: string;
  durationSeconds: number;
  stepsPassed: number;
  stepsFailed: number;
}

interface RunnerResponse {
  run_id: string;
  status: string;
  duration_seconds: number;
  steps_passed: number;
  steps_failed: number;
}

/**
 * Execute one test and wait for the result.
 *
 * `interactive` may only be true when called from a click handler — acquiring a
 * token interactively opens a popup, which browsers block otherwise.
 */
export async function runTestWithScreenshots(
  params: RunnerParams,
  opts: { interactive?: boolean } = {}
): Promise<RunnerResult> {
  const base = getRunnerUrl();
  if (!base) {
    throw new Error(
      'The screenshot runner is not configured. Set VITE_RUNNER_URL in .env.'
    );
  }

  const token = await getRunnerToken({ interactive: opts.interactive });

  const response = await fetch(`${base}/runs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      test_id: params.testId,
      triggered_by: params.triggeredBy ?? 'Manual',
      suite_run_id: params.suiteRunId ?? null,
      suite_name: params.suiteName ?? null,
      created_by: params.createdBy ?? 'app',
    }),
  });

  if (!response.ok) {
    // Easy Auth rejects before the app is reached and returns no JSON body, so
    // 401 needs its own message or the user sees an empty parse failure.
    if (response.status === 401) {
      throw new Error(
        'The runner rejected your sign-in. Sign in again, then retry.'
      );
    }
    const body = await response.text();
    throw new Error(
      `The screenshot run failed (HTTP ${response.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as RunnerResponse;
  return {
    runId: data.run_id,
    status: data.status,
    durationSeconds: data.duration_seconds,
    stepsPassed: data.steps_passed,
    stepsFailed: data.steps_failed,
  };
}
