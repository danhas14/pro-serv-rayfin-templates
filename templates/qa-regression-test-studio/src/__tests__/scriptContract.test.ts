import { describe, expect, it } from 'vitest';

import { hasBlockingIssue, validateScript } from '@/lib/scriptContract';

const GOOD = `
import argparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--start-url", required=True)
parser.add_argument("--screenshot-dir", default="./screenshots")
args = parser.parse_args()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    print(json.dumps({"step": 1, "status": "Passed"}))
`;

describe('validateScript', () => {
  it('accepts a script that honours the runner contract', () => {
    expect(validateScript(GOOD)).toEqual([]);
  });

  it('blocks an empty script', () => {
    const issues = validateScript('   ');
    expect(hasBlockingIssue(issues)).toBe(true);
  });

  it('blocks a script that is not Playwright at all', () => {
    const issues = validateScript('print("hello")');
    expect(hasBlockingIssue(issues)).toBe(true);
  });

  it('warns but does not block when the start url argument is missing', () => {
    const issues = validateScript(GOOD.replace('--start-url', '--url'));
    expect(hasBlockingIssue(issues)).toBe(false);
    expect(issues.some((i) => i.message.includes('--start-url'))).toBe(true);
  });

  it('warns when screenshots would not be collected', () => {
    const issues = validateScript(GOOD.replace('--screenshot-dir', '--shots'));
    expect(issues.some((i) => i.message.includes('screenshots'))).toBe(true);
  });

  it('warns when the browser launch call is missing', () => {
    const issues = validateScript(GOOD.replace('p.chromium.launch(', 'p.firefox.launch('));
    expect(issues.some((i) => i.message.includes('chromium.launch'))).toBe(true);
  });

  it('warns when no per-step output would be produced', () => {
    const issues = validateScript(GOOD.replace('"step"', '"stage"'));
    expect(issues.some((i) => i.message.includes('per-step'))).toBe(true);
  });
});
