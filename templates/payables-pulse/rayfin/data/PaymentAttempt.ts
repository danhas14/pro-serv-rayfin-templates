import {
  authenticated,
  boolean,
  date,
  entity,
  int,
  one,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import type { AttemptOutcome } from './enums.js';
import { Payment } from './Payment.js';

/** One send attempt for a payment. Append-only — never updated. */
@entity()
@authenticated('read')
@authenticated('create')
@authenticated('delete')
export class PaymentAttempt {
  @uuid() id!: string;
  @one(() => Payment) payment!: Payment;
  @uuid() payment_id!: string;
  @int() attemptNumber!: number;
  @date() attemptedAt!: Date;

  @set('success', 'failed', 'pending', 'rejected') outcome!: AttemptOutcome;

  @text({ max: 20 }) responseCode!: string;
  @text({ max: 200 }) responseMessage!: string;
  @text({ max: 40 }) channel!: string;
  @boolean({ default: false }) isSimulatedRetry!: boolean;
}
