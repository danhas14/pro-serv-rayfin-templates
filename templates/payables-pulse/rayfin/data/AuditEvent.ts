import {
  authenticated,
  date,
  entity,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import type { AuditAction } from './enums.js';

/**
 * Immutable audit trail.
 *
 * Only `read` and `create` are granted, and creates must carry the acting
 * identity from the token, so audit rows can never be forged, altered or
 * removed through the data API.
 */
@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.acting_user_id),
})
export class AuditEvent {
  @uuid() id!: string;
  @text({ max: 100 }) acting_user_id!: string;
  @text({ max: 120 }) actingUserName!: string;
  @text({ max: 120 }) actingUserEmail!: string;
  @text({ max: 60 }) actingUserRole!: string;
  @date() occurredAt!: Date;
  @text({ max: 60 }) entityType!: string;
  @text({ max: 60 }) entityId!: string;
  @text({ max: 60 }) entityLabel!: string;

  @set(
    'create',
    'update',
    'assign',
    'reassign',
    'status-change',
    'priority-change',
    'note-added',
    'retry-simulated',
    'escalated',
    'resolved',
    'closed',
    'config-change',
    'demo-data-reset'
  )
  action!: AuditAction;

  @text({ max: 60, optional: true }) fieldName?: string;
  @text({ max: 400, optional: true }) previousValue?: string;
  @text({ max: 400, optional: true }) newValue?: string;
  @text({ max: 400, optional: true }) explanation?: string;
}
