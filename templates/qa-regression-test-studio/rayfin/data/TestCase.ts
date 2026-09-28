import {
  authenticated,
  boolean,
  date,
  entity,
  int,
  one,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { TestApplication } from './TestApplication.js';

/**
 * A single regression test, authored in plain language by a business analyst.
 *
 * This row is the header. The ordered actions live in `TestStep` and the
 * pass/fail conditions live in `TestAssertion`. That normalization is
 * deliberate rather than storing the whole `testDefinition` JSON in one column:
 * Rayfin's data client inlines mutation values into the GraphQL query string
 * and the server rejects any query over 65,536 characters, so a large test
 * stored as a single blob would silently become unsaveable. Row-per-step also
 * lets a healed locator be written back to exactly one step.
 *
 * The fields here map one-to-one onto the top level of the agent's
 * `schemaVersion: "1.0"` test definition, so building the agent payload is a
 * projection rather than a translation.
 */
@entity()
@authenticated(['read', 'create', 'update', 'delete'])
export class TestCase {
  @uuid()
  id!: string;

  @text({ max: 200 })
  name!: string;

  @text({ optional: true, max: 2000 })
  description?: string;

  @one(() => TestApplication)
  application!: TestApplication;

  /** FK column, declared so it can be filtered and set directly. */
  @uuid()
  application_id!: string;

  /** `Desktop` | `MobileIOS` | `MobileAndroid` | `Tablet`. */
  @text({ max: 32 })
  device_profile!: string;

  /** `None` | `FormLogin` | `SSO`. Drives the agent's `authentication` block. */
  @text({ max: 32 })
  auth_method!: string;

  /** Comma-separated labels, e.g. `smoke,patch-validation`. */
  @text({ optional: true, max: 500 })
  tags?: string;

  /** Hard ceiling handed to the agent as `timeoutSeconds`. */
  @int()
  timeout_seconds!: number;

  /** When true the agent screenshots every step, not just failures. */
  @boolean()
  capture_screenshot_every_step!: boolean;

  /** `Draft` | `Active` | `Archived`. Only `Active` tests run on a schedule. */
  @text({ max: 32 })
  status!: string;

  /** Denormalized from the most recent run so list views need no join. */
  @text({ optional: true, max: 32 })
  last_run_status?: string;

  @date({ optional: true })
  last_run_at?: Date;

  @text({ max: 128 })
  created_by!: string;

  @date()
  created_at!: Date;

  @date()
  updated_at!: Date;
}
