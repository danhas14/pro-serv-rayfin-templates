import type { AppRole } from './enums';

/**
 * Every privileged operation in Payables Pulse maps to exactly one capability.
 *
 * `assertCapability` is the single choke point the service layer calls before
 * any mutation, so a page cannot perform a write that its role is not granted
 * even if a control were mistakenly rendered.
 */
export type Capability =
  | 'exception.assign'
  | 'exception.changePriority'
  | 'exception.changeStatus'
  | 'exception.addNote'
  | 'exception.retry'
  | 'exception.resolve'
  | 'exception.escalate'
  | 'customer.addNote'
  | 'vendor.addNote'
  | 'vendor.flag'
  | 'admin.manageConfig'
  | 'admin.manageUsers'
  | 'admin.resetDemoData';

const MANAGER: Capability[] = [
  'exception.assign',
  'exception.changePriority',
  'exception.changeStatus',
  'exception.addNote',
  'exception.retry',
  'exception.resolve',
  'exception.escalate',
  'customer.addNote',
  'vendor.addNote',
  'vendor.flag',
  'admin.manageConfig',
  'admin.manageUsers',
  'admin.resetDemoData',
];

const SPECIALIST: Capability[] = [
  'exception.assign',
  'exception.changePriority',
  'exception.changeStatus',
  'exception.addNote',
  'exception.retry',
  'exception.resolve',
  'exception.escalate',
  'vendor.addNote',
  'vendor.flag',
];

const CUSTOMER_SUCCESS: Capability[] = ['customer.addNote'];

const AUDITOR: Capability[] = [];

export const ROLE_CAPABILITIES: Record<AppRole, Capability[]> = {
  'operations-manager': MANAGER,
  'payment-operations-specialist': SPECIALIST,
  'customer-success-manager': CUSTOMER_SUCCESS,
  auditor: AUDITOR,
};

/** Pages each role is allowed to open. */
export const ROLE_ROUTES: Record<AppRole, string[]> = {
  'operations-manager': [
    '/',
    '/exceptions',
    '/customers',
    '/vendors',
    '/admin',
    '/audit',
  ],
  'payment-operations-specialist': [
    '/',
    '/exceptions',
    '/customers',
    '/vendors',
    '/audit',
  ],
  'customer-success-manager': ['/', '/customers', '/exceptions', '/audit'],
  auditor: ['/', '/exceptions', '/customers', '/vendors', '/audit'],
};

export class AuthorizationError extends Error {
  readonly capability: Capability;

  constructor(capability: Capability, role: AppRole) {
    super(
      `Your role (${role}) is not permitted to perform this action (${capability}).`
    );
    this.name = 'AuthorizationError';
    this.capability = capability;
  }
}

/**
 * The effective role is the intersection of the identity's real role and any
 * "view as" down-scoping. Down-scoping can only remove capabilities.
 */
export function effectiveCapabilities(
  realRole: AppRole,
  viewAsRole: AppRole | null
): Capability[] {
  const real = ROLE_CAPABILITIES[realRole];
  if (!viewAsRole || viewAsRole === realRole) return real;
  const scoped = new Set(ROLE_CAPABILITIES[viewAsRole]);
  return real.filter((c) => scoped.has(c));
}

export function can(
  capabilities: Capability[],
  capability: Capability
): boolean {
  return capabilities.includes(capability);
}

export function assertCapability(
  capabilities: Capability[],
  capability: Capability,
  role: AppRole
): void {
  if (!capabilities.includes(capability)) {
    throw new AuthorizationError(capability, role);
  }
}

export function canOpenRoute(role: AppRole, path: string): boolean {
  const allowed = ROLE_ROUTES[role];
  return allowed.some((p) => (p === '/' ? path === '/' : path.startsWith(p)));
}
