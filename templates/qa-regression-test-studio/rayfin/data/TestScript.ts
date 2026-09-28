import { authenticated, date, entity, one, text, uuid } from '@microsoft/rayfin-core';

import { TestCase } from './TestCase.js';

/**
 * The generated Playwright Python script for a test case.
 *
 * One script per test. Generated from an uploaded document or from the
 * no-code step editor, stored as a text column, and executed by the
 * parameterized runner notebook. Regenerated when the test definition
 * changes or when a run fails due to a stale locator.
 */
@entity()
@authenticated(['read', 'create', 'update', 'delete'])
export class TestScript {
  @uuid()
  id!: string;

  @one(() => TestCase)
  test!: TestCase;

  @uuid()
  test_id!: string;

  /** The Playwright Python source code. NVARCHAR(MAX) — scripts run 10-15K chars. */
  @text()
  script_body!: string;

  /** `generated` | `edited` | `failed`. */
  @text({ max: 32 })
  status!: string;

  /** The model that generated this script. */
  @text({ optional: true, max: 100 })
  generated_by_model?: string;

  /** Hash or version so the runner knows if the script changed. */
  @text({ optional: true, max: 64 })
  version_hash?: string;

  @text({ max: 128 })
  created_by!: string;

  @date()
  created_at!: Date;

  @date()
  updated_at!: Date;
}
