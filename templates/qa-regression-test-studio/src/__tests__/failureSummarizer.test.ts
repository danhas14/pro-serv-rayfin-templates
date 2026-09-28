import { describe, expect, it } from 'vitest';

import { parseSummaryResponse } from '@/services/failureSummarizer';

describe('parseSummaryResponse', () => {
  it('reads a plain JSON reply', () => {
    const result = parseSummaryResponse(
      '{"overall":"A pop-up blocked the test.","steps":[{"step":2,"plain":"The Categories menu could not be opened."}]}'
    );
    expect(result).toEqual({
      overall: 'A pop-up blocked the test.',
      steps: { 2: 'The Categories menu could not be opened.' },
    });
  });

  it('tolerates a markdown fence the model was told not to add', () => {
    const result = parseSummaryResponse(
      '```json\n{"overall":"Blocked.","steps":[]}\n```'
    );
    expect(result?.overall).toBe('Blocked.');
  });

  it('returns null rather than throwing on unparseable output', () => {
    expect(parseSummaryResponse('I could not summarise that.')).toBeNull();
  });

  it('returns null when the reply parses but carries nothing usable', () => {
    expect(parseSummaryResponse('{"overall":"","steps":[]}')).toBeNull();
  });

  it('drops malformed step entries but keeps the good ones', () => {
    const result = parseSummaryResponse(
      '{"overall":"x","steps":[{"step":"two","plain":"bad"},{"step":3,"plain":"good"}]}'
    );
    expect(result?.steps).toEqual({ 3: 'good' });
  });
});
