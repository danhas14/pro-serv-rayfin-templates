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

import type { RiskLevel } from './enums.js';

/**
 * A business customer whose payables Payables Pulse operates.
 *
 * Rolled-up health figures are denormalised at seed/recalculation time so the
 * dashboards never have to page through every payment row at render time.
 */
@entity()
@authenticated('read')
@authenticated('create')
@authenticated('delete')
@authenticated('update', {
  // The customer code is the stable external key — never client-editable.
  exclude: ['customerCode'],
})
export class Customer {
  @uuid() id!: string;
  @text({ max: 20, unique: true }) customerCode!: string;
  @text({ max: 120 }) name!: string;
  @text({ max: 60 }) industry!: string;
  @text({ max: 60 }) country!: string;
  @text({ max: 3 }) baseCurrency!: string;
  @text({ max: 20 }) tier!: string;
  @date() onboardedAt!: Date;
  @boolean({ default: true }) isActive!: boolean;

  @decimal({ precision: 18, scale: 2, default: 0 }) paymentVolume90d!: number;
  @int({ default: 0 }) paymentCount90d!: number;
  @decimal({ precision: 5, scale: 2, default: 0 }) paymentSuccessRate!: number;
  @decimal({ precision: 5, scale: 2, default: 0 }) stpRate!: number;
  @decimal({ precision: 8, scale: 2, default: 0 }) avgApprovalHours!: number;
  @decimal({ precision: 8, scale: 2, default: 0 }) avgResolutionHours!: number;
  @decimal({ precision: 5, scale: 2, default: 0 }) exceptionRate!: number;
  @decimal({ precision: 5, scale: 2, default: 0 }) rejectedRate!: number;
  @decimal({ precision: 5, scale: 2, default: 0 }) virtualCardAdoption!: number;
  @decimal({ precision: 18, scale: 2, default: 0 }) estimatedRebate!: number;
  @int({ default: 0 }) healthScore!: number;

  @set('low', 'medium', 'high') riskLevel!: RiskLevel;
}
