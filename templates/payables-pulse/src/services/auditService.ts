import {
  AUDIT_COLUMNS,
  type AuditRow,
} from './columns';
import { currentSessionUserId, db, MAX_ROWS } from './dataUtils';

import type { AuditAction } from '../../rayfin/data/enums';

export interface AuditActor {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export interface AuditInput {
  entityType: string;
  entityId: string;
  entityLabel: string;
  action: AuditAction;
  fieldName?: string;
  previousValue?: string;
  newValue?: string;
  explanation?: string;
}

/**
 * Append an audit record.
 *
 * Every write path in the app calls this. The `AuditEvent` entity grants only
 * read and create, and its create policy requires `acting_user_id` to equal the
 * caller's `sub` claim, so the trail cannot be forged, edited or deleted.
 */
export async function recordAudit(
  actor: AuditActor,
  input: AuditInput
): Promise<void> {
  await db().AuditEvent.create({
    acting_user_id: currentSessionUserId(),
    actingUserName: actor.name,
    actingUserEmail: actor.email,
    actingUserRole: actor.role,
    occurredAt: new Date(),
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    action: input.action,
    fieldName: input.fieldName,
    previousValue: truncate(input.previousValue),
    newValue: truncate(input.newValue),
    explanation: truncate(input.explanation),
  });
}

/** Best-effort audit write that never blocks the user-facing operation. */
export async function tryRecordAudit(
  actor: AuditActor,
  input: AuditInput
): Promise<void> {
  try {
    await recordAudit(actor, input);
  } catch (error) {
    console.error('Audit write failed', error);
  }
}

export async function listAuditEvents(limit = 200): Promise<AuditRow[]> {
  return db()
    .AuditEvent.select([...AUDIT_COLUMNS])
    .orderBy({ occurredAt: 'desc' })
    .first(Math.min(limit, MAX_ROWS))
    .execute();
}

export async function listAuditForEntity(
  entityId: string,
  limit = 100
): Promise<AuditRow[]> {
  return db()
    .AuditEvent.select([...AUDIT_COLUMNS])
    .where({ entityId: { eq: entityId } })
    .orderBy({ occurredAt: 'desc' })
    .first(limit)
    .execute();
}

function truncate(value: string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  return value.length > 380 ? `${value.slice(0, 377)}...` : value;
}
