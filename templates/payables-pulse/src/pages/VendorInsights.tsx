import { Flag, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { KpiCard } from '@/components/KpiCard';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { vendorInsight } from '@/domain/analytics';
import {
  BANK_DETAILS_LABELS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '@/domain/enums';
import { useData } from '@/hooks/DataContext';
import { useSession } from '@/hooks/SessionContext';
import {
  formatCompactCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import type { ExceptionNoteRow, VendorRow } from '@/services/columns';
import {
  addVendorReviewNote,
  listVendorNotes,
  setVendorFlag,
} from '@/services/partyService';

type VendorFilter = 'all' | 'failing' | 'duplicates' | 'details' | 'card' | 'flagged';

export function VendorInsights() {
  const { vendors, exceptions, payments, loading, error, refresh } = useData();
  const { operationContext, can } = useSession();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<VendorFilter>('failing');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const insights = useMemo(
    () => vendors.map((v) => vendorInsight(v, exceptions, payments)),
    [vendors, exceptions, payments]
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return insights
      .filter((row) => {
        const v = row.vendor;
        if (term && !`${v.name} ${v.vendorCode} ${v.category}`.toLowerCase().includes(term)) {
          return false;
        }
        switch (filter) {
          case 'failing':
            return v.failedPaymentCount > 0 || v.delayedPaymentCount > 0;
          case 'duplicates':
            return v.duplicateInvoiceCount > 0;
          case 'details':
            return v.bankDetailsStatus !== 'verified';
          case 'card':
            return v.virtualCardEligible && !v.virtualCardEnrolled;
          case 'flagged':
            return v.flaggedForReview;
          default:
            return true;
        }
      })
      .sort((a, b) => {
        if (filter === 'card') return b.rebateOpportunity - a.rebateOpportunity;
        if (filter === 'duplicates') {
          return b.vendor.duplicateInvoiceCount - a.vendor.duplicateInvoiceCount;
        }
        return (
          b.vendor.failedPaymentCount + b.vendor.delayedPaymentCount -
          (a.vendor.failedPaymentCount + a.vendor.delayedPaymentCount)
        );
      });
  }, [insights, search, filter]);

  const selected = useMemo(
    () => vendors.find((v) => v.id === selectedId) ?? null,
    [vendors, selectedId]
  );

  const methodMix = useMemo(() => {
    const counts = new Map<PaymentMethod, number>();
    const source = selected
      ? payments.filter((p) => p.vendor_id === selected.id)
      : payments;
    for (const p of source) {
      counts.set(p.paymentMethod, (counts.get(p.paymentMethod) ?? 0) + 1);
    }
    const total = source.length || 1;
    return [...counts.entries()]
      .map(([method, count]) => ({
        method,
        count,
        share: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }, [payments, selected]);

  const summary = useMemo(() => {
    const failing = insights.filter((r) => r.vendor.failedPaymentCount > 0).length;
    const duplicates = insights.reduce(
      (s, r) => s + r.vendor.duplicateInvoiceCount,
      0
    );
    const badDetails = insights.filter(
      (r) => r.vendor.bankDetailsStatus !== 'verified'
    ).length;
    const cardGap = insights.filter(
      (r) => r.vendor.virtualCardEligible && !r.vendor.virtualCardEnrolled
    );
    return {
      failing,
      duplicates,
      badDetails,
      cardGapCount: cardGap.length,
      cardGapValue: cardGap.reduce((s, r) => s + r.rebateOpportunity, 0),
      avgDaysToPay:
        insights.length
          ? insights.reduce((s, r) => s + r.vendor.avgDaysToPay, 0) /
            insights.length
          : 0,
      recurrence:
        insights.length
          ? insights.reduce((s, r) => s + r.vendor.exceptionRecurrenceRate, 0) /
            insights.length
          : 0,
    };
  }, [insights]);

  if (loading && vendors.length === 0) {
    return <LoadingState label="Loading vendor insights…" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={() => void refresh()} />;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Vendor Insights</h1>
        <p className="text-sm text-muted-foreground">
          Where vendor data and enrolment gaps are costing throughput and rebate.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Vendors with failures"
          value={formatNumber(summary.failing)}
          tooltip="Vendors with at least one failed or returned payment in the last 90 days."
          tone={summary.failing > 0 ? 'warning' : 'positive'}
        />
        <KpiCard
          label="Duplicate invoice flags"
          value={formatNumber(summary.duplicates)}
          tooltip="Invoices matched against an existing invoice on vendor, amount and reference."
        />
        <KpiCard
          label="Incomplete payment details"
          value={formatNumber(summary.badDetails)}
          tooltip="Vendors whose bank details are incomplete, outdated or invalid, and therefore likely to fail."
          tone={summary.badDetails > 0 ? 'warning' : 'positive'}
        />
        <KpiCard
          label="Card enrolment gap"
          value={formatNumber(summary.cardGapCount)}
          hint={`${formatCompactCurrency(summary.cardGapValue)} rebate at stake`}
          tooltip="Card-eligible vendors that are not enrolled, and the estimated rebate that enrolment would unlock."
          tone="positive"
        />
        <KpiCard
          label="Average days to payment"
          value={summary.avgDaysToPay.toFixed(1)}
          tooltip="Mean elapsed days from payment initiation to successful settlement across all vendors."
        />
        <KpiCard
          label="Exception recurrence"
          value={formatPercent(summary.recurrence)}
          tooltip="Exceptions raised as a share of payments, averaged across vendors."
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="gap-3 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search
                  className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  aria-label="Search vendors"
                  placeholder="Search vendor, code or category"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select
                value={filter}
                onValueChange={(v) => setFilter(v as VendorFilter)}
              >
                <SelectTrigger className="w-[240px]" aria-label="Vendor view">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="failing">
                    Most failed or delayed payments
                  </SelectItem>
                  <SelectItem value="duplicates">
                    Duplicate invoice patterns
                  </SelectItem>
                  <SelectItem value="details">
                    Outdated or incomplete payment details
                  </SelectItem>
                  <SelectItem value="card">
                    Virtual-card enrolment gap
                  </SelectItem>
                  <SelectItem value="flagged">Flagged for follow-up</SelectItem>
                  <SelectItem value="all">All vendors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {rows.length === 0 ? (
              <EmptyState
                className="mx-6 mb-6"
                title="No vendors match this view"
                description="Switch the view or clear the search to see more vendors."
              />
            ) : (
              <div className="max-h-[560px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Delayed</TableHead>
                      <TableHead className="text-right">Duplicates</TableHead>
                      <TableHead>Bank details</TableHead>
                      <TableHead>Card</TableHead>
                      <TableHead className="text-right">Days to pay</TableHead>
                      <TableHead className="text-right">Recurrence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ vendor }) => (
                      <TableRow
                        key={vendor.id}
                        onClick={() => setSelectedId(vendor.id)}
                        aria-selected={selectedId === vendor.id}
                        className={
                          selectedId === vendor.id
                            ? 'cursor-pointer bg-accent/60'
                            : 'cursor-pointer'
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-medium">
                            {vendor.name}
                            {vendor.flaggedForReview ? (
                              <Flag
                                className="h-3.5 w-3.5 text-amber-600"
                                aria-label="Flagged for follow-up"
                              />
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {vendor.vendorCode} · {vendor.category} ·{' '}
                            {vendor.country}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {vendor.failedPaymentCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {vendor.delayedPaymentCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {vendor.duplicateInvoiceCount}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              vendor.bankDetailsStatus === 'verified'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {BANK_DETAILS_LABELS[vendor.bankDetailsStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {vendor.virtualCardEnrolled
                            ? 'Enrolled'
                            : vendor.virtualCardEligible
                              ? 'Eligible'
                              : 'Not eligible'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {vendor.avgDaysToPay.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPercent(vendor.exceptionRecurrenceRate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Payment-method mix
              </CardTitle>
              <CardDescription>
                {selected ? selected.name : 'All vendors'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {methodMix.map((row) => (
                <div key={row.method}>
                  <div className="flex justify-between text-xs">
                    <span>{PAYMENT_METHOD_LABELS[row.method]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatNumber(row.count)} · {row.share.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[var(--chart-1)]"
                      style={{ width: `${Math.max(row.share, 1)}%` }}
                    />
                  </div>
                </div>
              ))}
              {methodMix.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No payments recorded.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {selected ? (
            <VendorReviewPanel
              vendor={selected}
              canReview={can('vendor.addNote')}
              canFlag={can('vendor.flag')}
              operationContext={operationContext}
            />
          ) : (
            <EmptyState
              title="Select a vendor"
              description="Choose a vendor from the table to review its payment behaviour and add a review note."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function VendorReviewPanel({
  vendor,
  canReview,
  canFlag,
  operationContext,
}: {
  vendor: VendorRow;
  canReview: boolean;
  canFlag: boolean;
  operationContext: ReturnType<typeof useSession>['operationContext'];
}) {
  const { refresh } = useData();
  const [notes, setNotes] = useState<ExceptionNoteRow[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notesLoading, setNotesLoading] = useState(true);

  const load = useCallback(async () => {
    setNotesLoading(true);
    try {
      setNotes(await listVendorNotes(vendor.id));
    } finally {
      setNotesLoading(false);
    }
  }, [vendor.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{vendor.name}</CardTitle>
        <CardDescription>
          {vendor.remittanceEmail ?? 'No remittance address on file'} ·{' '}
          {vendor.currency} · last payment{' '}
          {vendor.lastPaymentAt ? formatDateTime(vendor.lastPaymentAt) : 'never'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {vendor.flaggedForReview ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="font-medium">Flagged for follow-up.</span>{' '}
            {vendor.reviewNote}
          </div>
        ) : null}

        {canReview && operationContext ? (
          <div className="space-y-2">
            <Label htmlFor="vendor-note">Vendor review note</Label>
            <Textarea
              id="vendor-note"
              rows={3}
              placeholder="What did the review find and what happens next?"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy || draft.trim().length < 3}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await addVendorReviewNote(
                      operationContext,
                      vendor,
                      draft.trim()
                    );
                    toast.success('Vendor review note added.');
                    setDraft('');
                    await load();
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : 'Could not add note.'
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Add review note
              </Button>
              {canFlag ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await setVendorFlag(
                        operationContext,
                        vendor,
                        !vendor.flaggedForReview,
                        draft.trim() || vendor.reviewNote
                      );
                      toast.success(
                        vendor.flaggedForReview
                          ? 'Follow-up flag cleared.'
                          : 'Vendor flagged for follow-up.'
                      );
                      await refresh();
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Could not update the flag.'
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                  {vendor.flaggedForReview ? 'Clear flag' : 'Flag for follow-up'}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your role has read-only access to vendor records.
          </p>
        )}

        {notesLoading ? (
          <LoadingState label="Loading notes…" className="py-4" />
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No review notes recorded for this vendor.
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-md border bg-muted/30 p-2.5">
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {note.authorName}
                  </span>
                  <span>{formatDateTime(note.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
