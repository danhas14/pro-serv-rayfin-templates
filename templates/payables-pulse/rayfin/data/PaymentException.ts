import {
  authenticated,
  boolean,
  date,
  decimal,
  entity,
  int,
  one,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { AppUser } from './AppUser.js';
import { Customer } from './Customer.js';
import type {
  ExceptionPriority,
  ExceptionStatus,
  ExceptionType,
  PaymentMethod,
  SlaRisk,
} from './enums.js';
import { Invoice } from './Invoice.js';
import { Payment } from './Payment.js';
import { ResolutionCategory } from './ResolutionCategory.js';
import { Vendor } from './Vendor.js';

/**
 * An invoice or payment exception worked by the operations team.
 *
 * The `exclude` list on update is the server-side guarantee that the financial
 * facts of an exception (amount, currency, identifiers, creation time) cannot
 * be rewritten by any signed-in user, whatever the UI allows.
 */
@entity()
@authenticated('read')
@authenticated('create')
@authenticated('delete')
@authenticated('update', {
  exclude: [
    'exceptionCode',
    'amount',
    'currency',
    'createdAt',
    'invoiceNumber',
    'paymentReference',
  ],
})
export class PaymentException {
  @uuid() id!: string;
  @text({ max: 20, unique: true }) exceptionCode!: string;

  @one(() => Customer) customer!: Customer;
  @uuid() customer_id!: string;
  @one(() => Vendor, { optional: true }) vendor?: Vendor;
  @uuid({ optional: true }) vendor_id?: string;
  @one(() => Invoice, { optional: true }) invoice?: Invoice;
  @uuid({ optional: true }) invoice_id?: string;
  @one(() => Payment, { optional: true }) payment?: Payment;
  @uuid({ optional: true }) payment_id?: string;
  @one(() => AppUser, { optional: true }) assignedTo?: AppUser;
  @uuid({ optional: true }) assignedTo_id?: string;
  @one(() => ResolutionCategory, { optional: true })
  resolutionCategory?: ResolutionCategory;
  @uuid({ optional: true }) resolutionCategory_id?: string;

  @text({ max: 30 }) invoiceNumber!: string;
  @text({ max: 30, optional: true }) paymentReference?: string;
  @decimal({ precision: 18, scale: 2 }) amount!: number;
  @text({ max: 3 }) currency!: string;
  @decimal({ precision: 18, scale: 2 }) amountUsd!: number;

  @set('ach', 'check', 'virtual-card', 'wire', 'cross-border')
  paymentMethod!: PaymentMethod;

  @set(
    'duplicate-invoice',
    'approval-overdue',
    'missing-remittance',
    'invalid-bank-details',
    'vc-not-enrolled',
    'payment-rejected',
    'compliance-review',
    'currency-mismatch',
    'funding-issue',
    'suspected-fraud',
    'file-validation-failure'
  )
  exceptionType!: ExceptionType;

  @set('critical', 'high', 'medium', 'low') priority!: ExceptionPriority;

  @set(
    'new',
    'investigating',
    'waiting-customer',
    'waiting-vendor',
    'ready-to-retry',
    'resolved',
    'closed'
  )
  status!: ExceptionStatus;

  @set('on-track', 'at-risk', 'breached') slaRisk!: SlaRisk;

  @text({ max: 60 }) country!: string;
  @boolean({ default: false }) isCrossBorder!: boolean;
  @text({ max: 300 }) reason!: string;
  @text({ max: 300 }) recommendedAction!: string;
  @text({ max: 400, optional: true }) resolutionNote?: string;

  @int() slaTargetHours!: number;
  @date() slaDueAt!: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
  @date({ optional: true }) resolvedAt?: Date;
  @int({ default: 0 }) retryCount!: number;
  @int({ default: 0 }) reopenCount!: number;
  @boolean({ default: false }) escalated!: boolean;
}
