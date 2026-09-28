import { describe, expect, it } from 'vitest';

import { describeTest } from '@/services/scriptGenerator';

describe('describeTest', () => {
  it('keeps the action, element and value of a step together', () => {
    const text = describeTest([
      {
        step_number: 1,
        action: 'type',
        target: 'the Email address field',
        value: 'user@contoso.com',
      },
    ]);

    // The bug this replaced dropped both the action and the value whenever a
    // target was present, leaving the model only "the Email address field".
    expect(text).toContain('[type]');
    expect(text).toContain('element: the Email address field');
    expect(text).toContain('value: user@contoso.com');
  });

  it('renumbers to a contiguous sequence but keeps declared order', () => {
    const text = describeTest([
      { step_number: 30, action: 'click', target: 'Submit' },
      { step_number: 10, action: 'navigate', value: 'https://example.com' },
    ]);
    expect(text.indexOf('Step 1')).toBeLessThan(text.indexOf('Step 2'));
    expect(text).toContain('Step 1 [navigate]');
    expect(text).toContain('Step 2 [click]');
  });

  it('marks optional steps so a missing element does not fail the run', () => {
    const text = describeTest([
      { step_number: 1, action: 'click', target: 'Accept cookies', optional: true },
    ]);
    expect(text).toContain('optional');
  });

  it('passes through notes, waits and extraction names', () => {
    const text = describeTest([
      {
        step_number: 1,
        action: 'extractText',
        target: 'Order number',
        notes: 'only shown after the banner closes',
        wait_ms: 500,
        extract_as: 'orderNo',
      },
    ]);
    expect(text).toContain('note: only shown after the banner closes');
    expect(text).toContain('wait after: 500ms');
    expect(text).toContain('{{orderNo}}');
  });

  it('turns a healed locator into a concrete Playwright call', () => {
    const text = describeTest([
      {
        step_number: 1,
        action: 'click',
        target: 'the Categories menu',
        locator_json: JSON.stringify({
          strategy: 'role',
          role: 'button',
          name: 'Categories',
        }),
      },
    ]);
    expect(text).toContain('proven locator: get_by_role("button", name="Categories")');
  });

  it('ignores an unparseable locator rather than throwing', () => {
    const text = describeTest([
      { step_number: 1, action: 'click', target: 'x', locator_json: 'not json' },
    ]);
    expect(text).not.toContain('proven locator');
  });

  it('includes assertions as checks', () => {
    const text = describeTest(
      [{ step_number: 1, action: 'click', target: 'Submit' }],
      [
        {
          assertion_number: 1,
          type: 'textVisible',
          expected: 'Order confirmed',
          severity: 'Critical',
        },
      ]
    );
    expect(text).toContain('CHECKS');
    expect(text).toContain('[textVisible] severity=Critical');
    expect(text).toContain('expected: Order confirmed');
  });

  it('omits the checks section when there are none', () => {
    const text = describeTest([{ step_number: 1, action: 'click', target: 'x' }]);
    expect(text).not.toContain('CHECKS');
  });
});
