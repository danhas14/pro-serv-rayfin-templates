import { authenticated, entity, int, one, text, uuid } from '@microsoft/rayfin-core';

import { TestCase } from './TestCase.js';

/**
 * A pass/fail condition evaluated after the steps have run.
 *
 * Severity is what turns a pile of checks into a triage queue: the agent fails
 * the run on any `Critical` or `Major` miss but only warns on `Minor`, so a
 * cosmetic difference after a Windows patch does not page anyone while a broken
 * approval route does.
 */
@entity()
@authenticated(['read', 'create', 'update', 'delete'])
export class TestAssertion {
  @uuid()
  id!: string;

  @one(() => TestCase)
  test!: TestCase;

  @uuid()
  test_id!: string;

  @int()
  assertion_number!: number;

  /** `urlContains` | `textVisible` | `textNotVisible` | `elementVisible` | `confirmValue` | `valueEquals` | `noErrorsDisplayed`. */
  @text({ max: 32 })
  type!: string;

  /** The field or element the check reads. Required for `confirmValue`. */
  @text({ optional: true, max: 1000 })
  target?: string;

  /**
   * For most types the literal to match. For `confirmValue` it is an optional
   * plain-language description of the expected shape, e.g. "numeric, 6-10
   * digits" — blank means "any non-empty value passes".
   */
  @text({ optional: true, max: 2000 })
  expected?: string;

  /** `Critical` | `Major` | `Minor`. Drives overall run status. */
  @text({ max: 16 })
  severity!: string;

  @text({ optional: true, max: 1000 })
  description?: string;
}
