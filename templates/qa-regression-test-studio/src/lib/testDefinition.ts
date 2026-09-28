/**
 * Conversion between the normalized database rows and the agent's wire format.
 *
 * Kept separate from both the store and the client so the agent's contract can
 * be re-checked against its system prompt in one place. The mapping is
 * intentionally lossless in the direction that matters: every field the agent
 * understands is populated from a column, and every field it returns has
 * somewhere to land.
 */
import type {
  AgentAssertion,
  AgentLocator,
  AgentStep,
  AgentTestDefinition,
} from '@/types/agent';
import type { AssertionRow, FullTest, StepRow } from '@/services/testStore';

/** Parse a persisted locator, tolerating a corrupt value rather than throwing. */
export function parseLocator(json?: string | null): AgentLocator | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as AgentLocator;
    return parsed?.strategy ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A stable numeric id for the agent's `testId` field.
 *
 * The agent's schema types `testId` as a number while our primary keys are
 * UUIDs, so a deterministic 31-bit hash bridges the two. It is used only to
 * correlate the reply with the request — the UUID remains the real identity, so
 * a collision would be cosmetic rather than corrupting.
 */
export function numericTestId(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (hash << 5) - hash + uuid.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function toAgentStep(row: StepRow): AgentStep {
  const step: AgentStep = {
    stepNumber: row.step_number,
    action: row.action,
  };
  // Only emit fields that carry a value: the agent treats an explicit `null`
  // target differently from an absent one on `screenshot`-style steps.
  if (row.target) step.target = row.target;
  if (row.value) step.value = row.value;
  if (row.notes) step.notes = row.notes;
  if (typeof row.wait_ms === 'number') step.waitMs = row.wait_ms;
  if (row.optional) step.optional = true;
  if (row.extract_as) step.extractAs = row.extract_as;

  const locator = parseLocator(row.locator_json);
  if (locator) step.resolvedLocator = locator;

  return step;
}

function toAgentAssertion(row: AssertionRow): AgentAssertion {
  const assertion: AgentAssertion = {
    assertionNumber: row.assertion_number,
    type: row.type,
    severity: (row.severity as AgentAssertion['severity']) ?? 'Major',
  };
  if (row.target) assertion.target = row.target;
  if (row.expected) assertion.expected = row.expected;
  if (row.description) assertion.description = row.description;
  return assertion;
}

/** Project stored rows into the agent's `schemaVersion: "1.0"` definition. */
export function buildTestDefinition(full: FullTest): AgentTestDefinition {
  const { test, application, steps, assertions } = full;

  return {
    schemaVersion: '1.0',
    testId: numericTestId(test.id),
    name: test.name,
    description: test.description ?? undefined,
    application: {
      name: application.name,
      startUrl: application.start_url,
    },
    device: { profile: test.device_profile },
    authentication: {
      required: test.auth_method !== 'None',
      method: test.auth_method,
    },
    steps: [...steps]
      .sort((a, b) => a.step_number - b.step_number)
      .map(toAgentStep),
    assertions: [...assertions]
      .sort((a, b) => a.assertion_number - b.assertion_number)
      .map(toAgentAssertion),
    timeoutSeconds: test.timeout_seconds,
    captureScreenshotEveryStep: test.capture_screenshot_every_step,
    tags: (test.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

/**
 * Collect the `{{secret:key}}` tokens a test refers to.
 *
 * Used to prompt for exactly the credentials a run needs — and no others — so
 * an analyst is never asked for a password a test does not actually use.
 */
export function collectSecretKeys(steps: StepRow[]): string[] {
  const keys = new Set<string>();
  const pattern = /\{\{secret:([A-Za-z0-9_.-]+)\}\}/g;

  for (const step of steps) {
    for (const field of [step.value, step.target]) {
      if (!field) continue;
      for (const match of field.matchAll(pattern)) keys.add(match[1]);
    }
  }
  return [...keys].sort();
}
