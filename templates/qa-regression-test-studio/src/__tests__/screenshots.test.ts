import { describe, expect, it } from 'vitest';

import {
  oneLakePortalUrl,
  screenshotFilename,
  screenshotImageUrl,
} from '@/lib/screenshots';

const ONELAKE_URL =
  'https://onelake.dfs.fabric.microsoft.com/11111111-1111-1111-1111-111111111111/' +
  '22222222-2222-2222-2222-222222222222/Files/screenshots/' +
  '33333333-3333-3333-3333-333333333333/step_1.png';

describe('screenshotFilename', () => {
  it('reads the file name from a OneLake url', () => {
    expect(screenshotFilename(ONELAKE_URL)).toBe('step_1.png');
  });

  it('rejects a name that walks out of the run folder', () => {
    expect(
      screenshotFilename('https://onelake.dfs.fabric.microsoft.com/a/b/..%2Fsecret.png')
    ).toBeNull();
  });

  it('rejects a non-png', () => {
    expect(screenshotFilename('https://onelake.dfs.fabric.microsoft.com/a/b/x.exe'))
      .toBeNull();
  });
});

describe('oneLakePortalUrl', () => {
  it('deep links to the screenshot itself', () => {
    expect(oneLakePortalUrl(ONELAKE_URL)).toBe(
      'https://app.powerbi.com/groups/' +
        '11111111-1111-1111-1111-111111111111/lakehouses/' +
        '22222222-2222-2222-2222-222222222222' +
        '?experience=power-bi&selectedPath=' +
        'Files%2Fscreenshots%2F33333333-3333-3333-3333-333333333333%2Fstep_1.png'
    );
  });

  it('returns null for anything that is not a OneLake url', () => {
    expect(oneLakePortalUrl('https://example.com/step_1.png')).toBeNull();
  });
});

describe('screenshotImageUrl', () => {
  it('builds a runner url and tolerates a trailing slash', () => {
    expect(screenshotImageUrl('https://runner.example.com/', 'run-1', 'step_1.png'))
      .toBe('https://runner.example.com/screenshots/run-1/step_1.png');
  });
});
