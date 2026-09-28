import {
  authenticated,
  boolean,
  decimal,
  entity,
  int,
  one,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { TestRun } from './TestRun.js';

/**
 * What actually happened on one step of one run.
 *
 * `observation` is the evidence the customer currently pastes into Excel by
 * hand, and `screenshot_ref` is the identifier of the image the agent captured
 * — the replacement for their manually retained screenshots.
 *
 * `healed` is the interesting column for reporting: a run that passes with
 * healed steps is a warning that the application's UI moved under the test, and
 * a spike in healing right after an upgrade is the earliest signal that the
 * suite needs review.
 */
@entity()
@authenticated(['read', 'create', 'update', 'delete'])
export class StepResult {
  @uuid()
  id!: string;

  @one(() => TestRun)
  run!: TestRun;

  @uuid()
  run_id!: string;

  @int()
  step_number!: number;

  @text({ max: 32 })
  action!: string;

  @text({ optional: true, max: 1000 })
  target?: string;

  /** `Passed` | `Failed` | `Skipped`. */
  @text({ max: 16 })
  status!: string;

  /** Factual description of what was rendered or what changed. */
  @text({ optional: true, max: 4000 })
  observation?: string;

  /** The same outcome without selectors or DOM fragments. */
  @text({ optional: true, max: 1000 })
  plain_observation?: string;

  /** Identifier of the captured screenshot, or null when none was taken. */
  @text({ optional: true, max: 1000 })
  screenshot_ref?: string;

  /** OneLake URL of the screenshot image, viewable in the run detail page. */
  @text({ optional: true, max: 2048 })
  screenshot_url?: string;

  @decimal({ optional: true })
  duration_seconds?: number;

  /** The locator the agent used, as JSON. Mirrored onto `TestStep` on success. */
  @text({ optional: true, max: 2000 })
  locator_json?: string;

  @text({ optional: true, max: 16 })
  locator_confidence?: string;

  /** True when the stored locator no longer matched and a new one was resolved. */
  @boolean()
  healed!: boolean;
}
