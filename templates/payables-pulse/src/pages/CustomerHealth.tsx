import { ArrowRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { MetricInfo } from '@/components/KpiCard';
import { RiskBadge } from '@/components/StatusIndicators';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { customerInsight } from '@/domain/analytics';
import { EXCEPTION_TYPE_SHORT_LABELS, type ExceptionType } from '@/domain/enums';
import { useData } from '@/hooks/DataContext';
import {
  formatCompactCurrency,
  formatDuration,
  formatNumber,
  formatPercent,
} from '@/lib/format';

export function CustomerHealth() {
  const { customers, exceptions, loading, error, refresh } = useData();
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers
      .map((c) => customerInsight(c, exceptions))
      .filter(
        (row) =>
          !term ||
          row.customer.name.toLowerCase().includes(term) ||
          row.customer.customerCode.toLowerCase().includes(term) ||
          row.customer.industry.toLowerCase().includes(term)
      )
      .sort((a, b) => a.customer.healthScore - b.customer.healthScore);
  }, [customers, exceptions, search]);

  if (loading && customers.length === 0) {
    return <LoadingState label="Loading customer payment health…" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={() => void refresh()} />;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Customer Payment Health
          </h1>
          <p className="text-sm text-muted-foreground">
            Ranked by payment-health score, weakest first.
          </p>
        </div>
        <div className="relative min-w-[260px]">
          <Search
            className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search customers"
            placeholder="Search customer, code or industry"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="No customers match that search"
          description="Clear the search box to see the full portfolio."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    Health
                    <MetricInfo text="Composite of payment success rate, straight-through rate, exception rate and average approval time. 100 is best." />
                  </span>
                </TableHead>
                <TableHead className="text-right">Volume (90d)</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Success</TableHead>
                <TableHead className="text-right">STP</TableHead>
                <TableHead className="text-right">Approval</TableHead>
                <TableHead className="text-right">Exceptions</TableHead>
                <TableHead className="text-right">Card adoption</TableHead>
                <TableHead className="text-right">Rebate</TableHead>
                <TableHead className="w-[44px]">
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ customer, openExceptions, breachedExceptions }) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link
                      to={`/customers/${customer.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {customer.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {customer.customerCode} · {customer.industry} ·{' '}
                      {customer.country}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <RiskBadge level={customer.riskLevel} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {customer.healthScore}/100
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompactCurrency(customer.paymentVolume90d)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(customer.paymentCount90d)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(customer.paymentSuccessRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(customer.stpRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDuration(customer.avgApprovalHours)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(openExceptions)} open
                    {breachedExceptions > 0 ? (
                      <div className="text-xs text-red-700">
                        {breachedExceptions} breached
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(customer.virtualCardAdoption)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompactCurrency(customer.estimatedRebate)}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/customers/${customer.id}`}
                      aria-label={`Open ${customer.name}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.slice(0, 3).map(({ customer, topExceptionTypes }) => (
          <div key={customer.id} className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium">{customer.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Most common exception categories
            </div>
            <ul className="mt-2 space-y-1.5">
              {topExceptionTypes.length === 0 ? (
                <li className="text-xs text-muted-foreground">
                  No exceptions recorded.
                </li>
              ) : (
                topExceptionTypes.map((slice) => (
                  <li key={slice.key} className="text-xs">
                    <div className="flex justify-between">
                      <span>
                        {EXCEPTION_TYPE_SHORT_LABELS[slice.key as ExceptionType]}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {slice.count}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(
                        100,
                        (slice.count /
                          Math.max(1, topExceptionTypes[0].count)) *
                          100
                      )}
                      className="mt-1 h-1.5"
                    />
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
