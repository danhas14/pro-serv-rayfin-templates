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

import { Customer } from './Customer.js';
import type { NoteType } from './enums.js';
import { PaymentException } from './PaymentException.js';
import { Vendor } from './Vendor.js';

/**
 * Free-text operational commentary.
 *
 * A note can hang off an exception, a customer (Customer Success follow-up) or
 * a vendor (vendor review). Creates are bound to the acting identity and notes
 * are never updatable or deletable.
 */
@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.author_user_id),
})
@authenticated('delete')
export class ExceptionNote {
  @uuid() id!: string;
  @one(() => PaymentException, { optional: true }) exception?: PaymentException;
  @uuid({ optional: true }) exception_id?: string;
  @one(() => Customer, { optional: true }) customer?: Customer;
  @uuid({ optional: true }) customer_id?: string;
  @one(() => Vendor, { optional: true }) vendor?: Vendor;
  @uuid({ optional: true }) vendor_id?: string;

  @text({ max: 100 }) author_user_id!: string;
  @text({ max: 120 }) authorName!: string;
  @text({ max: 60 }) authorRole!: string;
  @text({ max: 1000 }) body!: string;

  @set(
    'operational',
    'customer-followup',
    'vendor-review',
    'resolution',
    'escalation'
  )
  noteType!: NoteType;

  @date() createdAt!: Date;
  @boolean({ default: true }) isInternal!: boolean;
}
