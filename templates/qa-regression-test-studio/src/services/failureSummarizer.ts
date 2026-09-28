/**
 * Turns Playwright's failure output into something a business analyst can act on.
 *
 * A failed step is reported as a call log — selectors, DOM fragments, retry
 * traces. That is the right level of detail for debugging and the wrong one for
 * the people who own these tests. This asks the same Foundry model the script
 * generator uses to restate the outcome in plain language.
 *
 * One call covers the whole run rather than one per step, because the useful
 * diagnosis is usually cross-cutting: six steps timing out for the same reason
 * is one finding, not six.
 *
 * NOTE ON DATA: the observations passed here contain fragments of the page
 * under test, so they leave the tenant for the AI service. Secret values are
 * already redacted by the runner before anything is persisted, but a page from
 * an internal application may still include real business data. Observations
 * are truncated to limit that exposure; if a target application renders
 * sensitive records, summarise it with care.
 */
import { getAgentConfig } from '@/config/agentConfig';
import { getAiToken } from '@/services/entraAuth';

/** Enough to diagnose a failure, short enough to limit what is sent. */
const MAX_OBSERVATION_CHARS = 1200;

const SYSTEM_PROMPT = `You explain automated web test failures to business
analysts who do not read code.

Rules:
1. Never use technical vocabulary: no selector, locator, DOM, iframe, XPath,
   CSS, timeout, exception, stack trace, or element ids.
2. Say what the test was trying to do, and what stopped it.
3. Name the cause only when the evidence supports it. Common real causes:
   - a cookie banner, chat widget, or pop-up covering the control
   - a bot-detection or CAPTCHA challenge blocking automation
   - a button or link that was renamed, moved, or removed
   - the page not finishing loading in time
   - the site requiring a sign-in that the test did not perform
4. If the evidence does not show a cause, say what was observed and that the
   cause is unclear. Never guess.
5. When many steps failed for the same reason, say so once in the overall
   explanation instead of repeating it per step.
6. Write for someone deciding "is our application broken?" — if the failure is
   the test's own fault or the site blocking automation, say so plainly,
   because that means the application itself may be fine.
7. Two sentences maximum per step. Three maximum overall.

Return ONLY JSON, no markdown fence:
{"overall": "...", "steps": [{"step": <number>, "plain": "..."}]}`;

export interface StepToSummarize {
  step_number: number;
  action: string;
  target?: string;
  status: string;
  observation?: string;
}

export interface FailureSummary {
  overall: string;
  steps: Record<number, string>;
}

/**
 * Parse the model's reply into a summary, tolerating a markdown fence.
 *
 * Exported for tests: this is the part that breaks when a model drifts, and it
 * must never throw into the run detail page.
 */
export function parseSummaryResponse(content: string): FailureSummary | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = (fenced ? fenced[1] : content).trim();

  try {
    const parsed = JSON.parse(raw) as {
      overall?: unknown;
      steps?: Array<{ step?: unknown; plain?: unknown }>;
    };

    const overall = typeof parsed.overall === 'string' ? parsed.overall.trim() : '';
    const steps: Record<number, string> = {};
    for (const entry of parsed.steps ?? []) {
      if (typeof entry.step === 'number' && typeof entry.plain === 'string') {
        steps[entry.step] = entry.plain.trim();
      }
    }

    if (!overall && Object.keys(steps).length === 0) return null;
    return { overall, steps };
  } catch {
    return null;
  }
}

/**
 * Summarise a run's failures. Returns null when the model is unavailable or
 * replies with something unusable — the caller keeps showing the raw text.
 */
export async function summarizeFailures(
  testName: string,
  runStatus: string,
  steps: StepToSummarize[]
): Promise<FailureSummary | null> {
  const relevant = steps.filter((s) => s.status !== 'Passed');
  if (relevant.length === 0) return null;

  const { endpoint } = getAgentConfig();
  const accountUrl = endpoint.match(
    /https:\/\/[^/]+\.services\.ai\.azure\.com/
  )?.[0];
  if (!accountUrl) return null;

  const token = await getAiToken();
  const chatUrl = `${accountUrl}/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2025-04-01-preview`;

  const stepLines = relevant
    .map((s) => {
      const observation = (s.observation ?? '').slice(0, MAX_OBSERVATION_CHARS);
      return [
        `Step ${s.step_number} (${s.status})`,
        `  intent: ${s.action}${s.target ? ` — ${s.target}` : ''}`,
        `  result: ${observation || 'no detail recorded'}`,
      ].join('\n');
    })
    .join('\n\n');

  const response = await fetch(chatUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Test: ${testName}\nOutcome: ${runStatus}\n\n${stepLines}`,
        },
      ],
      max_tokens: 1200,
      temperature: 0.1,
    }),
  });

  if (!response.ok) return null;

  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = result.choices?.[0]?.message?.content ?? '';
  return parseSummaryResponse(content);
}
