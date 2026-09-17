import {
  authenticated,
  date,
  decimal,
  entity,
  int,
  text,
  uuid,
} from '@microsoft/rayfin-core';

/**
 * Pre-aggregated daily operating figures.
 *
 * The command centre reads ~90 of these rows instead of paging through every
 * payment, which keeps the dashboard fast on a Data API Builder backend that
 * has no server-side aggregation.
 */
@entity()
@authenticated('read')
@authenticated(['create', 'update', 'delete'])
export class DailyOperationalMetric {
  @uuid() id!: string;
  @text({ max: 10, unique: true }) metricDateKey!: string;
  @date() metricDate!: Date;

  @decimal({ precision: 18, scale: 2, default: 0 }) totalPaymentValue!: number;
  @int({ default: 0 }) paymentCount!: number;
  @int({ default: 0 }) straightThroughCount!: number;
  @decimal({ precision: 5, scale: 2, default: 0 }) stpRate!: number;
  @int({ default: 0 }) exceptionsCreated!: number;
  @int({ default: 0 }) exceptionsResolved!: number;
  @int({ default: 0 }) openExceptions!: number;
  @int({ default: 0 }) highPriorityOpen!: number;
  @int({ default: 0 }) slaAtRisk!: number;
  @decimal({ precision: 8, scale: 2, default: 0 }) avgResolutionHours!: number;
  @decimal({ precision: 18, scale: 2, default: 0 }) rebateOpportunity!: number;

  @decimal({ precision: 18, scale: 2, default: 0 }) achValue!: number;
  @decimal({ precision: 18, scale: 2, default: 0 }) checkValue!: number;
  @decimal({ precision: 18, scale: 2, default: 0 }) virtualCardValue!: number;
  @decimal({ precision: 18, scale: 2, default: 0 }) wireValue!: number;
  @decimal({ precision: 18, scale: 2, default: 0 }) crossBorderValue!: number;

  @int({ default: 0 }) achCount!: number;
  @int({ default: 0 }) checkCount!: number;
  @int({ default: 0 }) virtualCardCount!: number;
  @int({ default: 0 }) wireCount!: number;
  @int({ default: 0 }) crossBorderCount!: number;
  @int({ default: 0 }) domesticCount!: number;
}
