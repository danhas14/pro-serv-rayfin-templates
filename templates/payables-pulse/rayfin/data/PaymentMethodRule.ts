import {
  authenticated,
  boolean,
  decimal,
  entity,
  int,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import type { PaymentMethod } from './enums.js';

/** Operating limits and controls applied per payment method. */
@entity()
@authenticated('read')
@authenticated(['create', 'update', 'delete'])
export class PaymentMethodRule {
  @uuid() id!: string;

  @set('ach', 'check', 'virtual-card', 'wire', 'cross-border')
  paymentMethod!: PaymentMethod;

  @text({ max: 60 }) displayName!: string;
  @decimal({ precision: 18, scale: 2, default: 0 }) minAmount!: number;
  @decimal({ precision: 18, scale: 2 }) maxAmount!: number;
  @text({ max: 10 }) cutoffTimeUtc!: string;
  @int({ default: 2 }) retryLimit!: number;
  @int({ default: 24 }) expectedSettlementHours!: number;
  @decimal({ precision: 5, scale: 2, default: 0 }) rebateRatePct!: number;
  @boolean({ default: false }) requiresBankVerification!: boolean;
  @boolean({ default: false }) requiresComplianceReview!: boolean;
  @boolean({ default: true }) isActive!: boolean;
  @text({ max: 300 }) notes!: string;
}
