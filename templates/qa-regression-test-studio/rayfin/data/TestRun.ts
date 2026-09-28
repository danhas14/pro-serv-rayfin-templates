import {
  authenticated,
  date,
  decimal,
  entity,
  int,
  one,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { TestCase } from './TestCase.js';

/**
 * One execution of one test — the audit record that replaces the customer's
 * Excel sheet.
 *
 * Everything the agent returns at the top level of its `TestExecutionResult`
 * lands here; the per-step and per-assertion detail lands in `StepResult` and
 * `AssertionResult`. `summary` is stored verbatim because the agent is
 * instructed to write it for a non-technical business analyst, which is exactly
 * the audience for the run history screen.
 *
 * `Failed` and `Error` are kept distinct on purpose: `Failed` means the
 * application under test misbehaved (a real defect), `Error` means the test
 * itself could not be carried out (agent, browser, or network). Collapsing them
 * would make the failure report untrustworthy.
 */
@entity()
@authenticated(['read', 'create', 'update', 'delete'])
export class TestRun {
  @uuid()
  id!: string;

  @one(() => TestCase)
  test!: TestCase;

  @uuid()
  test_id!: string;

  /**
   * Correlates the runs launched together by one suite execution.
   * Plain text rather than a FK so a run always survives suite deletion.
   */
  @text({ optional: true, max: 64 })
  suite_run_id?: string;

  @text({ optional: true, max: 200 })
  suite_name?: string;

  /** `Queued` | `Running` | `Passed` | `Failed` | `Error`. */
  @text({ max: 32 })
  status!: string;

  /** `Manual` | `Scheduled` | `Api`. */
  @text({ max: 32 })
  triggered_by!: string;

  @date()
  started_at!: Date;

  @date({ optional: true })
  completed_at?: Date;

  @decimal({ optional: true })
  duration_seconds?: number;

  @int({ optional: true })
  failed_step_number?: number;

  @text({ optional: true, max: 2000 })
  failure_reason?: string;

  /** Plain-language outcome written by the agent for a business analyst. */
  @text({ optional: true, max: 4000 })
  summary?: string;

  /**
   * Plain-language explanation of a failure, generated on first view.
   *
   * Playwright reports failures as call logs full of selectors and DOM
   * fragments, which is precise but unreadable for the business analysts who
   * own these tests. Stored rather than generated per view so the model is
   * called once per run, and so the wording in a report never changes
   * underneath someone who has already read it.
   */
  @text({ optional: true, max: 4000 })
  plain_summary?: string;

  /** Foundry `response.id`, for tracing a run back to the agent invocation. */
  @text({ optional: true, max: 200 })
  agent_response_id?: string;

  /** Entra subject claim of whoever launched the run. */
  @text({ max: 128 })
  created_by!: string;
}
