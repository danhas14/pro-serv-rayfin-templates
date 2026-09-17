import {
  authenticated,
  boolean,
  date,
  decimal,
  entity,
  int,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import type { BankDetailsStatus, PaymentMethod } from './enums.js';

/**
 * A payee. Only the operational review columns are writable by clients; the
 * `include` list is the server-side guard that keeps payment facts immutable.
 */
@entity()
@authenticated('read')
@authenticated('create')
@authenticated('delete')
@authenticated('update', {
  include: [
    'flaggedForReview',
    'reviewNote',
    'virtualCardEnrolled',
    'bankDetailsStatus',
    'remittanceEmail',
    'preferredPaymentMethod',
  ],
})
export class Vendor {
  @uuid() id!: string;
  @text({ max: 20, unique: true }) vendorCode!: string;
  @text({ max: 120 }) name!: string;
  @text({ max: 60 }) category!: string;
  @text({ max: 60 }) country!: string;
  @text({ max: 3 }) currency!: string;
  @text({ max: 120, optional: true }) remittanceEmail?: string;

  @set('ach', 'check', 'virtual-card', 'wire', 'cross-border')
  preferredPaymentMethod!: PaymentMethod;

  @boolean({ default: false }) virtualCardEligible!: boolean;
  @boolean({ default: false }) virtualCardEnrolled!: boolean;

  @set('verified', 'incomplete', 'outdated', 'invalid')
  bankDetailsStatus!: BankDetailsStatus;

  @date({ optional: true }) lastPaymentAt?: Date;
  @int({ default: 0 }) paymentCount90d!: number;
  @int({ default: 0 }) failedPaymentCount!: number;
  @int({ default: 0 }) delayedPaymentCount!: number;
  @int({ default: 0 }) duplicateInvoiceCount!: number;
  @int({ default: 0 }) exceptionCount!: number;
  @decimal({ precision: 8, scale: 2, default: 0 }) avgDaysToPay!: number;
  @decimal({ precision: 5, scale: 2, default: 0 })
  exceptionRecurrenceRate!: number;

  @boolean({ default: false }) flaggedForReview!: boolean;
  @text({ max: 400, optional: true }) reviewNote?: string;
}
