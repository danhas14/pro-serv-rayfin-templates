/**
 * Tests for the secret redactor.
 *
 * The agent is instructed never to reproduce a secret, but an instruction to a
 * language model is guidance rather than a control. These runs use real
 * credentials for the customer's applications, and everything the agent returns
 * is persisted to a shared run history and exported to CSV — so this redactor
 * is the actual enforcement point and is worth pinning down.
 */
import { describe, expect, it } from 'vitest';

import { makeRedactor } from '@/services/testRunner';

describe('makeRedactor', () => {
  it('replaces a secret value with a named placeholder', () => {
    const redact = makeRedactor({ password: 'hunter2-long-enough' });
    expect(redact('Typed hunter2-long-enough into the field')).toBe(
      'Typed <secret:password> into the field'
    );
  });

  it('replaces every occurrence, not just the first', () => {
    const redact = makeRedactor({ pw: 'S3cretValue' });
    expect(redact('S3cretValue then S3cretValue')).toBe(
      '<secret:pw> then <secret:pw>'
    );
  });

  it('redacts the longest secret first so overlaps cannot partially mask', () => {
    const redact = makeRedactor({ short: 'abcd', long: 'abcdefgh' });
    // If "abcd" were applied first it would corrupt "abcdefgh" into
    // "<secret:short>efgh" and leave the longer secret partly readable.
    expect(redact('value abcdefgh here')).toBe('value <secret:long> here');
  });

  it('handles several distinct secrets in one string', () => {
    const redact = makeRedactor({ user: 'alice@example.com', pw: 'P@ssw0rd!' });
    expect(redact('login alice@example.com / P@ssw0rd!')).toBe(
      'login <secret:user> / <secret:pw>'
    );
  });

  it('ignores very short values that would corrupt unrelated text', () => {
    const redact = makeRedactor({ tiny: 'ab' });
    expect(redact('a table of absolute values')).toBe(
      'a table of absolute values'
    );
  });

  it('passes text through untouched when there are no secrets', () => {
    const redact = makeRedactor({});
    expect(redact('nothing to hide')).toBe('nothing to hide');
  });

  it('tolerates undefined input', () => {
    expect(makeRedactor({ pw: 'value123' })(undefined)).toBeUndefined();
    expect(makeRedactor({})(undefined)).toBeUndefined();
  });
});
