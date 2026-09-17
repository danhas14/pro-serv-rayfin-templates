import {
  authenticated,
  boolean,
  entity,
  int,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import type { ExceptionPriority, ExceptionType } from './enums.js';

/** Configurable catalogue of exception categories (Administration page). */
@entity()
@authenticated('read')
@authenticated(['create', 'update', 'delete'])
export class ExceptionCategory {
  @uuid() id!: string;

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
  code!: ExceptionType;

  @text({ max: 80 }) name!: string;
  @text({ max: 300 }) description!: string;

  @set('critical', 'high', 'medium', 'low')
  defaultPriority!: ExceptionPriority;

  @int() defaultSlaHours!: number;
  @text({ max: 300 }) recommendedAction!: string;
  @boolean({ default: true }) isActive!: boolean;
  @int({ default: 0 }) sortOrder!: number;
}
