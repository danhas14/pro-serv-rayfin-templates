import { authenticated, entity, int, one, uuid } from '@microsoft/rayfin-core';

import { TestCase } from './TestCase.js';
import { TestSuite } from './TestSuite.js';

/**
 * Join entity placing a test in a suite at a given position.
 *
 * Rayfin does not support many-to-many relationships, so the two `@one()`
 * navigations here are the supported way to express "a test can belong to
 * several suites, and a suite contains several tests" — which matters because
 * the same login smoke test belongs in both the monthly patch suite and every
 * per-application upgrade suite.
 */
@entity()
@authenticated(['read', 'create', 'update', 'delete'])
export class SuiteMember {
  @uuid()
  id!: string;

  @one(() => TestSuite)
  suite!: TestSuite;

  @uuid()
  suite_id!: string;

  @one(() => TestCase)
  test!: TestCase;

  @uuid()
  test_id!: string;

  /** Execution order within the suite. */
  @int()
  sort_order!: number;
}
