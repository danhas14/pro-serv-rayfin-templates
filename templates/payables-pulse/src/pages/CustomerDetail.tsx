import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { ExceptionTable } from '@/components/ExceptionTable';
import { KpiCard } from '@/components/KpiCard';
import { RiskBadge } from '@/components/StatusIndicators';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buildDailySeries } from '@/domain/analytics';
import { EXCEPTION_TYPE_SHORT_LABELS, type ExceptionType } from '@/domain/enums';
import { useData } from '@/hooks/DataContext';
import { useSession } from '@/hooks/SessionContext';
import {
  formatCompactCurrency,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import type { ExceptionNoteRow } from '@/services/columns';
import {
  addCustomerNote,
  listCustomerNotes,
} from '@/services/partyService';

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const {
    customerById,
    vendorById,
    userById,
    exceptions,
    payments,
    vendors,
    loading,
    error,
  } = useData();
  const { operationContext, can } = useSession();

  const [notes, setNotes] = useState<ExceptionNoteRow[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const customer = id ? customerById.get(id) : undefined;

  const loadNotes = useCallback(async () => {
    if (!id) return;
    setNotesLoading(true);
    try {
      setNotes(await listCustomerNotes(id));
    } finally {
      setNotesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const customerPayments = useMemo(
    () => payments.filter((p) => p.customer_id === id),
    [payments, id]
  );
  const customerExceptions = useMemo(
    () => exceptions.filter((e) => e.customer_id === id),
    [exceptions, id]
  );
  const series = useMemo(
    () => buildDailySeries(customerPayments, customerExceptions, 30),
    [customerPayments, customerExceptions]
  );

  const topVendors = useMemo(() => {
    const totals = new Map<string, { value: number; count: number }>();
    for (const p of customerPayments) {
      const entry = totals.get(p.vendor_id) ?? { value: 0, count: 0 };
      entry.value += p.amountUsd;
      entry.count += 1;
      totals.set(p.vendor_id, entry);
    }
    return [...totals.entries()]
      .map(([vendorId, stats]) => ({
        vendor: vendors.find((v) => v.id === vendorId),
        ...stats,
      }))
      .filter((row) => row.vendor)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [customerPayments, vendors]);

  const topTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of customerExceptions) {
      counts.set(e.exceptionType, (counts.get(e.exceptionType) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([type, count]) => ({ type: type as ExceptionType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [customerExceptions]);

  if (loading && !customer) return <LoadingState label="Loading customer…" />;
  if (error) return <ErrorState message={error} />;
  if (!customer) {
    return (
      <div className="space-y-4">
        <Back />
        <EmptyState
          title="Customer not found"
          description="This customer is not part of the current dataset."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Back />

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-card p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {customer.name}
            </h1>
            <RiskBadge level={customer.riskLevel} />
          </div>
          <p className="text-sm text-muted-foreground">
            {customer.customerCode} · {customer.industry} · {customer.country} ·{' '}
            {customer.tier} · base currency {customer.baseCurrency}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">
            {customer.healthScore}
            <span className="text-base text-muted-foreground">/100</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Payment-health score
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Payment volume (90 days)"
          value={formatCompactCurrency(customer.paymentVolume90d)}
          hint={`${formatNumber(customer.paymentCount90d)} payments`}
          tooltip="USD-equivalent value of all payments initiated for this customer in the last 90 days."
        />
        <KpiCard
          label="Payment success rate"
          value={formatPercent(customer.paymentSuccessRate)}
          tooltip="Share of payments that settled or are still settling, versus payments that failed or were returned."
          tone={customer.paymentSuccessRate >= 95 ? 'positive' : 'warning'}
        />
        <KpiCard
          label="Straight-through rate"
          value={formatPercent(customer.stpRate)}
          tooltip="Share of this customer's payments that completed with no operator intervention."
          tone={customer.stpRate >= 85 ? 'positive' : 'warning'}
        />
        <KpiCard
          label="Rejected-payment rate"
          value={formatPercent(customer.rejectedRate)}
          tooltip="Share of payments that failed or were returned by the receiving institution."
          tone={customer.rejectedRate > 5 ? 'critical' : 'default'}
        />
        <KpiCard
          label="Average approval time"
          value={formatDuration(customer.avgApprovalHours)}
          tooltip="Mean time from invoice receipt to final approval across this customer's invoices."
          tone={customer.avgApprovalHours > 48 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Average resolution time"
          value={formatDuration(customer.avgResolutionHours)}
          tooltip="Mean time to resolve exceptions raised on this customer's payables."
        />
        <KpiCard
          label="Exception rate"
          value={formatPercent(customer.exceptionRate)}
          tooltip="Exceptions raised as a share of payments processed for this customer."
          tone={customer.exceptionRate > 8 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Virtual-card adoption"
          value={formatPercent(customer.virtualCardAdoption)}
          hint={`${formatCompactCurrency(customer.estimatedRebate)} estimated rebate`}
          tooltip="Share of payments made by virtual card. Higher adoption increases rebate value."
          tone="positive"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Thirty-day trend</CardTitle>
            <CardDescription>
              Daily payment value and exceptions raised.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  width={54}
                  tickFormatter={(v: number) => formatCompactCurrency(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  width={28}
                  allowDecimals={false}
                />
                <RechartsTooltip />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="value"
                  name="Payment value"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="created"
                  name="Exceptions raised"
                  stroke="var(--chart-5)"
                  fill="var(--chart-5)"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top vendors</CardTitle>
            <CardDescription>By payment value in the window.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topVendors.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No payments in the window.
              </p>
            ) : (
              topVendors.map((row) => (
                <div
                  key={row.vendor!.id}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span className="truncate">{row.vendor!.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatCompactCurrency(row.value)} · {row.count}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Most common exception categories
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topTypes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No exceptions recorded for this customer.
              </p>
            ) : (
              topTypes.map((row) => (
                <div
                  key={row.type}
                  className="flex items-baseline justify-between text-sm"
                >
                  <span>{EXCEPTION_TYPE_SHORT_LABELS[row.type]}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.count}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Customer follow-up notes</CardTitle>
            <CardDescription>
              Visible to the operations team. Customer Success can add notes
              without touching payment records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {can('customer.addNote') && operationContext ? (
              <div className="space-y-2">
                <Label htmlFor="customer-note">Add a follow-up note</Label>
                <Textarea
                  id="customer-note"
                  rows={3}
                  placeholder="What did you agree with the customer?"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={busy || draft.trim().length < 3}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await addCustomerNote(
                        operationContext,
                        customer,
                        draft.trim()
                      );
                      setDraft('');
                      await loadNotes();
                      toast.success('Follow-up note added.');
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'The note could not be added.'
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Add note
                </Button>
              </div>
            ) : null}

            {notesLoading ? (
              <LoadingState label="Loading notes…" className="py-6" />
            ) : notes.length === 0 ? (
              <EmptyState
                title="No follow-up notes"
                description="Notes added here stay with the customer record."
              />
            ) : (
              <ul className="space-y-2">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-md border bg-muted/30 p-3">
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {note.authorName} · {note.authorRole}
                      </span>
                      <span>{formatDateTime(note.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-sm">{note.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Exceptions</CardTitle>
          <CardDescription>
            Every exception raised against this customer&apos;s payables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExceptionTable
            exceptions={customerExceptions}
            customerById={customerById}
            vendorById={vendorById}
            userById={userById}
            emptyTitle="No exceptions"
            emptyDescription="This customer has a clean exception record in the current dataset."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Back() {
  return (
    <Link
      to="/customers"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Customer Payment Health
    </Link>
  );
}
