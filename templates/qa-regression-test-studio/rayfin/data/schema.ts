import { AssertionResult } from './AssertionResult.js';
import { StepResult } from './StepResult.js';
import { SuiteMember } from './SuiteMember.js';
import { TestApplication } from './TestApplication.js';
import { TestAssertion } from './TestAssertion.js';
import { TestCase } from './TestCase.js';
import { TestRun } from './TestRun.js';
import { TestScript } from './TestScript.js';
import { TestStep } from './TestStep.js';
import { TestSuite } from './TestSuite.js';

/**
 * Regression Test Studio data model.
 *
 * Two halves that mirror each other:
 *
 *   Authoring   TestApplication -> TestCase -> TestStep / TestAssertion
 *   Execution   TestRun -> StepResult / AssertionResult
 *
 * plus TestSuite + SuiteMember for grouping and scheduling.
 *
 * The authoring side is the reusable definition; the execution side is the
 * immutable evidence of one run. Keeping them separate is what lets a test be
 * edited without rewriting history — the run history stays a faithful record of
 * what was executed at the time, which is the audit property the customer
 * currently gets from archived Excel files and retained screenshots.
 */
export type AppSchema = {
  TestApplication: TestApplication;
  TestCase: TestCase;
  TestStep: TestStep;
  TestAssertion: TestAssertion;
  TestScript: TestScript;
  TestSuite: TestSuite;
  SuiteMember: SuiteMember;
  TestRun: TestRun;
  StepResult: StepResult;
  AssertionResult: AssertionResult;
};

export const schema = [
  TestApplication,
  TestCase,
  TestStep,
  TestAssertion,
  TestScript,
  TestSuite,
  SuiteMember,
  TestRun,
  StepResult,
  AssertionResult,
];
