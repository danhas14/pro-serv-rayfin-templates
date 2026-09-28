import {
  authenticated,
  boolean,
  date,
  entity,
  text,
  uuid,
} from '@microsoft/rayfin-core';

/**
 * A named collection of tests executed together — the unit the customer
 * actually schedules.
 *
 * Maps directly onto how they work today: one suite for the monthly Windows 11
 * patch validation (a short smoke pass across all four applications) and larger
 * suites per application for post-upgrade regression.
 *
 * `schedule_cron` is executed by the `regression-test-scheduler` Container Apps
 * Job, which ticks every 15 minutes and runs the suites that have come due. A
 * Fabric App is a static SPA with no server-side timer, so unattended execution
 * has to happen outside the browser — see `docs/SCHEDULING.md`.
 */
@entity()
@authenticated(['read', 'create', 'update', 'delete'])
export class TestSuite {
  @uuid()
  id!: string;

  @text({ max: 200 })
  name!: string;

  @text({ optional: true, max: 2000 })
  description?: string;

  /** Standard 5-field cron expression, e.g. `0 2 * * 1` for 02:00 Mondays, UTC. */
  @text({ optional: true, max: 100 })
  schedule_cron?: string;

  @boolean()
  schedule_enabled!: boolean;

  @date({ optional: true })
  last_run_at?: Date;

  @text({ optional: true, max: 32 })
  last_run_status?: string;

  @text({ max: 128 })
  created_by!: string;

  @date()
  created_at!: Date;
}
