import { describe, expect, it } from 'vitest';

import {
  AuthorizationError,
  assertCapability,
  canOpenRoute,
  effectiveCapabilities,
  ROLE_CAPABILITIES,
} from '@/domain/policy';

describe('role capabilities', () => {
  it('gives the Operations Manager every capability', () => {
    expect(ROLE_CAPABILITIES['operations-manager']).toContain(
      'admin.manageUsers'
    );
    expect(ROLE_CAPABILITIES['operations-manager']).toContain('exception.retry');
  });

  it('keeps the Customer Success Manager out of payment records', () => {
    const caps = ROLE_CAPABILITIES['customer-success-manager'];
    expect(caps).toEqual(['customer.addNote']);
    expect(caps).not.toContain('exception.changeStatus');
  });

  it('gives the Auditor no write capability at all', () => {
    expect(ROLE_CAPABILITIES.auditor).toEqual([]);
  });
});

describe('effectiveCapabilities', () => {
  it('returns the real role capabilities when not viewing as another role', () => {
    expect(effectiveCapabilities('operations-manager', null)).toEqual(
      ROLE_CAPABILITIES['operations-manager']
    );
  });

  it('only ever removes capabilities when down-scoping', () => {
    const scoped = effectiveCapabilities('operations-manager', 'auditor');
    expect(scoped).toEqual([]);
  });

  it('cannot grant a capability the real role does not have', () => {
    const scoped = effectiveCapabilities(
      'customer-success-manager',
      'operations-manager'
    );
    expect(scoped).toEqual(['customer.addNote']);
    expect(scoped).not.toContain('admin.manageUsers');
  });
});

describe('assertCapability', () => {
  it('throws for a capability the role does not hold', () => {
    expect(() =>
      assertCapability(ROLE_CAPABILITIES.auditor, 'exception.retry', 'auditor')
    ).toThrow(AuthorizationError);
  });

  it('passes for a granted capability', () => {
    expect(() =>
      assertCapability(
        ROLE_CAPABILITIES['payment-operations-specialist'],
        'exception.retry',
        'payment-operations-specialist'
      )
    ).not.toThrow();
  });
});

describe('canOpenRoute', () => {
  it('blocks Administration for everyone but the Operations Manager', () => {
    expect(canOpenRoute('operations-manager', '/admin')).toBe(true);
    expect(canOpenRoute('payment-operations-specialist', '/admin')).toBe(false);
    expect(canOpenRoute('auditor', '/admin')).toBe(false);
  });

  it('allows nested exception routes for the specialist', () => {
    expect(
      canOpenRoute('payment-operations-specialist', '/exceptions/abc-123')
    ).toBe(true);
  });

  it('keeps Customer Success out of Vendor Insights', () => {
    expect(canOpenRoute('customer-success-manager', '/vendors')).toBe(false);
  });
});
