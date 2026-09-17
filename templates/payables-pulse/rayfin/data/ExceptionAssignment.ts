import {
  authenticated,
  boolean,
  date,
  entity,
  one,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { AppUser } from './AppUser.js';
import { PaymentException } from './PaymentException.js';

/** Append-only assignment history for an exception. */
@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.assigned_by_user_id),
})
@authenticated('update', { include: ['isCurrent', 'unassignedAt'] })
@authenticated('delete')
export class ExceptionAssignment {
  @uuid() id!: string;
  @one(() => PaymentException) exception!: PaymentException;
  @uuid() exception_id!: string;
  @one(() => AppUser) assignedTo!: AppUser;
  @uuid() assignedTo_id!: string;
  @date() assignedAt!: Date;
  @date({ optional: true }) unassignedAt?: Date;
  @text({ max: 100 }) assigned_by_user_id!: string;
  @text({ max: 120 }) assignedByName!: string;
  @text({ max: 300, optional: true }) reason?: string;
  @boolean({ default: true }) isCurrent!: boolean;
}
