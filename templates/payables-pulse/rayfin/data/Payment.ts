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

import { Customer } from './Customer.js';
import type { PaymentMethod, PaymentStatus } from './enums.js';
import { Invoice } from './Invoice.js';
import { Vendor } from './Vendor.js';

/**
 * A payment instruction against an invoice.
 *
 * Update is restricted at the API layer to the columns a simulated retry is
 * allowed to touch, so amounts and identifiers can never be rewritten.
 */
@entity()
@authenticated('read')
@authenticated('create')
@authenticated('delete')
@authenticated('update', {
  include: ['status', 'settledAt', 'attemptCount', 'processingHours'],
})
export class Payment {
  @uuid() id!: string;
  @text({ max: 30, unique: true }) paymentReference!: string;
  @one(() => Invoice) invoice!: Invoice;
  @uuid() invoice_id!: string;
  @one(() => Customer) customer!: Customer;
  @uuid() customer_id!: string;
  @one(() => Vendor) vendor!: Vendor;
  @uuid() vendor_id!: string;

  @decimal({ precision: 18, scale: 2 }) amount!: number;
  @text({ max: 3 }) currency!: string;
  @decimal({ precision: 18, scale: 2 }) amountUsd!: number;

  @set('ach', 'check', 'virtual-card', 'wire', 'cross-border')
  paymentMethod!: PaymentMethod;

  @set(
    'initiated',
    'processing',
    'settled',
    'failed',
    'returned',
    'on-hold',
    'cancelled'
  )
  status!: PaymentStatus;

  @date() initiatedAt!: Date;
  @date({ optional: true }) settledAt?: Date;
  @text({ max: 60 }) country!: string;
  @boolean({ default: false }) isCrossBorder!: boolean;
  @boolean({ default: true }) straightThrough!: boolean;
  @int({ default: 1 }) attemptCount!: number;
  @decimal({ precision: 8, scale: 2, default: 0 }) processingHours!: number;
  @boolean({ default: false }) rebateEligible!: boolean;
  @decimal({ precision: 18, scale: 2, default: 0 }) rebateAmount!: number;
  @date() createdAt!: Date;
}
