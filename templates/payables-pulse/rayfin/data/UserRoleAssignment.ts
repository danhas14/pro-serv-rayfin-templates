import {
  authenticated,
  boolean,
  date,
  entity,
  one,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { AppUser } from './AppUser.js';
import type { AppRole } from './enums.js';

/**
 * Append-only history of role grants.
 *
 * Two server-side controls are compiled into the Data API Builder policy:
 * the grant must be stamped with the acting identity (`claims.sub`), and the
 * acting identity must differ from the target identity — so no signed-in user
 * can grant a role to themselves, regardless of what the UI offers.
 */
@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) =>
    claims.sub
      .eq(item.assigned_by_user_id)
      .and(claims.sub.neq(item.target_user_id)),
})
@authenticated('delete')
export class UserRoleAssignment {
  @uuid() id!: string;
  @one(() => AppUser) user!: AppUser;
  @uuid() user_id!: string;
  /** The target's `sub` when known, otherwise their AppUser id. */
  @text({ max: 100 }) target_user_id!: string;

  @set(
    'operations-manager',
    'payment-operations-specialist',
    'customer-success-manager',
    'auditor'
  )
  role!: AppRole;

  @date() assignedAt!: Date;
  @text({ max: 100 }) assigned_by_user_id!: string;
  @text({ max: 120 }) assignedByName!: string;
  @boolean({ default: true }) isActive!: boolean;
  @text({ max: 300, optional: true }) reason?: string;
}
