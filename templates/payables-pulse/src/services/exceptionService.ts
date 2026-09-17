import type { ExceptionPriority, ExceptionStatus, NoteType } from '../domain/enums';
import { hoursBetween } from '../lib/format';

import { tryRecordAudit } from './auditService';
import {
  APPROVAL_EVENT_COLUMNS,
  ASSIGNMENT_COLUMNS,
  EXCEPTION_COLUMNS,
  EXCEPTION_NOTE_COLUMNS,
  INVOICE_COLUMNS,
  PAYMENT_ATTEMPT_COLUMNS,
  PAYMENT_COLUMNS,
  STATUS_HISTORY_COLUMNS,
  type ApprovalEventRow,
  type AssignmentRow,
  type ExceptionNoteRow,
  type ExceptionRow,
  type InvoiceRow,
  type PaymentAttemptRow,
  type PaymentRow,
  type StatusHistoryRow,
  type UserRow,
} from './columns';
import { authorize, type OperationContext } from './context';
import {
  currentSessionUserId,
  db,
  MAX_ROWS,
  withRelationships,
} from './dataUtils';

export async function listExceptions(): Promise<ExceptionRow[]> {
  return db()
    .PaymentException.select([...EXCEPTION_COLUMNS])
    .orderBy({ createdAt: 'desc' })
    .first(MAX_ROWS)
    .execute();
}

export async function getException(id: string): Promise<ExceptionRow | null> {
  const rows = await db()
    .PaymentException.select([...EXCEPTION_COLUMNS])
    .where({ id: { eq: id } })
    .execute();
  return rows[0] ?? null;
}

export interface ExceptionDetailBundle {
  exception: ExceptionRow;
  invoice: InvoiceRow | null;
  payment: PaymentRow | null;
  attempts: PaymentAttemptRow[];
  approvals: ApprovalEventRow[];
  notes: ExceptionNoteRow[];
  history: StatusHistoryRow[];
  assignments: AssignmentRow[];
  related: ExceptionRow[];
}

export async function loadExceptionDetail(
  exception: ExceptionRow
): Promise<Omit<ExceptionDetailBundle, 'exception'>> {
  const client = db();

  const [invoiceRows, paymentRows, notes, history, assignments, related] =
    await Promise.all([
      exception.invoice_id
        ? client.Invoice.select([...INVOICE_COLUMNS])
            .where({ id: { eq: exception.invoice_id } })
            .execute()
        : Promise.resolve([] as InvoiceRow[]),
      exception.payment_id
        ? client.Payment.select([...PAYMENT_COLUMNS])
            .where({ id: { eq: exception.payment_id } })
            .execute()
        : Promise.resolve([] as PaymentRow[]),
      client.ExceptionNote.select([...EXCEPTION_NOTE_COLUMNS])
        .where({ exception_id: { eq: exception.id } })
        .orderBy({ createdAt: 'desc' })
        .first(200)
        .execute(),
      client.ExceptionStatusHistory.select([...STATUS_HISTORY_COLUMNS])
        .where({ exception_id: { eq: exception.id } })
        .orderBy({ changedAt: 'asc' })
        .first(200)
        .execute(),
      client.ExceptionAssignment.select([...ASSIGNMENT_COLUMNS])
        .where({ exception_id: { eq: exception.id } })
        .orderBy({ assignedAt: 'desc' })
        .first(50)
        .execute(),
      client.PaymentException.select([...EXCEPTION_COLUMNS])
        .where({ vendor_id: { eq: exception.vendor_id ?? '' } })
        .orderBy({ createdAt: 'desc' })
        .first(10)
        .execute(),
    ]);

  const payment = paymentRows[0] ?? null;
  const invoice = invoiceRows[0] ?? null;

  const [attempts, approvals] = await Promise.all([
    payment
      ? client.PaymentAttempt.select([...PAYMENT_ATTEMPT_COLUMNS])
          .where({ payment_id: { eq: payment.id } })
          .orderBy({ attemptNumber: 'asc' })
          .first(50)
          .execute()
      : Promise.resolve([] as PaymentAttemptRow[]),
    invoice
      ? client.ApprovalEvent.select([...APPROVAL_EVENT_COLUMNS])
          .where({ invoice_id: { eq: invoice.id } })
          .orderBy({ stepNumber: 'asc' })
          .first(50)
          .execute()
      : Promise.resolve([] as ApprovalEventRow[]),
  ]);

  return {
    invoice,
    payment,
    attempts,
    approvals,
    notes,
    history,
    assignments,
    related: related.filter((r) => r.id !== exception.id).slice(0, 5),
  };
}

/* ------------------------------------------------------------------ writes */

export async function assignException(
  ctx: OperationContext,
  exception: ExceptionRow,
  assignee: UserRow,
  reason?: string
): Promise<void> {
  authorize(ctx, 'exception.assign');
  const wasAssigned = !!exception.assignedTo_id;

  const previousAssignments = await db()
    .ExceptionAssignment.select(['id', 'isCurrent'])
    .where({ exception_id: { eq: exception.id }, isCurrent: { eq: true } })
    .first(20)
    .execute();

  await Promise.all(
    previousAssignments.map((a) =>
      db().ExceptionAssignment.update(
        { id: a.id },
        { isCurrent: false, unassignedAt: new Date() }
      )
    )
  );

  await db().ExceptionAssignment.create(
    withRelationships(
      {
        assignedAt: new Date(),
        assigned_by_user_id: currentSessionUserId(),
        assignedByName: ctx.actor.name,
        reason,
        isCurrent: true,
      },
      [],
      {
        exception: { id: exception.id },
        assignedTo: { id: assignee.id },
      }
    )
  );

  await db().PaymentException.update(
    { id: exception.id },
    withRelationships({ updatedAt: new Date() }, [], {
      assignedTo: { id: assignee.id },
    })
  );

  await tryRecordAudit(ctx.actor, {
    entityType: 'PaymentException',
    entityId: exception.id,
    entityLabel: exception.exceptionCode,
    action: wasAssigned ? 'reassign' : 'assign',
    fieldName: 'assignedTo',
    previousValue: exception.assignedTo_id ?? 'Unassigned',
    newValue: assignee.displayName,
    explanation: reason,
  });
}

export async function changePriority(
  ctx: OperationContext,
  exception: ExceptionRow,
  priority: ExceptionPriority,
  reason?: string
): Promise<void> {
  authorize(ctx, 'exception.changePriority');
  if (priority === exception.priority) return;

  await db().PaymentException.update(
    { id: exception.id },
    { priority, updatedAt: new Date() }
  );

  await tryRecordAudit(ctx.actor, {
    entityType: 'PaymentException',
    entityId: exception.id,
    entityLabel: exception.exceptionCode,
    action: 'priority-change',
    fieldName: 'priority',
    previousValue: exception.priority,
    newValue: priority,
    explanation: reason,
  });
}

export async function changeStatus(
  ctx: OperationContext,
  exception: ExceptionRow,
  toStatus: ExceptionStatus,
  note?: string
): Promise<void> {
  authorize(ctx, 'exception.changeStatus');
  if (toStatus === exception.status) return;

  const now = new Date();
  const patch: Record<string, unknown> = { status: toStatus, updatedAt: now };
  if (toStatus === 'resolved') patch.resolvedAt = now;
  if (
    (exception.status === 'resolved' || exception.status === 'closed') &&
    toStatus === 'investigating'
  ) {
    patch.reopenCount = (exception.reopenCount ?? 0) + 1;
    patch.resolvedAt = null;
  }

  await db().PaymentException.update({ id: exception.id }, patch);

  await db().ExceptionStatusHistory.create(
    withRelationships(
      {
        fromStatus: exception.status,
        toStatus,
        changedAt: now,
        changed_by_user_id: currentSessionUserId(),
        changedByName: ctx.actor.name,
        durationHours: Number(
          hoursBetween(exception.updatedAt, now).toFixed(2)
        ),
        note,
      },
      [],
      { exception: { id: exception.id } }
    )
  );

  await tryRecordAudit(ctx.actor, {
    entityType: 'PaymentException',
    entityId: exception.id,
    entityLabel: exception.exceptionCode,
    action:
      toStatus === 'closed'
        ? 'closed'
        : toStatus === 'resolved'
          ? 'resolved'
          : 'status-change',
    fieldName: 'status',
    previousValue: exception.status,
    newValue: toStatus,
    explanation: note,
  });
}

export async function addExceptionNote(
  ctx: OperationContext,
  exception: ExceptionRow,
  body: string,
  noteType: NoteType = 'operational'
): Promise<void> {
  authorize(ctx, 'exception.addNote');

  await db().ExceptionNote.create(
    withRelationships(
      {
        author_user_id: currentSessionUserId(),
        authorName: ctx.actor.name,
        authorRole: ctx.actor.role,
        body: body.slice(0, 1000),
        noteType,
        createdAt: new Date(),
        isInternal: true,
      },
      [],
      { exception: { id: exception.id } }
    )
  );

  await db().PaymentException.update(
    { id: exception.id },
    { updatedAt: new Date() }
  );

  await tryRecordAudit(ctx.actor, {
    entityType: 'PaymentException',
    entityId: exception.id,
    entityLabel: exception.exceptionCode,
    action: 'note-added',
    fieldName: 'notes',
    newValue: body.slice(0, 200),
  });
}

export async function escalateException(
  ctx: OperationContext,
  exception: ExceptionRow,
  reason: string
): Promise<void> {
  authorize(ctx, 'exception.escalate');

  await db().PaymentException.update(
    { id: exception.id },
    { escalated: true, priority: 'critical', updatedAt: new Date() }
  );

  await db().ExceptionNote.create(
    withRelationships(
      {
        author_user_id: currentSessionUserId(),
        authorName: ctx.actor.name,
        authorRole: ctx.actor.role,
        body: reason.slice(0, 1000),
        noteType: 'escalation' as NoteType,
        createdAt: new Date(),
        isInternal: true,
      },
      [],
      { exception: { id: exception.id } }
    )
  );

  await tryRecordAudit(ctx.actor, {
    entityType: 'PaymentException',
    entityId: exception.id,
    entityLabel: exception.exceptionCode,
    action: 'escalated',
    fieldName: 'escalated',
    previousValue: String(exception.escalated),
    newValue: 'true',
    explanation: reason,
  });
}

export async function resolveException(
  ctx: OperationContext,
  exception: ExceptionRow,
  resolutionCategoryId: string,
  resolutionCategoryName: string,
  resolutionNote: string
): Promise<void> {
  authorize(ctx, 'exception.resolve');
  const now = new Date();

  await db().PaymentException.update(
    { id: exception.id },
    withRelationships(
      {
        status: 'resolved' as ExceptionStatus,
        resolutionNote: resolutionNote.slice(0, 400),
        resolvedAt: now,
        updatedAt: now,
      },
      [],
      { resolutionCategory: { id: resolutionCategoryId } }
    )
  );

  await db().ExceptionStatusHistory.create(
    withRelationships(
      {
        fromStatus: exception.status,
        toStatus: 'resolved' as ExceptionStatus,
        changedAt: now,
        changed_by_user_id: currentSessionUserId(),
        changedByName: ctx.actor.name,
        durationHours: Number(hoursBetween(exception.createdAt, now).toFixed(2)),
        note: resolutionNote.slice(0, 300),
      },
      [],
      { exception: { id: exception.id } }
    )
  );

  await tryRecordAudit(ctx.actor, {
    entityType: 'PaymentException',
    entityId: exception.id,
    entityLabel: exception.exceptionCode,
    action: 'resolved',
    fieldName: 'status',
    previousValue: exception.status,
    newValue: `resolved (${resolutionCategoryName})`,
    explanation: resolutionNote,
  });
}

export interface RetryResult {
  succeeded: boolean;
  responseCode: string;
  responseMessage: string;
}

/**
 * Simulated payment retry.
 *
 * This never contacts a payment network. It writes a `PaymentAttempt`, moves
 * the demo payment record, and records the attempt in the audit trail.
 */
export async function simulateRetry(
  ctx: OperationContext,
  exception: ExceptionRow,
  payment: PaymentRow | null
): Promise<RetryResult> {
  authorize(ctx, 'exception.retry');

  if (!payment) {
    throw new Error(
      'This exception has no payment record, so there is nothing to retry.'
    );
  }

  const now = new Date();
  const attemptNumber = (payment.attemptCount ?? 1) + 1;
  const succeeded = retryOutcome(exception, attemptNumber);

  const result: RetryResult = succeeded
    ? {
        succeeded: true,
        responseCode: 'SIM-00',
        responseMessage: 'Simulated retry accepted by the demo processor.',
      }
    : {
        succeeded: false,
        responseCode: 'SIM-51',
        responseMessage:
          'Simulated retry declined — the underlying exception is still open.',
      };

  await db().PaymentAttempt.create(
    withRelationships(
      {
        attemptNumber,
        attemptedAt: now,
        outcome: succeeded ? ('success' as const) : ('failed' as const),
        responseCode: result.responseCode,
        responseMessage: result.responseMessage,
        channel: 'simulation',
        isSimulatedRetry: true,
      },
      [],
      { payment: { id: payment.id } }
    )
  );

  await db().Payment.update(
    { id: payment.id },
    {
      attemptCount: attemptNumber,
      status: succeeded ? 'settled' : 'failed',
      settledAt: succeeded ? now : undefined,
    }
  );

  await db().PaymentException.update(
    { id: exception.id },
    {
      retryCount: (exception.retryCount ?? 0) + 1,
      updatedAt: now,
      status: succeeded ? 'ready-to-retry' : exception.status,
    }
  );

  await tryRecordAudit(ctx.actor, {
    entityType: 'Payment',
    entityId: payment.id,
    entityLabel: payment.paymentReference,
    action: 'retry-simulated',
    fieldName: 'status',
    previousValue: payment.status,
    newValue: succeeded ? 'settled' : 'failed',
    explanation: `${result.responseCode}: ${result.responseMessage}`,
  });

  // Also recorded against the exception so the case audit tab tells the whole story.
  await tryRecordAudit(ctx.actor, {
    entityType: 'PaymentException',
    entityId: exception.id,
    entityLabel: exception.exceptionCode,
    action: 'retry-simulated',
    fieldName: 'retryCount',
    previousValue: String(exception.retryCount ?? 0),
    newValue: String((exception.retryCount ?? 0) + 1),
    explanation: `${payment.paymentReference} — ${result.responseCode}: ${result.responseMessage}`,
  });

  return result;
}

/** Deterministic per exception + attempt so a demo replays identically. */
function retryOutcome(exception: ExceptionRow, attemptNumber: number): boolean {
  const blocking: string[] = [
    'invalid-bank-details',
    'compliance-review',
    'suspected-fraud',
  ];
  if (blocking.includes(exception.exceptionType)) return false;

  let hash = attemptNumber * 7;
  for (const ch of exception.exceptionCode) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return hash % 100 < 70;
}
