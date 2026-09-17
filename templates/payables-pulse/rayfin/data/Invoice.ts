import {
  authenticated,
  boolean,
  date,
  decimal,
  entity,
  one,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { Customer } from './Customer.js';
import type { InvoiceStatus } from './enums.js';
import { Vendor } from './Vendor.js';

/** A payable invoice. Read-only to clients once written by the demo loader. */
@entity()
@authenticated('read')
@authenticated('create')
@authenticated('delete')
export class Invoice {
  @uuid() id!: string;
  @text({ max: 30, unique: true }) invoiceNumber!: string;
  @one(() => Customer) customer!: Customer;
  @uuid() customer_id!: string;
  @one(() => Vendor) vendor!: Vendor;
  @uuid() vendor_id!: string;

  @decimal({ precision: 18, scale: 2 }) amount!: number;
  @text({ max: 3 }) currency!: string;
  @date() invoiceDate!: Date;
  @date() dueDate!: Date;

  @set(
    'received',
    'in-approval',
    'approved',
    'scheduled',
    'paid',
    'on-hold',
    'rejected'
  )
  status!: InvoiceStatus;

  @text({ max: 30, optional: true }) poNumber?: string;
  @boolean({ default: false }) isDuplicateSuspect!: boolean;
  @decimal({ precision: 8, scale: 2, default: 0 }) approvalHours!: number;
  @date() createdAt!: Date;
}
