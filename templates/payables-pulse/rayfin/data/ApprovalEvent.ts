import {
  authenticated,
  date,
  decimal,
  entity,
  int,
  one,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import type { ApprovalAction } from './enums.js';
import { Invoice } from './Invoice.js';

/** A step in an invoice approval workflow. Append-only. */
@entity()
@authenticated('read')
@authenticated('create')
@authenticated('delete')
export class ApprovalEvent {
  @uuid() id!: string;
  @one(() => Invoice) invoice!: Invoice;
  @uuid() invoice_id!: string;
  @int() stepNumber!: number;
  @text({ max: 80 }) stepName!: string;
  @text({ max: 100 }) approverName!: string;
  @text({ max: 80 }) approverRole!: string;

  @set('submitted', 'approved', 'rejected', 'returned', 'escalated', 'pending')
  action!: ApprovalAction;

  @date() occurredAt!: Date;
  @decimal({ precision: 8, scale: 2, default: 0 }) elapsedHours!: number;
  @text({ max: 300, optional: true }) note?: string;
}
