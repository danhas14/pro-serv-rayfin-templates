import { authenticated, boolean, entity, text, uuid } from '@microsoft/rayfin-core';

/**
 * An application under test.
 *
 * The customer runs four of these: two internally developed and two commercial
 * off-the-shelf, all primarily web-based, one with mobile/iOS usage. Modelling
 * them as first-class rows (rather than repeating a URL on every test) means a
 * URL change at release time is a single edit instead of an edit per test.
 *
 * Shared, not owner-scoped: the entire point of the tool is that business
 * analysts co-maintain one suite, so `created_by` is audit metadata rather than
 * a row-level-security boundary.
 */
@entity()
@authenticated(['read', 'create', 'update', 'delete'])
export class TestApplication {
  @uuid()
  id!: string;

  @text({ max: 200 })
  name!: string;

  @text({ optional: true, max: 1000 })
  description?: string;

  /** Base URL tests start from. Steps may navigate to deeper paths. */
  @text({ max: 2048 })
  start_url!: string;

  /** `Internal` (built in-house) or `COTS` (commercial off-the-shelf). */
  @text({ max: 32 })
  kind!: string;

  /** `Web` or `WebAndMobile` — drives which device profiles are offered. */
  @text({ max: 32 })
  platform!: string;

  /** True when tests against this app need a sign-in step. */
  @boolean()
  auth_required!: boolean;

  /** Entra subject claim of whoever registered the application. */
  @text({ max: 128 })
  created_by!: string;
}
