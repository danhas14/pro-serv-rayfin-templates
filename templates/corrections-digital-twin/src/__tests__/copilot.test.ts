import { describe, expect, it } from 'vitest';

import { SUGGESTED_QUESTIONS, answerQuestion } from '@/lib/copilot';
import { buildTwin } from '@/lib/metrics';
import { DEV_TWIN } from '@/lib/twin-fixture';

const twin = buildTwin(DEV_TWIN);

const flatten = (question: string): string => {
  const answer = answerQuestion(twin, question);
  const body = answer.blocks
    .map((block) => {
      switch (block.kind) {
        case 'text':
          return block.text;
        case 'bullets':
          return block.items.join(' ');
        case 'metrics':
          return block.items.map((i) => `${i.label} ${i.value}`).join(' ');
        case 'table':
          return [
            block.columns.join(' '),
            ...block.rows.map((r) => r.cells.join(' ')),
          ].join(' ');
        default:
          return '';
      }
    })
    .join(' ');
  return `${answer.headline} ${body}`;
};

describe('Operations Assistant routing', () => {
  it('answers every suggested question without falling back', () => {
    for (const question of SUGGESTED_QUESTIONS) {
      const answer = answerQuestion(twin, question);
      expect(answer.headline).not.toMatch(/don't have a grounded answer/);
      expect(answer.blocks.length).toBeGreaterThan(0);
    }
  });

  it('names Housing Unit C as the highest incident volume', () => {
    const text = flatten('Which housing unit has the highest incident rate?');
    expect(text).toContain('Housing Unit C');
    expect(text).toContain('24');
  });

  it('reports both over-capacity units with their occupancy', () => {
    const text = flatten('Which buildings are currently overcrowded?');
    expect(text).toContain('Housing Unit B');
    expect(text).toContain('108%');
    expect(text).toContain('Housing Unit D');
    expect(text).toContain('103%');
  });

  it('forecasts the population above 5,100 within six months', () => {
    const text = flatten('Predict inmate population six months from now.');
    expect(text).toMatch(/5,[12]\d\d/);
    expect(text).toContain('six months');
  });

  it('lists understaffed units and focuses the map on them', () => {
    const answer = answerQuestion(twin, 'Which units are understaffed?');
    expect(answer.focus).toContain('housing-d');
    expect(flatten('Which units are understaffed?')).toContain('Housing Unit D');
  });

  it('returns a ratio table covering every unit with a population', () => {
    const answer = answerQuestion(
      twin,
      'Show the officer-to-inmate ratio for all units.'
    );
    const table = answer.blocks.find((b) => b.kind === 'table');
    expect(table).toBeDefined();
    if (table?.kind === 'table') {
      expect(table.rows.length).toBeGreaterThanOrEqual(13);
    }
  });

  it('summarises operational status with facility-level figures', () => {
    const text = flatten("Summarize today's operational status.");
    expect(text).toContain('4,812');
    expect(text).toContain('615');
    expect(text).toContain('121');
  });

  it('gives a unit briefing when a building is named', () => {
    const answer = answerQuestion(twin, 'Tell me about Housing Unit D');
    expect(answer.focus).toEqual(['housing-d']);
    expect(answer.headline).toContain('Housing Unit D');
  });

  it('resolves shorthand unit references', () => {
    expect(answerQuestion(twin, 'how is unit e doing').focus).toEqual([
      'housing-e',
    ]);
  });

  it('falls back gracefully on an unrelated question', () => {
    const answer = answerQuestion(twin, 'what is the weather tomorrow');
    expect(answer.headline).toMatch(/don't have a grounded answer/);
    expect(answer.focus).toEqual([]);
  });

  it('only ever focuses on buildings that exist in the model', () => {
    const ids = new Set(twin.data.buildings.map((b) => b.id));
    for (const question of SUGGESTED_QUESTIONS) {
      for (const id of answerQuestion(twin, question).focus) {
        expect(ids.has(id)).toBe(true);
      }
    }
  });
});
