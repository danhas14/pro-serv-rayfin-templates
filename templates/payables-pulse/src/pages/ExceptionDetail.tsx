import {
  ArrowLeft,
  Building2,
  FileText,
  Lightbulb,
  RotateCcw,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useConfirm } from '@/components/ConfirmDialog';
import {
  PriorityBadge,
  SlaBadge,
  StatusBadge,
} from '@/components/StatusIndicators';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  APPROVAL_ACTION_LABELS,
  ATTEMPT_OUTCOME_LABELS,
  EXCEPTION_STATUS_LABELS,
  EXCEPTION_TYPE_LABELS,
  INVOICE_STATUS_LABELS,
  NOTE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_TRANSITIONS,
  type ExceptionPriority,
  type ExceptionStatus,
} from '@/domain/enums';
import { useData } from '@/hooks/DataContext';
import { useSession } from '@/hooks/SessionContext';
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  hoursBetween,
  relativeTime,
} from '@/lib/format';
import type { AuditRow } from '@/services/columns';
import { listAuditForEntity } from '@/services/auditService';
import {
  addExceptionNote,
  assignException,
  changePriority,
  changeStatus,
  escalateException,
  getException,
  loadExceptionDetail,
  resolveException,
  simulateRetry,
  type ExceptionDetailBundle,
} from '@/services/exceptionService';

export function ExceptionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    customerById,
    vendorById,
    userById,
    users,
    resolutionCategories,
    exceptionCategories,
    refresh,
  } = useData();
  const { operationContext, can } = useSession();
  const { confirm, dialog } = useConfirm();

  const [bundle, setBundle] = useState<ExceptionDetailBundle | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [noteDraft, setNoteDraft] = useState('');
  const [assigneeDraft, setAssigneeDraft] = useState('');
  const [resolutionDraft, setResolutionDraft] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [escalationReason, setEscalationReason] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const exception = await getException(id);
      if (!exception) {
        setError('That exception no longer exists.');
        setBundle(null);
        return;
      }
      const [rest, auditRows] = await Promise.all([
        loadExceptionDetail(exception),
        listAuditForEntity(exception.id),
      ]);
      setBundle({ exception, ...rest });
      setAudit(auditRows);
      setAssigneeDraft(exception.assignedTo_id ?? '');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load this exception.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>, successMessage: string) {
    if (!operationContext) return;
    setBusy(true);
    try {
      await action();
      toast.success(successMessage);
      await load();
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'The action could not be completed.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading exception…" />;
  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );
  }
  if (!bundle || !operationContext) return null;

  const {
    exception,
    invoice,
    payment,
    attempts,
    approvals,
    notes,
    history,
    assignments,
    related,
  } = bundle;

  const customer = customerById.get(exception.customer_id);
  const vendor = exception.vendor_id
    ? vendorById.get(exception.vendor_id)
    : undefined;
  const assignee = exception.assignedTo_id
    ? userById.get(exception.assignedTo_id)
    : undefined;
  const category = exceptionCategories.find(
    (c) => c.code === exception.exceptionType
  );
  const assignableUsers = users.filter(
    (u) =>
      u.isActive &&
      (u.primaryRole === 'payment-operations-specialist' ||
        u.primaryRole === 'operations-manager')
  );

  const isClosed = exception.status === 'closed';
  const openHours = hoursBetween(exception.createdAt);

  return (
    <div className="space-y-4">
      {dialog}
      <BackLink />

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-card p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {exception.exceptionCode}
            </h1>
            <PriorityBadge priority={exception.priority} />
            <StatusBadge status={exception.status} />
            <SlaBadge risk={exception.slaRisk} />
            {exception.escalated ? (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                Escalated
              </Badge>
            ) : null}
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {exception.reason}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              Raised {formatDateTime(exception.createdAt)} ·{' '}
              {formatDuration(openHours)} open
            </span>
            <span>
              Target {exception.slaTargetHours}h · due{' '}
              {formatDateTime(exception.slaDueAt)} (
              {relativeTime(exception.slaDueAt)})
            </span>
            <span>
              Assigned to {assignee?.displayName ?? 'nobody yet'}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">
            {formatCurrency(exception.amount, exception.currency)}
          </div>
          {exception.currency !== 'USD' ? (
            <div className="text-xs text-muted-foreground">
              {formatCurrency(exception.amountUsd)} equivalent
            </div>
          ) : null}
          <div className="mt-1 text-xs text-muted-foreground">
            {PAYMENT_METHOD_LABELS[exception.paymentMethod]} ·{' '}
            {exception.country}
            {exception.isCrossBorder &&
            exception.paymentMethod !== 'cross-border'
              ? ' · cross-border corridor'
              : ''}
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Parties and documents</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Customer
                </div>
                <Link
                  to={`/customers/${customer?.id ?? ''}`}
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  {customer?.name ?? 'Unknown customer'}
                </Link>
                <dl className="text-xs text-muted-foreground">
                  <Row label="Code" value={customer?.customerCode} />
                  <Row label="Industry" value={customer?.industry} />
                  <Row label="Country" value={customer?.country} />
                  <Row label="Tier" value={customer?.tier} />
                </dl>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Store className="h-3.5 w-3.5" aria-hidden="true" />
                  Vendor
                </div>
                <div className="text-sm font-medium">
                  {vendor?.name ?? 'No vendor on this exception'}
                </div>
                <dl className="text-xs text-muted-foreground">
                  <Row label="Code" value={vendor?.vendorCode} />
                  <Row label="Category" value={vendor?.category} />
                  <Row label="Country" value={vendor?.country} />
                  <Row
                    label="Bank details"
                    value={vendor?.bankDetailsStatus}
                  />
                  <Row
                    label="Remittance"
                    value={vendor?.remittanceEmail ?? 'Not on file'}
                  />
                </dl>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  Invoice
                </div>
                <div className="text-sm font-medium">
                  {exception.invoiceNumber}
                </div>
                <dl className="text-xs text-muted-foreground">
                  <Row
                    label="Status"
                    value={
                      invoice ? INVOICE_STATUS_LABELS[invoice.status] : undefined
                    }
                  />
                  <Row
                    label="Invoice date"
                    value={invoice ? formatDateTime(invoice.invoiceDate) : undefined}
                  />
                  <Row
                    label="Due date"
                    value={invoice ? formatDateTime(invoice.dueDate) : undefined}
                  />
                  <Row label="PO" value={invoice?.poNumber ?? 'None'} />
                  <Row
                    label="Approval time"
                    value={
                      invoice ? formatDuration(invoice.approvalHours) : undefined
                    }
                  />
                </dl>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Payment
                </div>
                <div className="text-sm font-medium">
                  {payment?.paymentReference ?? 'No payment raised yet'}
                </div>
                <dl className="text-xs text-muted-foreground">
                  <Row
                    label="Status"
                    value={
                      payment ? PAYMENT_STATUS_LABELS[payment.status] : undefined
                    }
                  />
                  <Row
                    label="Method"
                    value={
                      payment
                        ? PAYMENT_METHOD_LABELS[payment.paymentMethod]
                        : undefined
                    }
                  />
                  <Row
                    label="Initiated"
                    value={payment ? formatDateTime(payment.initiatedAt) : undefined}
                  />
                  <Row
                    label="Attempts"
                    value={payment ? String(payment.attemptCount) : undefined}
                  />
                  <Row
                    label="Processing"
                    value={
                      payment ? formatDuration(payment.processingHours) : undefined
                    }
                  />
                </dl>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Case history</CardTitle>
              <CardDescription>
                Everything recorded against this exception.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="notes">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
                  <TabsTrigger value="status">
                    Status ({history.length})
                  </TabsTrigger>
                  <TabsTrigger value="approvals">
                    Approvals ({approvals.length})
                  </TabsTrigger>
                  <TabsTrigger value="attempts">
                    Attempts ({attempts.length})
                  </TabsTrigger>
                  <TabsTrigger value="assignments">
                    Assignments ({assignments.length})
                  </TabsTrigger>
                  <TabsTrigger value="audit">Audit ({audit.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="notes" className="mt-4 space-y-3">
                  {can('exception.addNote') ? (
                    <div className="space-y-2">
                      <Label htmlFor="note">Add an operational note</Label>
                      <Textarea
                        id="note"
                        rows={3}
                        placeholder="What did you check, who did you contact, what happens next?"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                      />
                      <Button
                        size="sm"
                        disabled={busy || noteDraft.trim().length < 3}
                        onClick={() =>
                          void run(async () => {
                            await addExceptionNote(
                              operationContext,
                              exception,
                              noteDraft.trim()
                            );
                            setNoteDraft('');
                          }, 'Note added.')
                        }
                      >
                        Add note
                      </Button>
                    </div>
                  ) : null}
                  {notes.length === 0 ? (
                    <EmptyState
                      title="No notes yet"
                      description="Notes record what was checked and who was contacted."
                    />
                  ) : (
                    <ul className="space-y-3">
                      {notes.map((note) => (
                        <li
                          key={note.id}
                          className="rounded-md border bg-muted/30 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {note.authorName}{' '}
                              <span className="font-normal text-muted-foreground">
                                · {note.authorRole}
                              </span>
                            </span>
                            <span>
                              {NOTE_TYPE_LABELS[note.noteType]} ·{' '}
                              {formatDateTime(note.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm">{note.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="status" className="mt-4">
                  {history.length === 0 ? (
                    <EmptyState
                      title="No status changes yet"
                      description="This exception has not moved out of its opening state."
                    />
                  ) : (
                    <ol className="space-y-2">
                      {history.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <StatusBadge status={row.fromStatus} />
                          <span aria-hidden="true">→</span>
                          <StatusBadge status={row.toStatus} />
                          <span className="ml-auto text-xs text-muted-foreground">
                            {row.changedByName} · {formatDateTime(row.changedAt)}{' '}
                            · {formatDuration(row.durationHours)} in previous
                            state
                          </span>
                          {row.note ? (
                            <p className="w-full text-xs text-muted-foreground">
                              {row.note}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </TabsContent>

                <TabsContent value="approvals" className="mt-4">
                  {approvals.length === 0 ? (
                    <EmptyState
                      title="No approval steps recorded"
                      description="This invoice did not route through a multi-step approval workflow."
                    />
                  ) : (
                    <ol className="space-y-2">
                      {approvals.map((step) => (
                        <li
                          key={step.id}
                          className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="font-medium">
                            {step.stepNumber}. {step.stepName}
                          </span>
                          <Badge variant="secondary">
                            {APPROVAL_ACTION_LABELS[step.action]}
                          </Badge>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {step.approverName} · {step.approverRole} ·{' '}
                            {formatDateTime(step.occurredAt)} ·{' '}
                            {formatDuration(step.elapsedHours)}
                          </span>
                          {step.note ? (
                            <p className="w-full text-xs text-muted-foreground">
                              {step.note}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </TabsContent>

                <TabsContent value="attempts" className="mt-4">
                  {attempts.length === 0 ? (
                    <EmptyState
                      title="No payment attempts"
                      description="No disbursement has been attempted for this exception."
                    />
                  ) : (
                    <ol className="space-y-2">
                      {attempts.map((attempt) => (
                        <li
                          key={attempt.id}
                          className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="font-medium">
                            Attempt {attempt.attemptNumber}
                          </span>
                          <Badge
                            variant={
                              attempt.outcome === 'success'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {ATTEMPT_OUTCOME_LABELS[attempt.outcome]}
                          </Badge>
                          {attempt.isSimulatedRetry ? (
                            <Badge variant="outline">Simulated retry</Badge>
                          ) : null}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {attempt.responseCode} ·{' '}
                            {formatDateTime(attempt.attemptedAt)}
                          </span>
                          <p className="w-full text-xs text-muted-foreground">
                            {attempt.responseMessage}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </TabsContent>

                <TabsContent value="assignments" className="mt-4">
                  {assignments.length === 0 ? (
                    <EmptyState
                      title="Never assigned"
                      description="This exception has not been picked up by a specialist."
                    />
                  ) : (
                    <ol className="space-y-2">
                      {assignments.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="font-medium">
                            {userById.get(row.assignedTo_id)?.displayName ??
                              'Unknown specialist'}
                          </span>
                          {row.isCurrent ? (
                            <Badge variant="secondary">Current</Badge>
                          ) : null}
                          <span className="ml-auto text-xs text-muted-foreground">
                            by {row.assignedByName} ·{' '}
                            {formatDateTime(row.assignedAt)}
                          </span>
                          {row.reason ? (
                            <p className="w-full text-xs text-muted-foreground">
                              {row.reason}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </TabsContent>

                <TabsContent value="audit" className="mt-4">
                  {audit.length === 0 ? (
                    <EmptyState
                      title="No audit entries yet"
                      description="Audit records are written the moment anyone changes this exception."
                    />
                  ) : (
                    <ol className="space-y-2">
                      {audit.map((row) => (
                        <li
                          key={row.id}
                          className="rounded-md border px-3 py-2 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{row.action}</Badge>
                            <span className="font-medium">
                              {row.actingUserName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {row.actingUserRole}
                            </span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {formatDateTime(row.occurredAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.fieldName ? `${row.fieldName}: ` : ''}
                            {row.previousValue ? `${row.previousValue} → ` : ''}
                            {row.newValue ?? ''}
                            {row.explanation ? ` — ${row.explanation}` : ''}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Related exceptions</CardTitle>
              <CardDescription>
                Other open or recent exceptions for the same vendor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {related.length === 0 ? (
                <EmptyState
                  title="No related exceptions"
                  description="This vendor has no other exceptions in the current dataset."
                />
              ) : (
                <ul className="divide-y">
                  {related.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-2 py-2 text-sm"
                    >
                      <Link
                        to={`/exceptions/${row.id}`}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {row.exceptionCode}
                      </Link>
                      <span className="text-muted-foreground">
                        {EXCEPTION_TYPE_LABELS[row.exceptionType]}
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        <StatusBadge status={row.status} />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(row.amount, row.currency, {
                            decimals: false,
                          })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-1.5">
                <Lightbulb
                  className="h-4 w-4 text-amber-600"
                  aria-hidden="true"
                />
                <CardTitle className="text-base">
                  Suggested resolution steps
                </CardTitle>
              </div>
              <CardDescription>
                {EXCEPTION_TYPE_LABELS[exception.exceptionType]}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{exception.recommendedAction}</p>
              {category ? (
                <p className="text-xs text-muted-foreground">
                  {category.description} Target resolution{' '}
                  {category.defaultSlaHours}h.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
              <CardDescription>
                Your role determines what is available here, and the server
                re-checks every change.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!can('exception.changeStatus') &&
              !can('exception.assign') &&
              !can('exception.addNote') ? (
                <p className="text-sm text-muted-foreground">
                  You have read-only access to this exception.
                </p>
              ) : null}

              {can('exception.assign') ? (
                <div className="space-y-1.5">
                  <Label htmlFor="assignee">Assign to</Label>
                  <div className="flex gap-2">
                    <Select
                      value={assigneeDraft}
                      onValueChange={setAssigneeDraft}
                    >
                      <SelectTrigger id="assignee" className="flex-1">
                        <SelectValue placeholder="Choose a specialist" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      disabled={
                        busy ||
                        !assigneeDraft ||
                        assigneeDraft === exception.assignedTo_id
                      }
                      onClick={() => {
                        const target = assignableUsers.find(
                          (u) => u.id === assigneeDraft
                        );
                        if (!target) return;
                        void run(
                          () =>
                            assignException(operationContext, exception, target),
                          `Assigned to ${target.displayName}.`
                        );
                      }}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              ) : null}

              {can('exception.changePriority') ? (
                <div className="space-y-1.5">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={exception.priority}
                    onValueChange={(v) =>
                      void run(
                        () =>
                          changePriority(
                            operationContext,
                            exception,
                            v as ExceptionPriority
                          ),
                        `Priority set to ${PRIORITY_LABELS[v as ExceptionPriority]}.`
                      )
                    }
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {can('exception.changeStatus') ? (
                <div className="space-y-1.5">
                  <Label>Move to</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_TRANSITIONS[exception.status].map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (next === 'closed') {
                            confirm({
                              title: 'Close this exception?',
                              description:
                                'Closing removes the exception from the working queue. The audit trail and status history are kept.',
                              confirmLabel: 'Close exception',
                              action: () =>
                                run(
                                  () =>
                                    changeStatus(
                                      operationContext,
                                      exception,
                                      'closed'
                                    ),
                                  'Exception closed.'
                                ),
                            });
                            return;
                          }
                          void run(
                            () =>
                              changeStatus(
                                operationContext,
                                exception,
                                next as ExceptionStatus
                              ),
                            `Moved to ${EXCEPTION_STATUS_LABELS[next]}.`
                          );
                        }}
                      >
                        {EXCEPTION_STATUS_LABELS[next]}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {can('exception.retry') ? (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label>Retry payment</Label>
                    <p className="text-xs text-muted-foreground">
                      Simulation only. This updates the demo database and audit
                      history and never contacts a payment network.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !payment}
                      onClick={() =>
                        confirm({
                          title: 'Retry this payment?',
                          description: `A simulated retry will be recorded against ${payment?.paymentReference ?? 'this payment'}. No external payment system is contacted.`,
                          confirmLabel: 'Run simulated retry',
                          action: async () => {
                            setBusy(true);
                            try {
                              const result = await simulateRetry(
                                operationContext,
                                exception,
                                payment
                              );
                              if (result.succeeded) {
                                toast.success(
                                  `Simulated retry accepted (${result.responseCode}). Record a resolution to close the case.`
                                );
                              } else {
                                toast.warning(
                                  `Simulated retry declined (${result.responseCode}).`
                                );
                              }
                              await load();
                              await refresh();
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : 'The retry could not be simulated.'
                              );
                            } finally {
                              setBusy(false);
                            }
                          },
                        })
                      }
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Retry payment (simulated)
                    </Button>
                    {!payment ? (
                      <p className="text-xs text-muted-foreground">
                        There is no payment record attached to this exception.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {can('exception.resolve') && !isClosed ? (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label htmlFor="resolution">Record a resolution</Label>
                    <Select
                      value={resolutionDraft}
                      onValueChange={setResolutionDraft}
                    >
                      <SelectTrigger id="resolution">
                        <SelectValue placeholder="Resolution category" />
                      </SelectTrigger>
                      <SelectContent>
                        {resolutionCategories
                          .filter((c) => c.isActive)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      rows={2}
                      placeholder="What resolved it?"
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={busy || !resolutionDraft}
                      onClick={() => {
                        const category = resolutionCategories.find(
                          (c) => c.id === resolutionDraft
                        );
                        if (!category) return;
                        if (category.requiresNote && resolutionNote.trim().length < 3) {
                          toast.error(
                            `"${category.name}" requires an explanatory note.`
                          );
                          return;
                        }
                        void run(async () => {
                          await resolveException(
                            operationContext,
                            exception,
                            category.id,
                            category.name,
                            resolutionNote.trim()
                          );
                          setResolutionDraft('');
                          setResolutionNote('');
                        }, 'Resolution recorded.');
                      }}
                    >
                      Record resolution
                    </Button>
                  </div>
                </>
              ) : null}

              {can('exception.escalate') && !exception.escalated ? (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label htmlFor="escalate">Escalate to a manager</Label>
                    <Textarea
                      id="escalate"
                      rows={2}
                      placeholder="Why does this need a manager?"
                      value={escalationReason}
                      onChange={(e) => setEscalationReason(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || escalationReason.trim().length < 3}
                      onClick={() =>
                        void run(async () => {
                          await escalateException(
                            operationContext,
                            exception,
                            escalationReason.trim()
                          );
                          setEscalationReason('');
                        }, 'Escalated to a manager.')
                      }
                    >
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      Escalate
                    </Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {exception.resolutionNote ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recorded resolution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>{exception.resolutionNote}</p>
                <p className="text-xs text-muted-foreground">
                  Resolved {formatDateTime(exception.resolvedAt)}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Button variant="ghost" onClick={() => navigate('/exceptions')}>
            Back to the queue
          </Button>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/exceptions"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Exception Workbench
    </Link>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 py-0.5">
      <dt className="min-w-[92px] shrink-0">{label}</dt>
      <dd className="text-foreground">{value ?? '—'}</dd>
    </div>
  );
}
