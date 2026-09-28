import { authenticated, entity, int, one, text, uuid } from '@microsoft/rayfin-core';

import { TestRun } from './TestRun.js';

/**
 * The outcome of one assertion in one run.
 *
 * Both `expected` and `actual` are recorded even when the assertion passed,
 * because "what did the screen actually say" is the question an auditor asks
 * about a run that happened three months ago, and re-running the test to find
 * out is not an answer.
 */
@entity()
@authenticated(['read', 'create', 'update', 'delete'])
export class AssertionResult {
  @uuid()
  id!: string;

  @one(() => TestRun)
  run!: TestRun;

  @uuid()
  run_id!: string;

  @int()
  assertion_number!: number;

  /** `Passed` | `Failed`. */
  @text({ max: 16 })
  status!: string;

  @text({ optional: true, max: 2000 })
  expected?: string;

  @text({ optional: true, max: 2000 })
  actual?: string;

  /** `Critical` | `Major` | `Minor`. */
  @text({ max: 16 })
  severity!: string;
}
