/**
 * All database access for Regression Test Studio.
 *
 * Everything goes through the Rayfin data client rather than hand-built
 * GraphQL, so queries stay type-safe against `rayfin/data/schema.ts` and carry
 * auth automatically.
 *
 * One platform constraint shapes this file: the Rayfin client inlines mutation
 * values into the GraphQL query *string*, and the server rejects any query over
 * 65,536 characters. Every write here is therefore one small row — a step, an
 * assertion, a step result. That is also why a run's results are fanned out
 * into `StepResult` rows instead of being stored as one result blob: a
 * 40-step test with long observations would otherwise be unsaveable.
 *
 * `count()` is not implemented on the client, so aggregate figures on the
 * dashboard select the minimum set of columns and reduce in JS.
 */
import type { AssertionResult } from '../../rayfin/data/AssertionResult';
import type { StepResult } from '../../rayfin/data/StepResult';
import type { SuiteMember } from '../../rayfin/data/SuiteMember';
import type { TestApplication } from '../../rayfin/data/TestApplication';
import type { TestAssertion } from '../../rayfin/data/TestAssertion';
import type { TestCase } from '../../rayfin/data/TestCase';
import type { TestRun } from '../../rayfin/data/TestRun';
import type { TestScript } from '../../rayfin/data/TestScript';
import type { TestStep } from '../../rayfin/data/TestStep';
import type { TestSuite } from '../../rayfin/data/TestSuite';

import { getRayfinClient } from './rayfinClient';

const APP_COLUMNS = [
  'id',
  'name',
  'description',
  'start_url',
  'kind',
  'platform',
  'auth_required',
  'created_by',
] as const;

const TEST_COLUMNS = [
  'id',
  'name',
  'description',
  'application_id',
  'device_profile',
  'auth_method',
  'tags',
  'timeout_seconds',
  'capture_screenshot_every_step',
  'status',
  'last_run_status',
  'last_run_at',
  'created_by',
  'created_at',
  'updated_at',
] as const;

const STEP_COLUMNS = [
  'id',
  'test_id',
  'step_number',
  'action',
  'target',
  'value',
  'notes',
  'wait_ms',
  'optional',
  'extract_as',
  'locator_json',
  'locator_confidence',
] as const;

const ASSERTION_COLUMNS = [
  'id',
  'test_id',
  'assertion_number',
  'type',
  'target',
  'expected',
  'severity',
  'description',
] as const;

const RUN_COLUMNS = [
  'id',
  'test_id',
  'suite_run_id',
  'suite_name',
  'status',
  'triggered_by',
  'started_at',
  'completed_at',
  'duration_seconds',
  'failed_step_number',
  'failure_reason',
  'summary',
  'plain_summary',
  'agent_response_id',
  'created_by',
] as const;

const STEP_RESULT_COLUMNS = [
  'id',
  'run_id',
  'step_number',
  'action',
  'target',
  'status',
  'observation',
  'plain_observation',
  'screenshot_ref',
  'screenshot_url',
  'duration_seconds',
  'locator_json',
  'locator_confidence',
  'healed',
] as const;

const ASSERTION_RESULT_COLUMNS = [
  'id',
  'run_id',
  'assertion_number',
  'status',
  'expected',
  'actual',
  'severity',
] as const;

const SUITE_COLUMNS = [
  'id',
  'name',
  'description',
  'schedule_cron',
  'schedule_enabled',
  'last_run_at',
  'last_run_status',
  'created_by',
  'created_at',
] as const;

export type ApplicationRow = Pick<TestApplication, (typeof APP_COLUMNS)[number]>;
export type TestRow = Pick<TestCase, (typeof TEST_COLUMNS)[number]>;
export type StepRow = Pick<TestStep, (typeof STEP_COLUMNS)[number]>;
export type AssertionRow = Pick<TestAssertion, (typeof ASSERTION_COLUMNS)[number]>;
export type RunRow = Pick<TestRun, (typeof RUN_COLUMNS)[number]>;
export type StepResultRow = Pick<StepResult, (typeof STEP_RESULT_COLUMNS)[number]>;
export type AssertionResultRow = Pick<
  AssertionResult,
  (typeof ASSERTION_RESULT_COLUMNS)[number]
>;
export type SuiteRow = Pick<TestSuite, (typeof SUITE_COLUMNS)[number]>;
export type SuiteMemberRow = Pick<
  SuiteMember,
  'id' | 'suite_id' | 'test_id' | 'sort_order'
>;

const SCRIPT_COLUMNS = [
  'id',
  'test_id',
  'script_body',
  'status',
  'generated_by_model',
  'version_hash',
  'created_by',
  'created_at',
  'updated_at',
] as const;

export type ScriptRow = Pick<TestScript, (typeof SCRIPT_COLUMNS)[number]>;

/**
 * Build a create payload for an entity that has both a declared foreign-key
 * column and an `@one()` navigation.
 *
 * These entities declare the FK column explicitly (`test_id`, `run_id`, …)
 * because `.where()` and `.select()` need it, and they declare the navigation
 * because that is what establishes the relationship. The generated
 * `MutationInput` type then requires *both* — but at runtime the client expands
 * `test: { id }` into a `test_id` field when it builds the GraphQL mutation, so
 * sending both yields:
 *
 *     There can be only one input field named `test_id`.
 *
 * The FK columns are therefore stripped and the navigations sent alone. The
 * cast records that the generated type is wrong here, not the payload.
 *
 * Exported for testing — this is the exact shape a regression would break.
 */
export function withRelationships<T extends object>(
  input: T,
  fkFields: readonly (keyof T & string)[],
  navigations: Record<string, { id: string }>
): never {
  const payload: Record<string, unknown> = { ...input, ...navigations };
  for (const key of fkFields) delete payload[key];
  return payload as never;
}

/** A test with everything needed to build an agent payload. */
export interface FullTest {
  test: TestRow;
  application: ApplicationRow;
  steps: StepRow[];
  assertions: AssertionRow[];
}

/* -------------------------------------------------------------- applications */

export async function listApplications(): Promise<ApplicationRow[]> {
  return getRayfinClient()
    .data.TestApplication.select([...APP_COLUMNS])
    .orderBy({ name: 'asc' })
    .execute();
}

export async function createApplication(
  input: Omit<ApplicationRow, 'id'>
): Promise<ApplicationRow> {
  return getRayfinClient().data.TestApplication.create(input);
}

export async function updateApplication(
  id: string,
  data: Partial<Omit<ApplicationRow, 'id'>>
): Promise<void> {
  await getRayfinClient().data.TestApplication.update({ id }, data);
}

export async function deleteApplication(id: string): Promise<void> {
  await getRayfinClient().data.TestApplication.delete({ id });
}

/* --------------------------------------------------------------------- tests */

export async function listTests(): Promise<TestRow[]> {
  return getRayfinClient()
    .data.TestCase.select([...TEST_COLUMNS])
    .orderBy({ updated_at: 'desc' })
    .execute();
}

export async function getTest(id: string): Promise<TestRow | null> {
  const rows = await getRayfinClient()
    .data.TestCase.select([...TEST_COLUMNS])
    .where({ id: { eq: id } })
    .execute();
  return rows[0] ?? null;
}

export async function createTest(
  input: Omit<TestRow, 'id'>
): Promise<TestRow> {
  const created = await getRayfinClient().data.TestCase.create(
    withRelationships(input, ['application_id'], {
      application: { id: input.application_id },
    })
  );
  // Merge the input back in: the server echo does not necessarily include the
  // stripped FK column, and callers type this as a complete row.
  return { ...input, ...created };
}

export async function updateTest(
  id: string,
  data: Partial<Omit<TestRow, 'id'>>
): Promise<void> {
  await getRayfinClient().data.TestCase.update({ id }, data);
}

export async function deleteTest(id: string): Promise<void> {
  // Children first: the database has no cascade configured.
  const [steps, assertions, script] = await Promise.all([
    listSteps(id),
    listAssertions(id),
    getScriptForTest(id),
  ]);
  await Promise.all([
    ...steps.map((s) => getRayfinClient().data.TestStep.delete({ id: s.id })),
    ...assertions.map((a) =>
      getRayfinClient().data.TestAssertion.delete({ id: a.id })
    ),
    ...(script ? [getRayfinClient().data.TestScript.delete({ id: script.id })] : []),
  ]);
  await getRayfinClient().data.TestCase.delete({ id });
}

/* --------------------------------------------------------- steps + assertions */

export async function listSteps(testId: string): Promise<StepRow[]> {
  return getRayfinClient()
    .data.TestStep.select([...STEP_COLUMNS])
    .where({ test_id: { eq: testId } })
    .orderBy({ step_number: 'asc' })
    .execute();
}

export async function createStep(
  input: Omit<StepRow, 'id'>
): Promise<StepRow> {
  const created = await getRayfinClient().data.TestStep.create(
    withRelationships(input, ['test_id'], { test: { id: input.test_id } })
  );
  return { ...input, ...created };
}

export async function updateStep(
  id: string,
  data: Partial<Omit<StepRow, 'id'>>
): Promise<void> {
  await getRayfinClient().data.TestStep.update({ id }, data);
}

export async function deleteStep(id: string): Promise<void> {
  await getRayfinClient().data.TestStep.delete({ id });
}

export async function listAssertions(testId: string): Promise<AssertionRow[]> {
  return getRayfinClient()
    .data.TestAssertion.select([...ASSERTION_COLUMNS])
    .where({ test_id: { eq: testId } })
    .orderBy({ assertion_number: 'asc' })
    .execute();
}

export async function createAssertion(
  input: Omit<AssertionRow, 'id'>
): Promise<AssertionRow> {
  const created = await getRayfinClient().data.TestAssertion.create(
    withRelationships(input, ['test_id'], { test: { id: input.test_id } })
  );
  return { ...input, ...created };
}

export async function updateAssertion(
  id: string,
  data: Partial<Omit<AssertionRow, 'id'>>
): Promise<void> {
  await getRayfinClient().data.TestAssertion.update({ id }, data);
}

export async function deleteAssertion(id: string): Promise<void> {
  await getRayfinClient().data.TestAssertion.delete({ id });
}

/** Load a test plus everything needed to execute it. */
export async function getFullTest(testId: string): Promise<FullTest | null> {
  const test = await getTest(testId);
  if (!test) return null;

  const [apps, steps, assertions] = await Promise.all([
    listApplications(),
    listSteps(testId),
    listAssertions(testId),
  ]);

  const application = apps.find((a) => a.id === test.application_id);
  if (!application) return null;

  return { test, application, steps, assertions };
}

/* -------------------------------------------------------------------- suites */

export async function listSuites(): Promise<SuiteRow[]> {
  return getRayfinClient()
    .data.TestSuite.select([...SUITE_COLUMNS])
    .orderBy({ name: 'asc' })
    .execute();
}

export async function createSuite(
  input: Omit<SuiteRow, 'id'>
): Promise<SuiteRow> {
  return getRayfinClient().data.TestSuite.create(input);
}

export async function updateSuite(
  id: string,
  data: Partial<Omit<SuiteRow, 'id'>>
): Promise<void> {
  await getRayfinClient().data.TestSuite.update({ id }, data);
}

export async function deleteSuite(id: string): Promise<void> {
  const members = await listSuiteMembers(id);
  await Promise.all(
    members.map((m) => getRayfinClient().data.SuiteMember.delete({ id: m.id }))
  );
  await getRayfinClient().data.TestSuite.delete({ id });
}

export async function listSuiteMembers(
  suiteId: string
): Promise<SuiteMemberRow[]> {
  return getRayfinClient()
    .data.SuiteMember.select(['id', 'suite_id', 'test_id', 'sort_order'])
    .where({ suite_id: { eq: suiteId } })
    .orderBy({ sort_order: 'asc' })
    .execute();
}

export async function addSuiteMember(
  input: Omit<SuiteMemberRow, 'id'>
): Promise<SuiteMemberRow> {
  const created = await getRayfinClient().data.SuiteMember.create(
    withRelationships(input, ['suite_id', 'test_id'], {
      suite: { id: input.suite_id },
      test: { id: input.test_id },
    })
  );
  return { ...input, ...created };
}

export async function removeSuiteMember(id: string): Promise<void> {
  await getRayfinClient().data.SuiteMember.delete({ id });
}

/* ---------------------------------------------------------------------- runs */

export async function listRuns(limit = 200): Promise<RunRow[]> {
  const rows = await getRayfinClient()
    .data.TestRun.select([...RUN_COLUMNS])
    .orderBy({ started_at: 'desc' })
    .execute();
  return rows.slice(0, limit);
}

export async function listRunsForTest(testId: string): Promise<RunRow[]> {
  return getRayfinClient()
    .data.TestRun.select([...RUN_COLUMNS])
    .where({ test_id: { eq: testId } })
    .orderBy({ started_at: 'desc' })
    .execute();
}

export async function getRun(id: string): Promise<RunRow | null> {
  const rows = await getRayfinClient()
    .data.TestRun.select([...RUN_COLUMNS])
    .where({ id: { eq: id } })
    .execute();
  return rows[0] ?? null;
}

export async function createRun(input: Omit<RunRow, 'id'>): Promise<RunRow> {
  const created = await getRayfinClient().data.TestRun.create(
    withRelationships(input, ['test_id'], { test: { id: input.test_id } })
  );
  return { ...input, ...created };
}

export async function updateRun(
  id: string,
  data: Partial<Omit<RunRow, 'id'>>
): Promise<void> {
  await getRayfinClient().data.TestRun.update({ id }, data);
}

export async function listStepResults(runId: string): Promise<StepResultRow[]> {
  return getRayfinClient()
    .data.StepResult.select([...STEP_RESULT_COLUMNS])
    .where({ run_id: { eq: runId } })
    .orderBy({ step_number: 'asc' })
    .execute();
}

export async function updateStepResult(
  id: string,
  data: Partial<Omit<StepResultRow, 'id'>>
): Promise<void> {
  await getRayfinClient().data.StepResult.update({ id }, data);
}

export async function createStepResult(
  input: Omit<StepResultRow, 'id'>
): Promise<StepResultRow> {
  const created = await getRayfinClient().data.StepResult.create(
    withRelationships(input, ['run_id'], { run: { id: input.run_id } })
  );
  return { ...input, ...created };
}

export async function listAssertionResults(
  runId: string
): Promise<AssertionResultRow[]> {
  return getRayfinClient()
    .data.AssertionResult.select([...ASSERTION_RESULT_COLUMNS])
    .where({ run_id: { eq: runId } })
    .orderBy({ assertion_number: 'asc' })
    .execute();
}

export async function createAssertionResult(
  input: Omit<AssertionResultRow, 'id'>
): Promise<AssertionResultRow> {
  const created = await getRayfinClient().data.AssertionResult.create(
    withRelationships(input, ['run_id'], { run: { id: input.run_id } })
  );
  return { ...input, ...created };
}

/* ------------------------------------------------------------------ scripts */

export async function getScriptForTest(
  testId: string
): Promise<ScriptRow | null> {
  const rows = await getRayfinClient()
    .data.TestScript.select([...SCRIPT_COLUMNS])
    .where({ test_id: { eq: testId } })
    .orderBy({ updated_at: 'desc' })
    .execute();
  return rows[0] ?? null;
}

export async function createScript(
  input: Omit<ScriptRow, 'id'>
): Promise<ScriptRow> {
  const created = await getRayfinClient().data.TestScript.create(
    withRelationships(input, ['test_id'], { test: { id: input.test_id } })
  );
  return { ...input, ...created };
}

export async function updateScript(
  id: string,
  data: Partial<Omit<ScriptRow, 'id'>>
): Promise<void> {
  await getRayfinClient().data.TestScript.update({ id }, data);
}
