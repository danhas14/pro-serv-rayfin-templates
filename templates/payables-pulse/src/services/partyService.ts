import type { NoteType } from '../domain/enums';

import { tryRecordAudit } from './auditService';
import {
  EXCEPTION_NOTE_COLUMNS,
  type CustomerRow,
  type ExceptionNoteRow,
  type VendorRow,
} from './columns';
import { authorize, type OperationContext } from './context';
import { currentSessionUserId, db, withRelationships } from './dataUtils';

export async function listCustomerNotes(
  customerId: string
): Promise<ExceptionNoteRow[]> {
  return db()
    .ExceptionNote.select([...EXCEPTION_NOTE_COLUMNS])
    .where({ customer_id: { eq: customerId } })
    .orderBy({ createdAt: 'desc' })
    .first(100)
    .execute();
}

export async function listVendorNotes(
  vendorId: string
): Promise<ExceptionNoteRow[]> {
  return db()
    .ExceptionNote.select([...EXCEPTION_NOTE_COLUMNS])
    .where({ vendor_id: { eq: vendorId } })
    .orderBy({ createdAt: 'desc' })
    .first(100)
    .execute();
}

export async function addCustomerNote(
  ctx: OperationContext,
  customer: CustomerRow,
  body: string
): Promise<void> {
  authorize(ctx, 'customer.addNote');

  await db().ExceptionNote.create(
    withRelationships(
      {
        author_user_id: currentSessionUserId(),
        authorName: ctx.actor.name,
        authorRole: ctx.actor.role,
        body: body.slice(0, 1000),
        noteType: 'customer-followup' as NoteType,
        createdAt: new Date(),
        isInternal: true,
      },
      [],
      { customer: { id: customer.id } }
    )
  );

  await tryRecordAudit(ctx.actor, {
    entityType: 'Customer',
    entityId: customer.id,
    entityLabel: customer.name,
    action: 'note-added',
    fieldName: 'customerFollowUp',
    newValue: body.slice(0, 200),
  });
}

export async function addVendorReviewNote(
  ctx: OperationContext,
  vendor: VendorRow,
  body: string
): Promise<void> {
  authorize(ctx, 'vendor.addNote');

  await db().ExceptionNote.create(
    withRelationships(
      {
        author_user_id: currentSessionUserId(),
        authorName: ctx.actor.name,
        authorRole: ctx.actor.role,
        body: body.slice(0, 1000),
        noteType: 'vendor-review' as NoteType,
        createdAt: new Date(),
        isInternal: true,
      },
      [],
      { vendor: { id: vendor.id } }
    )
  );

  await tryRecordAudit(ctx.actor, {
    entityType: 'Vendor',
    entityId: vendor.id,
    entityLabel: vendor.name,
    action: 'note-added',
    fieldName: 'vendorReview',
    newValue: body.slice(0, 200),
  });
}

export async function setVendorFlag(
  ctx: OperationContext,
  vendor: VendorRow,
  flagged: boolean,
  reviewNote?: string
): Promise<void> {
  authorize(ctx, 'vendor.flag');

  await db().Vendor.update(
    { id: vendor.id },
    { flaggedForReview: flagged, reviewNote: reviewNote?.slice(0, 400) }
  );

  await tryRecordAudit(ctx.actor, {
    entityType: 'Vendor',
    entityId: vendor.id,
    entityLabel: vendor.name,
    action: 'update',
    fieldName: 'flaggedForReview',
    previousValue: String(vendor.flaggedForReview),
    newValue: String(flagged),
    explanation: reviewNote,
  });
}
