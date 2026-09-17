import {
  authenticated,
  boolean,
  date,
  entity,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import type { AppRole } from './enums.js';

/**
 * A Payables Pulse operator. The signed-in identity is matched to a row by
 * email, which is why `email` is immutable.
 *
 * Two server-side controls are compiled into the Data API Builder policy:
 * a row can only be updated by *someone else* (`claims.email ne item.email`),
 * and `email` can never be rewritten. Together they mean no signed-in user can
 * change their own role — privilege escalation is blocked at the API, not by
 * hiding a button.
 */
@entity()
@authenticated('read')
@authenticated('create')
@authenticated('update', {
  policy: (claims, item) => claims.email.neq(item.email),
  exclude: ['email'],
})
export class AppUser {
  @uuid() id!: string;
  @text({ max: 120, unique: true }) email!: string;
  @text({ max: 100 }) displayName!: string;
  @text({ max: 4 }) initials!: string;
  @text({ max: 80 }) teamName!: string;

  @set(
    'operations-manager',
    'payment-operations-specialist',
    'customer-success-manager',
    'auditor'
  )
  primaryRole!: AppRole;

  @boolean({ default: true }) isActive!: boolean;
  @boolean({ default: false }) isDemoPersona!: boolean;
  @date() createdAt!: Date;
}
