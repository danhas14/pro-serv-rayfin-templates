/**
 * Calls a Foundry model to generate a Playwright Python script from
 * plain-language test steps extracted from an uploaded document.
 *
 * The prompt is structured so the generated script:
 * - Uses pytest + playwright (sync API)
 * - Captures a screenshot after every significant step
 * - Returns results as JSON to stdout so the runner notebook can parse them
 * - Uses accessible locator strategies (role, label, text) over CSS/XPath
 */
import { getAgentConfig } from '@/config/agentConfig';
import { parseLocator } from '@/lib/testDefinition';
import { getAiToken } from '@/services/entraAuth';

const SYSTEM_PROMPT = `You are a Playwright test script generator.

You receive a structured description of a manual test (application name, URL,
ordered steps, and the checks that must hold) and you produce a single Python
script that automates it using Playwright's sync API.

Each step gives you an explicit action, and optionally the element to act on,
a value, a note, and a locator already proven to work against the live site.

ACTIONS, and what each must produce:
- navigate      go to the value (a URL)
- click         click the element
- type          fill the element with the value
- select        choose the value from the dropdown element
- confirmValue  read the element and check it matches the value; when the
                value is blank or "Empty", assert only that it is non-empty
- waitForText   wait until the value's text appears on the element or page
- waitForElement wait until the element appears
- extractText   read the element's text and keep it for later steps
- hover         hover over the element
- press         press the key named in the value
- screenshot    capture a screenshot only

ASSERTION TYPES:
- urlContains   the current URL contains the expected text
- textVisible / textNotVisible   expected text is / is not on the page
- elementVisible  the target element is present
- confirmValue  the target's value matches the expected description, or is
                merely non-empty when no expectation is given
- valueEquals   the target's value equals expected exactly
- noErrorsDisplayed  no error message is shown

RULES:
1. Use \`playwright.sync_api\` (not async).
2. When a step supplies a "proven locator", use it verbatim — it was resolved
   against the real site. Otherwise use accessible locators (get_by_role,
   get_by_label, get_by_text, get_by_placeholder) first, and fall back to CSS
   only when accessibility attributes are unavailable.
3. After every significant action (click, type, select, verify), capture a
   screenshot with \`page.screenshot(path=f"step_{n}.png")\` where n is the step
   number.
4. For each step, print a JSON line to stdout:
   \`{"step": n, "action": "...", "target": "...", "status": "Passed|Failed",
     "observation": "...", "screenshot": "step_n.png"}\`
5. Wrap each step in a try/except so one failure does not prevent the remaining
   steps from running. On failure, capture a screenshot and print a Failed line.
6. At the end, print a summary JSON line:
   \`{"summary": "...", "status": "Passed|Failed", "total_steps": n,
     "passed": n, "failed": n}\`
7. Accept these command-line arguments via argparse:
   - \`--start-url\`: the application's start URL
   - \`--screenshot-dir\`: directory to save screenshots (default: ./screenshots)
   - \`--headless\`: run headless (default: true)
   - Any \`--secret-KEY=VALUE\` arguments for credential substitution
8. Use \`{{secret:KEY}}\` placeholders in the script for credentials. At runtime
   the runner replaces them with values read from Azure Key Vault.
9. DO NOT hardcode any URLs, usernames, or passwords.
10. Output ONLY the Python script. No markdown fences, no explanation.`;

export interface ScriptStepInput {
  step_number: number;
  action: string;
  target?: string;
  value?: string;
  notes?: string;
  wait_ms?: number;
  optional?: boolean;
  extract_as?: string;
  /** Locator the agent resolved on a previous run, as stored JSON. */
  locator_json?: string;
}

export interface ScriptAssertionInput {
  assertion_number: number;
  type: string;
  target?: string;
  expected?: string;
  severity: string;
  description?: string;
}

export interface GenerateScriptInput {
  applicationName: string;
  startUrl: string;
  testName: string;
  steps: ScriptStepInput[];
  assertions?: ScriptAssertionInput[];
}

export interface GenerateScriptResult {
  script: string;
  model: string;
}

/** Render a previously resolved locator as a Playwright-shaped hint. */
function describeLocator(locatorJson?: string): string | null {
  const locator = parseLocator(locatorJson);
  if (!locator) return null;

  switch (locator.strategy) {
    case 'role':
      return `get_by_role("${locator.role ?? 'button'}", name="${locator.name ?? ''}")`;
    case 'label':
      return `get_by_label("${locator.name ?? locator.text ?? ''}")`;
    case 'placeholder':
      return `get_by_placeholder("${locator.name ?? locator.text ?? ''}")`;
    case 'text':
      return `get_by_text("${locator.text ?? locator.name ?? ''}")`;
    case 'testId':
      return `get_by_test_id("${locator.value ?? locator.name ?? ''}")`;
    case 'css':
      return locator.selector ? `locator("${locator.selector}")` : null;
    default:
      return null;
  }
}

/**
 * Render the test as text for the model.
 *
 * Every field a step carries is emitted explicitly. An earlier version
 * collapsed each step to `target || value || action`, which silently dropped
 * the action verb whenever a target existed, and dropped the value whenever
 * both were set — so "type «user@contoso.com» into «Email»" reached the model
 * as just "Email", and it had to guess the rest.
 *
 * Exported for tests: this is the contract between the editor and the model.
 */
export function describeTest(
  steps: ScriptStepInput[],
  assertions: ScriptAssertionInput[] = []
): string {
  const stepLines = [...steps]
    .sort((a, b) => a.step_number - b.step_number)
    .map((s, index) => {
      const lines = [
        `Step ${index + 1} [${s.action}]${s.optional ? ' (optional — skip if missing)' : ''}`,
      ];
      if (s.target) lines.push(`  element: ${s.target}`);
      if (s.value) lines.push(`  value: ${s.value}`);
      if (s.extract_as) lines.push(`  remember result as: {{${s.extract_as}}}`);
      if (s.wait_ms) lines.push(`  wait after: ${s.wait_ms}ms`);
      if (s.notes) lines.push(`  note: ${s.notes}`);

      const proven = describeLocator(s.locator_json);
      if (proven) lines.push(`  proven locator: ${proven}`);

      return lines.join('\n');
    });

  const assertionLines = [...assertions]
    .sort((a, b) => a.assertion_number - b.assertion_number)
    .map((a, index) => {
      const lines = [`Check ${index + 1} [${a.type}] severity=${a.severity}`];
      if (a.target) lines.push(`  element: ${a.target}`);
      if (a.expected) lines.push(`  expected: ${a.expected}`);
      if (a.description) lines.push(`  note: ${a.description}`);
      return lines.join('\n');
    });

  const sections = [`STEPS:\n${stepLines.join('\n\n')}`];
  if (assertionLines.length > 0) {
    sections.push(
      `CHECKS (verify these at the end, each as its own reported step):\n` +
        assertionLines.join('\n\n')
    );
  }
  return sections.join('\n\n');
}

export async function generatePlaywrightScript(
  input: GenerateScriptInput
): Promise<GenerateScriptResult> {
  const { endpoint } = getAgentConfig();
  const token = await getAiToken();

  // Derive the chat completions URL from the agent endpoint
  const accountUrl = endpoint.match(
    /https:\/\/[^/]+\.services\.ai\.azure\.com/
  )?.[0];
  if (!accountUrl) {
    throw new Error('Could not derive the AI services URL from the agent endpoint.');
  }

  const chatUrl = `${accountUrl}/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2025-04-01-preview`;

  const userMessage = `Application: ${input.applicationName}
Start URL: ${input.startUrl}
Test name: ${input.testName}

${describeTest(input.steps, input.assertions)}`;

  const response = await fetch(chatUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Script generation failed (HTTP ${response.status}): ${body.slice(0, 300)}`
    );
  }

  const result = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    model: string;
  };

  let script = result.choices?.[0]?.message?.content?.trim() ?? '';

  // Strip markdown fences if the model wrapped it despite instructions
  const fenced = script.match(/```(?:python)?\s*([\s\S]*?)\s*```/);
  if (fenced) script = fenced[1].trim();

  if (!script || !script.includes('playwright')) {
    throw new Error('The model did not produce a valid Playwright script.');
  }

  return { script, model: result.model ?? 'gpt-4.1-mini' };
}
