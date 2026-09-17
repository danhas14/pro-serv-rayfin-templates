import type { AppRole } from '../domain/enums';
import { initialsOf } from '../lib/format';

import type { UserRow } from './columns';
import { db } from './dataUtils';
import { listUsers } from './referenceService';

import type { AuthUser } from './interfaces/IAuthService';

export interface ResolvedIdentity {
  user: UserRow;
  /** True when this sign-in created the operator record. */
  provisioned: boolean;
}

/**
 * Map the signed-in session onto an `AppUser` record.
 *
 * Matching is by email because email is the one identity field the data API
 * refuses to let anyone rewrite. If the identity is unknown, an operator record
 * is provisioned: the first identity to sign in bootstraps as Operations
 * Manager, everyone after that starts as a Payment Operations Specialist.
 * From then on the API's separation-of-duties policy applies — nobody can
 * change their own role.
 */
export async function resolveIdentity(
  authUser: AuthUser
): Promise<ResolvedIdentity> {
  const email = authUser.email.trim().toLowerCase();
  const users = await listUsers();

  const existing = users.find((u) => u.email.toLowerCase() === email);
  if (existing) return { user: existing, provisioned: false };

  const hasRealOperator = users.some((u) => !u.isDemoPersona);
  const role: AppRole = hasRealOperator
    ? 'payment-operations-specialist'
    : 'operations-manager';

  const displayName = friendlyName(authUser);

  const created = await db().AppUser.create({
    email,
    displayName,
    initials: initialsOf(displayName) || 'PP',
    teamName: 'Payment Operations',
    primaryRole: role,
    isActive: true,
    isDemoPersona: false,
    createdAt: new Date(),
  });

  return { user: created as UserRow, provisioned: true };
}

function friendlyName(authUser: AuthUser): string {
  if (authUser.name && authUser.name !== authUser.email) return authUser.name;
  const local = authUser.email.split('@')[0] ?? 'Operator';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
