import {
  authenticated,
  boolean,
  entity,
  int,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import type { ExceptionPriority } from './enums.js';

/** Resolution-time targets used to compute SLA due dates and risk banding. */
@entity()
@authenticated('read')
@authenticated(['create', 'update', 'delete'])
export class ServiceLevelRule {
  @uuid() id!: string;
  @text({ max: 80 }) name!: string;

  @set('critical', 'high', 'medium', 'low') priority!: ExceptionPriority;

  /** `all` means the rule is not scoped to a single payment method. */
  @set('all', 'ach', 'check', 'virtual-card', 'wire', 'cross-border')
  paymentMethod!: 'all' | 'ach' | 'check' | 'virtual-card' | 'wire' | 'cross-border';

  @int() targetHours!: number;
  @int({ default: 75 }) warningThresholdPct!: number;
  @text({ max: 300 }) description!: string;
  @boolean({ default: true }) isActive!: boolean;
}
