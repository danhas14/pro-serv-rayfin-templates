import {
  authenticated,
  boolean,
  entity,
  int,
  one,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { TestCase } from './TestCase.js';

/**
 * One ordered action in a test, written the way a business user would describe
 * it ("the Save button in the invoice dialog") rather than as a CSS selector.
 *
 * `locator_*` is the durable half. The agent resolves each plain-language
 * `target` into a role/label/testId locator and returns it; the app persists it
 * back onto this row. On the next run that locator is sent *in*, so the agent
 * reuses it instead of re-resolving — and when an application upgrade breaks
 * it, the agent heals it and the new one is written back. That self-healing
 * loop is what keeps the suite alive across the customer's major upgrades
 * without a developer editing selectors.
 */
@entity()
@authenticated(['read', 'create', 'update', 'delete'])
export class TestStep {
  @uuid()
  id!: string;

  @one(() => TestCase)
  test!: TestCase;

  @uuid()
  test_id!: string;

  /** 1-based execution order. The agent runs strictly ascending. */
  @int()
  step_number!: number;

  /** `navigate` | `click` | `type` | `select` | `waitForText` | `extractText` | `screenshot` | `hover` | `press`. */
  @text({ max: 32 })
  action!: string;

  /** Plain-language description of the element to act on. */
  @text({ optional: true, max: 1000 })
  target?: string;

  /** Text to type, URL to navigate to, or expected text to wait for. */
  @text({ optional: true, max: 2000 })
  value?: string;

  @text({ optional: true, max: 1000 })
  notes?: string;

  /** Explicit settle time honoured by the agent before the next step. */
  @int({ optional: true })
  wait_ms?: number;

  /** When true a missing target is `Skipped` rather than failing the run. */
  @boolean()
  optional!: boolean;

  /** Names the variable an `extractText` step captures, for `{{token}}` reuse. */
  @text({ optional: true, max: 100 })
  extract_as?: string;

  /**
   * Last locator the agent resolved for this step, as JSON.
   * Sent back to the agent on the next run so replay is deterministic.
   */
  @text({ optional: true, max: 2000 })
  locator_json?: string;

  /** `High` | `Medium` | `Low` — surfaced so analysts can see fragile steps. */
  @text({ optional: true, max: 16 })
  locator_confidence?: string;
}
