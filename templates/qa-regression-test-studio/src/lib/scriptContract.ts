/**
 * Checks a hand-edited Playwright script against the contract the runner
 * depends on.
 *
 * The runner does not just execute the file — it passes specific arguments,
 * rewrites the browser launch call, and parses stdout for results. A script
 * that drops one of those still looks fine in the editor and then fails at
 * runtime with a message that points nowhere near the cause. Each check below
 * corresponds to a failure that has actually happened.
 *
 * Warnings never block saving. Someone may be mid-edit, or deliberately doing
 * something unusual, and refusing to save their work would be worse than
 * letting them run something that fails.
 */
export interface ScriptIssue {
  level: 'error' | 'warning';
  message: string;
}

export function validateScript(script: string): ScriptIssue[] {
  if (!script.trim()) {
    return [{ level: 'error', message: 'The script is empty.' }];
  }

  const issues: ScriptIssue[] = [];

  if (!/playwright/i.test(script)) {
    issues.push({
      level: 'error',
      message: 'This does not import Playwright, so the runner cannot execute it.',
    });
  }

  if (!script.includes('--start-url')) {
    issues.push({
      level: 'warning',
      message:
        'No --start-url argument. The runner passes the application address ' +
        'that way, and the script will stop before opening a page without it.',
    });
  }

  if (!script.includes('--screenshot-dir')) {
    issues.push({
      level: 'warning',
      message:
        'No --screenshot-dir argument. The run will work, but no screenshots ' +
        'will be collected as evidence.',
    });
  }

  if (!/chromium\.launch\(/.test(script)) {
    issues.push({
      level: 'warning',
      message:
        'No chromium.launch(...) call found. The runner injects the flags the ' +
        'browser needs inside a container there, so the browser may fail to start.',
    });
  }

  if (!/["']step["']/.test(script)) {
    issues.push({
      level: 'warning',
      message:
        'No per-step JSON output found. Without it the run is recorded with no ' +
        'steps and reported as an error.',
    });
  }

  return issues;
}

/** True when nothing blocks saving and running. */
export function hasBlockingIssue(issues: ScriptIssue[]): boolean {
  return issues.some((i) => i.level === 'error');
}
