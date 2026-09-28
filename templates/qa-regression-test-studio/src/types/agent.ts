/**
 * The contract between this app and the `regression-test-agent` Foundry agent.
 *
 * These types are a faithful TypeScript rendering of the agent's own
 * `schemaVersion: "1.0"` input and its `TestExecutionResult` output. They are
 * kept in one file, separate from the database entities, because they are an
 * *external* contract: the agent's system prompt is the source of truth, and
 * drifting from it silently produces runs that look fine but assert nothing.
 *
 * The database entities are deliberately NOT reused here. The stored shape is
 * normalized for querying and history; the wire shape is nested for the agent.
 * `testDefinition.ts` converts between the two.
 */

/** ---------------------------------------------------------------- input -- */

export interface AgentLocator {
  strategy: 'role' | 'label' | 'testId' | 'placeholder' | 'text' | 'css';
  role?: string;
  name?: string;
  text?: string;
  value?: string;
  selector?: string;
  within?: string;
  exact?: boolean;
  confidence?: 'High' | 'Medium' | 'Low';
  matchCount?: number;
  healed?: boolean;
  rationale?: string;
}

export interface AgentStep {
  stepNumber: number;
  action: string;
  target?: string;
  value?: string;
  notes?: string;
  waitMs?: number;
  optional?: boolean;
  extractAs?: string;
  /** Previously resolved locator, replayed so the agent need not re-resolve. */
  resolvedLocator?: AgentLocator;
}

export interface AgentAssertion {
  assertionNumber: number;
  type: string;
  target?: string;
  expected?: string;
  severity: 'Critical' | 'Major' | 'Minor';
  description?: string;
}

export interface AgentTestDefinition {
  schemaVersion: '1.0';
  testId: number;
  name: string;
  description?: string;
  application: { name: string; startUrl: string };
  device: { profile: string };
  authentication: { required: boolean; method: string };
  steps: AgentStep[];
  assertions: AgentAssertion[];
  timeoutSeconds: number;
  captureScreenshotEveryStep: boolean;
  tags: string[];
}

export interface AgentRequestPayload {
  testDefinition: AgentTestDefinition;
  /** `{{secret:key}}` substitutions. Never persisted — see `runTest`. */
  secrets: Record<string, string>;
}

/** --------------------------------------------------------------- output -- */

export interface AgentStepResult {
  stepNumber: number;
  action: string;
  target: string | null;
  status: 'Passed' | 'Failed' | 'Skipped';
  observation: string;
  screenshotRef: string | null;
  durationSeconds: number;
  resolvedLocator?: AgentLocator | null;
}

export interface AgentAssertionResult {
  assertionNumber: number;
  status: 'Passed' | 'Failed';
  expected: string;
  actual: string;
  severity: 'Critical' | 'Major' | 'Minor';
}

export interface AgentTestResult {
  testId: number;
  status: 'Passed' | 'Failed' | 'Error';
  durationSeconds: number;
  stepResults: AgentStepResult[];
  assertionResults: AgentAssertionResult[];
  failedStepNumber: number | null;
  failureReason: string | null;
  summary: string;
}
