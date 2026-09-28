/**
 * The evidence view for a single run — the replacement for the customer's
 * Excel sheet plus folder of screenshots.
 *
 * The agent's plain-language `summary` leads, because the first question after
 * a failure is "did the business process work, and if not where did it break",
 * not "which selector was used". The step-by-step detail sits underneath for
 * whoever needs to dig in.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ScreenshotLink } from '@/components/ScreenshotLink';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime, formatDuration } from '@/lib/format';
import { parseLocator } from '@/lib/testDefinition';
import {
  getRun,
  getTest,
  listAssertionResults,
  listStepResults,
  updateRun,
  updateStepResult,
  type AssertionResultRow,
  type RunRow,
  type StepResultRow,
  type TestRow,
} from '@/services/testStore';
import { summarizeFailures } from '@/services/failureSummarizer';

export function RunDetailPage() {
  const { runId = '' } = useParams();
  const [run, setRun] = useState<RunRow | null>(null);
  const [test, setTest] = useState<TestRow | null>(null);
  const [steps, setSteps] = useState<StepResultRow[]>([]);
  const [assertions, setAssertions] = useState<AssertionResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  // Guards against a second call under StrictMode's double mount.
  const summarizeStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const found = await getRun(runId);
      if (cancelled) return;
      setRun(found);
      if (!found) return;

      const [t, s, a] = await Promise.all([
        getTest(found.test_id),
        listStepResults(runId),
        listAssertionResults(runId),
      ]);
      if (cancelled) return;
      setTest(t);
      setSteps(s);
      setAssertions(a);
    }

    load()
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load the run.')
      )
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [runId]);

  // Explain a failure in plain language on first view, then keep the result.
  // Failure here is never surfaced: the raw output is already on screen, so a
  // model that is unavailable costs readability, not information.
  useEffect(() => {
    if (!run || run.status === 'Passed' || run.plain_summary) return;
    if (steps.length === 0 || summarizeStarted.current) return;

    summarizeStarted.current = true;
    let cancelled = false;
    setSummarizing(true);

    summarizeFailures(test?.name ?? 'Test', run.status, steps)
      .then(async (summary) => {
        if (!summary) return;

        const overall = summary.overall.slice(0, 4000);
        const explained = steps.filter((s) => summary.steps[s.step_number]);

        await Promise.all([
          overall ? updateRun(run.id, { plain_summary: overall }) : null,
          ...explained.map((s) =>
            updateStepResult(s.id, {
              plain_observation: summary.steps[s.step_number].slice(0, 1000),
            })
          ),
        ]);

        if (cancelled) return;
        if (overall) setRun((r) => (r ? { ...r, plain_summary: overall } : r));
        setSteps((prev) =>
          prev.map((s) =>
            summary.steps[s.step_number]
              ? {
                  ...s,
                  plain_observation: summary.steps[s.step_number].slice(0, 1000),
                }
              : s
          )
        );
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setSummarizing(false));

    return () => {
      cancelled = true;
    };
  }, [run, steps, test]);

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;

  if (error || !run) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error ?? 'Run not found.'}{' '}
        <Link to="/runs" className="underline">
          Back to run history
        </Link>
      </div>
    );
  }

  const healedCount = steps.filter((s) => s.healed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {test?.name ?? 'Run'}
            </h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {formatDateTime(run.started_at)} · {formatDuration(run.duration_seconds)}{' '}
            · triggered {run.triggered_by.toLowerCase()}
            {run.suite_name ? ` · suite “${run.suite_name}”` : ''}
          </p>
        </div>
        {test && (
          <Link
            to={`/tests/${test.id}`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Open test
          </Link>
        )}
      </div>

      {(run.summary || run.plain_summary || summarizing) && (
        <section
          className={`rounded-xl border p-4 ${
            run.status === 'Passed'
              ? 'border-emerald-200 bg-emerald-50'
              : run.status === 'Error'
                ? 'border-amber-200 bg-amber-50'
                : 'border-red-200 bg-red-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">What happened</h2>
            {run.plain_summary && (
              <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                AI summary
              </span>
            )}
          </div>

          {run.plain_summary ? (
            <p className="mt-1.5 text-sm text-gray-800">{run.plain_summary}</p>
          ) : summarizing ? (
            <p className="mt-1.5 text-sm text-gray-500">
              Summarising what went wrong…
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-gray-800">{run.summary}</p>
          )}

          {(run.plain_summary || run.failure_reason) && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                Technical detail
              </summary>
              {run.plain_summary && run.summary && (
                <p className="mt-1.5 text-sm text-gray-700">{run.summary}</p>
              )}
              {run.failure_reason && (
                <p className="mt-1.5 break-words text-sm text-gray-700">
                  <span className="font-medium">Reason: </span>
                  {run.failure_reason}
                  {run.failed_step_number != null &&
                    ` (step ${run.failed_step_number})`}
                </p>
              )}
            </details>
          )}
        </section>
      )}

      {healedCount > 0 && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <strong className="font-semibold">
            {healedCount} step{healedCount === 1 ? '' : 's'} self-healed.
          </strong>{' '}
          The stored locator no longer matched, so the agent found the element
          again and the test was updated. Usually this means the application's
          user interface changed.
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <header className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Steps</h2>
        </header>
        {steps.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No step detail was recorded for this run.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {steps.map((step) => {
              const locator = parseLocator(step.locator_json);
              return (
                <li key={step.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-6 shrink-0 text-xs font-medium text-gray-400">
                      {step.step_number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {step.action}
                        </span>
                        {step.target && (
                          <span className="text-sm text-gray-500">
                            — {step.target}
                          </span>
                        )}
                        <StatusBadge status={step.status} />
                        {step.healed && (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
                            healed
                          </span>
                        )}
                      </div>

                      {step.plain_observation ? (
                        <>
                          <p className="mt-1 text-sm text-gray-700">
                            {step.plain_observation}
                          </p>
                          {step.observation && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                                Technical detail
                              </summary>
                              <p className="mt-1 break-words text-xs text-gray-500">
                                {step.observation}
                              </p>
                            </details>
                          )}
                        </>
                      ) : (
                        step.observation && (
                          <p className="mt-1 break-words text-sm text-gray-600">
                            {step.observation}
                          </p>
                        )
                      )}

                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>{formatDuration(step.duration_seconds)}</span>
                        {locator && (
                          <span title={locator.rationale}>
                            {locator.strategy}
                            {locator.name ? ` “${locator.name}”` : ''} ·{' '}
                            {step.locator_confidence ?? 'Unknown'} confidence
                          </span>
                        )}
                        {step.screenshot_url ? (
                          <ScreenshotLink
                            runId={run.id}
                            screenshotUrl={step.screenshot_url}
                          />
                        ) : step.screenshot_ref ? (
                          <span title="Screenshot identifier returned by the agent">
                            screenshot: {step.screenshot_ref}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <header className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Checks</h2>
        </header>
        {assertions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No checks were evaluated.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Result</th>
                <th className="px-4 py-2 font-medium">Severity</th>
                <th className="px-4 py-2 font-medium">Expected</th>
                <th className="px-4 py-2 font-medium">Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assertions.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-2 text-gray-400">
                    {a.assertion_number}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={a.severity} />
                  </td>
                  <td className="px-4 py-2 text-gray-600">{a.expected ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{a.actual ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
