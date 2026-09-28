/**
 * Tests for the agent wire-format mapping.
 *
 * This is the layer worth covering: it is the boundary with an external
 * contract defined by the agent's system prompt, and a silent drift here
 * produces runs that appear to succeed while asserting nothing.
 */
import { describe, expect, it } from 'vitest';

import {
  buildTestDefinition,
  collectSecretKeys,
  numericTestId,
  parseLocator,
} from '@/lib/testDefinition';
import type { FullTest, StepRow } from '@/services/testStore';

function makeStep(over: Partial<StepRow>): StepRow {
  return {
    id: crypto.randomUUID(),
    test_id: 'test-1',
    step_number: 1,
    action: 'click',
    optional: false,
    ...over,
  } as StepRow;
}

const full: FullTest = {
  test: {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    name: 'Create a purchase order',
    description: 'End-to-end PO creation',
    application_id: 'app-1',
    device_profile: 'Desktop',
    auth_method: 'FormLogin',
    tags: ' smoke , patch-validation ,,',
    timeout_seconds: 240,
    capture_screenshot_every_step: true,
    status: 'Active',
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
  } as FullTest['test'],
  application: {
    id: 'app-1',
    name: 'Supplier Portal',
    start_url: 'https://portal.example.com',
    kind: 'Internal',
    platform: 'Web',
    auth_required: true,
    created_by: 'user-1',
  } as FullTest['application'],
  steps: [
    makeStep({ step_number: 2, action: 'click', target: 'the Save button' }),
    makeStep({
      step_number: 1,
      action: 'navigate',
      value: 'https://portal.example.com/po/new',
    }),
  ],
  assertions: [
    {
      id: 'a2',
      test_id: 'test-1',
      assertion_number: 2,
      type: 'textVisible',
      expected: 'Order created',
      severity: 'Critical',
    } as FullTest['assertions'][number],
    {
      id: 'a1',
      test_id: 'test-1',
      assertion_number: 1,
      type: 'urlContains',
      expected: '/po/',
      severity: 'Major',
    } as FullTest['assertions'][number],
  ],
};

describe('buildTestDefinition', () => {
  it('emits the schema version the agent expects', () => {
    expect(buildTestDefinition(full).schemaVersion).toBe('1.0');
  });

  it('orders steps and assertions ascending regardless of row order', () => {
    const def = buildTestDefinition(full);
    expect(def.steps.map((s) => s.stepNumber)).toEqual([1, 2]);
    expect(def.assertions.map((a) => a.assertionNumber)).toEqual([1, 2]);
  });

  it('derives authentication.required from the auth method', () => {
    expect(buildTestDefinition(full).authentication).toEqual({
      required: true,
      method: 'FormLogin',
    });

    const none = buildTestDefinition({
      ...full,
      test: { ...full.test, auth_method: 'None' },
    });
    expect(none.authentication.required).toBe(false);
  });

  it('splits tags and drops blanks', () => {
    expect(buildTestDefinition(full).tags).toEqual(['smoke', 'patch-validation']);
  });

  it('omits empty optional fields rather than sending empty strings', () => {
    const navigate = buildTestDefinition(full).steps[0];
    expect(navigate).not.toHaveProperty('target');
    expect(navigate.value).toBe('https://portal.example.com/po/new');
  });

  it('replays a stored locator so the agent need not re-resolve it', () => {
    const withLocator = buildTestDefinition({
      ...full,
      steps: [
        makeStep({
          step_number: 1,
          action: 'click',
          target: 'the Save button',
          locator_json: JSON.stringify({
            strategy: 'role',
            role: 'button',
            name: 'Save',
          }),
        }),
      ],
    });
    expect(withLocator.steps[0].resolvedLocator).toEqual({
      strategy: 'role',
      role: 'button',
      name: 'Save',
    });
  });
});

describe('parseLocator', () => {
  it('returns undefined for missing, malformed, or strategy-less values', () => {
    expect(parseLocator(undefined)).toBeUndefined();
    expect(parseLocator('not json')).toBeUndefined();
    expect(parseLocator('{"name":"Save"}')).toBeUndefined();
  });
});

describe('numericTestId', () => {
  it('is deterministic and non-negative', () => {
    const id = numericTestId('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(id).toBe(numericTestId('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'));
    expect(id).toBeGreaterThanOrEqual(0);
  });
});

describe('collectSecretKeys', () => {
  it('finds tokens in both value and target, deduplicated and sorted', () => {
    const keys = collectSecretKeys([
      makeStep({ value: '{{secret:password}}' }),
      makeStep({ value: '{{secret:password}}', target: '{{secret:apiKey}}' }),
      makeStep({ value: 'no tokens here' }),
    ]);
    expect(keys).toEqual(['apiKey', 'password']);
  });

  it('returns nothing when a test needs no credentials', () => {
    expect(collectSecretKeys([makeStep({ value: 'hello' })])).toEqual([]);
  });
});
