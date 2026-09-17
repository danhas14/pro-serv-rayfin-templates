import {
  authenticated,
  date,
  decimal,
  entity,
  one,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import type { ExceptionStatus } from './enums.js';
import { PaymentException } from './PaymentException.js';

/** Immutable status transition log for an exception. */
@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.changed_by_user_id),
})
@authenticated('delete')
export class ExceptionStatusHistory {
  @uuid() id!: string;
  @one(() => PaymentException) exception!: PaymentException;
  @uuid() exception_id!: string;

  @set(
    'new',
    'investigating',
    'waiting-customer',
    'waiting-vendor',
    'ready-to-retry',
    'resolved',
    'closed'
  )
  fromStatus!: ExceptionStatus;

  @set(
    'new',
    'investigating',
    'waiting-customer',
    'waiting-vendor',
    'ready-to-retry',
    'resolved',
    'closed'
  )
  toStatus!: ExceptionStatus;

  @date() changedAt!: Date;
  @text({ max: 100 }) changed_by_user_id!: string;
  @text({ max: 120 }) changedByName!: string;
  @decimal({ precision: 8, scale: 2, default: 0 }) durationHours!: number;
  @text({ max: 300, optional: true }) note?: string;
}
