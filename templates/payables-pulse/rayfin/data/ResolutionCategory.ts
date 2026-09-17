import {
  authenticated,
  boolean,
  entity,
  int,
  text,
  uuid,
} from '@microsoft/rayfin-core';

/** Outcome taxonomy recorded when an exception is resolved. */
@entity()
@authenticated('read')
@authenticated(['create', 'update', 'delete'])
export class ResolutionCategory {
  @uuid() id!: string;
  @text({ max: 40, unique: true }) code!: string;
  @text({ max: 80 }) name!: string;
  @text({ max: 300 }) description!: string;
  @boolean({ default: false }) requiresNote!: boolean;
  @boolean({ default: true }) isActive!: boolean;
  @int({ default: 0 }) sortOrder!: number;
}
