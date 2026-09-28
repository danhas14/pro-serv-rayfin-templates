/**
 * Guards the create-payload shape.
 *
 * The Rayfin client derives a foreign-key field from an `@one()` navigation
 * when it builds the mutation, so a payload carrying both the navigation and
 * the FK column is rejected by the server with
 * "There can be only one input field named `x_id`". These tests pin that down,
 * because the generated TypeScript types actively encourage the broken shape.
 */
import { describe, expect, it } from 'vitest';

import { withRelationships } from '@/services/testStore';

function payload(value: unknown): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

describe('withRelationships', () => {
  it('replaces a foreign-key column with its navigation', () => {
    const result = payload(
      withRelationships(
        { test_id: 'test-1', step_number: 1, action: 'click' },
        ['test_id'],
        { test: { id: 'test-1' } }
      )
    );

    expect(result).not.toHaveProperty('test_id');
    expect(result.test).toEqual({ id: 'test-1' });
    expect(result.step_number).toBe(1);
    expect(result.action).toBe('click');
  });

  it('strips every declared foreign key on a join entity', () => {
    const result = payload(
      withRelationships(
        { suite_id: 'suite-1', test_id: 'test-1', sort_order: 3 },
        ['suite_id', 'test_id'],
        { suite: { id: 'suite-1' }, test: { id: 'test-1' } }
      )
    );

    expect(Object.keys(result).sort()).toEqual([
      'sort_order',
      'suite',
      'test',
    ]);
  });

  it('does not mutate the caller\u2019s input', () => {
    const input = { run_id: 'run-1', step_number: 1 };
    withRelationships(input, ['run_id'], { run: { id: 'run-1' } });
    expect(input.run_id).toBe('run-1');
  });

  it('leaves non-relationship columns untouched', () => {
    const result = payload(
      withRelationships(
        { application_id: 'app-1', name: 'PO test', timeout_seconds: 240 },
        ['application_id'],
        { application: { id: 'app-1' } }
      )
    );

    expect(result.name).toBe('PO test');
    expect(result.timeout_seconds).toBe(240);
  });
});
