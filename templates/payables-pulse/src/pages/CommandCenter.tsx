import {
  AlertTriangle,
  Banknote,
  Clock,
  Gauge,
  Globe2,
  ListChecks,
  Sparkles,
  Timer,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ExceptionCallout } from '@/components/ExceptionCallout';
import { KpiCard, MetricInfo } from '@/components/KpiCard';
import { ErrorState, LoadingState } from '@/components/States';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  buildDailySeries,
  computeKpis,
  DEFAULT_FILTERS,
  exceptionTypeBreakdown,
  filterExceptions,
  filtersAreDefault,
  filterPayments,
  geoBreakdown,
  methodBreakdown,
  seriesFromMetrics,
  topUrgentExceptions,
  type DashboardFilters,
} from '@/domain/analytics';
import {
  EXCEPTION_TYPES,
  EXCEPTION_TYPE_SHORT_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type ExceptionType,
  type PaymentMethod,
} from '@/domain/enums';
import { useData } from '@/hooks/DataContext';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercent,
} from '@/lib/format';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const RANGE_OPTIONS: { value: DashboardFilters['days']; label: string }[] = [
  { value: 1, label: 'Today' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

export function CommandCenter() {
  const {
    payments,
    exceptions,
    metrics,
    customers,
    customerById,
    vendorById,
    userById,
    loading,
    error,
    refresh,
  } = useData();
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  const scopedPayments = useMemo(
    () => filterPayments(payments, filters),
    [payments, filters]
  );
  const scopedExceptions = useMemo(
    () => filterExceptions(exceptions, filters),
    [exceptions, filters]
  );

  const kpis = useMemo(
    () => computeKpis(scopedPayments, scopedExceptions),
    [scopedPayments, scopedExceptions]
  );

  // Unfiltered views read the pre-aggregated daily table; filtered views
  // recompute from the in-memory working set so every slice stays consistent.
  const series = useMemo(
    () =>
      filtersAreDefault(filters)
        ? seriesFromMetrics(metrics, filters.days)
        : buildDailySeries(scopedPayments, scopedExceptions, filters.days),
    [filters, metrics, scopedPayments, scopedExceptions]
  );

  const methods = useMemo(
    () => methodBreakdown(scopedPayments),
    [scopedPayments]
  );
  const types = useMemo(
    () => exceptionTypeBreakdown(scopedExceptions),
    [scopedExceptions]
  );
  const geo = useMemo(() => geoBreakdown(scopedPayments), [scopedPayments]);
  const urgent = useMemo(
    () => topUrgentExceptions(scopedExceptions, 5),
    [scopedExceptions]
  );

  if (loading && payments.length === 0) {
    return <LoadingState label="Loading the operations picture…" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={() => void refresh()} />;
  }

  const activeFilterCount =
    (filters.customerId ? 1 : 0) +
    (filters.paymentMethod ? 1 : 0) +
    (filters.exceptionType ? 1 : 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Operations Command Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Live view of payment throughput, exception backlog and service-level
            exposure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(filters.days)}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                days: Number(v) as DashboardFilters['days'],
              }))
            }
          >
            <SelectTrigger className="w-[150px]" aria-label="Time range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.customerId ?? 'all'}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, customerId: v === 'all' ? null : v }))
            }
          >
            <SelectTrigger className="w-[210px]" aria-label="Customer">
              <SelectValue placeholder="All customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.paymentMethod ?? 'all'}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                paymentMethod: v === 'all' ? null : (v as PaymentMethod),
              }))
            }
          >
            <SelectTrigger className="w-[170px]" aria-label="Payment method">
              <SelectValue placeholder="All methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payment methods</SelectItem>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.exceptionType ?? 'all'}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                exceptionType: v === 'all' ? null : (v as ExceptionType),
              }))
            }
          >
            <SelectTrigger className="w-[200px]" aria-label="Exception type">
              <SelectValue placeholder="All exception types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All exception types</SelectItem>
              {EXCEPTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {EXCEPTION_TYPE_SHORT_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFilterCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFilters((f) => ({
                  ...DEFAULT_FILTERS,
                  days: f.days,
                }))
              }
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear {activeFilterCount} filter
              {activeFilterCount > 1 ? 's' : ''}
            </Button>
          ) : null}
        </div>
      </header>

      <section
        aria-label="Key operating figures"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          label="Payment value today"
          value={formatCompactCurrency(kpis.todayValue)}
          hint={`${formatNumber(kpis.todayCount)} payments initiated today`}
          tooltip="Total USD-equivalent value of payments initiated since midnight, across every payment method in the current filter."
          icon={<Banknote className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Payments processed today"
          value={formatNumber(kpis.todayCount)}
          hint={`${formatNumber(kpis.windowCount)} in the selected range`}
          tooltip="Count of payment instructions initiated since midnight. Retries of an existing payment are not counted again."
          icon={<ListChecks className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Straight-through rate"
          value={formatPercent(kpis.stpRate)}
          hint="Payments settled without manual touch"
          tooltip="Share of payments in the selected range that completed with no operator intervention and no repair step."
          tone={kpis.stpRate >= 85 ? 'positive' : 'warning'}
          icon={<Gauge className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Open exceptions"
          value={formatNumber(kpis.openExceptions)}
          hint="Not yet resolved or closed"
          tooltip="Exceptions in New, Investigating, Waiting on customer, Waiting on vendor or Ready to retry."
          tone={kpis.openExceptions > 40 ? 'warning' : 'default'}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="High-priority exceptions"
          value={formatNumber(kpis.highPriorityOpen)}
          hint="Critical and high, still open"
          tooltip="Open exceptions at Critical or High priority. These carry the tightest resolution targets."
          tone={kpis.highPriorityOpen > 0 ? 'critical' : 'positive'}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="At risk of missing target"
          value={formatNumber(kpis.slaAtRisk)}
          hint="Approaching or past the service-level target"
          tooltip="Open exceptions whose elapsed time has passed the warning threshold for their service-level rule, or has already breached it."
          tone={kpis.slaAtRisk > 0 ? 'warning' : 'positive'}
          icon={<Timer className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Average time to resolution"
          value={formatDuration(kpis.avgResolutionHours)}
          hint="Created to resolved, selected range"
          tooltip="Mean elapsed time between an exception being raised and a resolution being recorded, for exceptions resolved in the selected range."
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Virtual-card rebate opportunity"
          value={formatCompactCurrency(kpis.rebateOpportunity)}
          hint="Estimated on card-eligible spend"
          tooltip="Estimated rebate if card-eligible spend currently paid by another method moved to virtual card, at the configured 1.35% rate."
          tone="positive"
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">
                Exceptions created versus resolved
              </CardTitle>
              <MetricInfo text="Daily count of exceptions raised against exceptions resolved. A resolved line that stays below the created line means the backlog is growing." />
            </div>
            <CardDescription>
              {filtersAreDefault(filters)
                ? 'Sourced from the pre-aggregated daily operational metrics table.'
                : 'Recomputed from the filtered working set.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="var(--chart-5)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">Exception breakdown</CardTitle>
              <MetricInfo text="Open and closed exceptions in the selected range, grouped by category. Select a bar to filter the whole page." />
            </div>
            <CardDescription>Select a category to filter.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {types.length === 0 ? (
              <p className="pt-16 text-center text-sm text-muted-foreground">
                No exceptions in this range.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={types.map((t) => ({
                    ...t,
                    name: EXCEPTION_TYPE_SHORT_LABELS[t.key as ExceptionType],
                  }))}
                  margin={{ left: 4, right: 12 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                  />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    width={128}
                  />
                  <RechartsTooltip />
                  <Bar
                    dataKey="count"
                    name="Exceptions"
                    radius={[0, 4, 4, 0]}
                    onClick={(entry: { key?: string }) =>
                      setFilters((f) => ({
                        ...f,
                        exceptionType:
                          f.exceptionType === entry.key
                            ? null
                            : ((entry.key ?? null) as ExceptionType | null),
                      }))
                    }
                    cursor="pointer"
                  >
                    {types.map((t, i) => (
                      <Cell
                        key={t.key}
                        fill={
                          filters.exceptionType && filters.exceptionType !== t.key
                            ? 'var(--muted)'
                            : CHART_COLORS[i % CHART_COLORS.length]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">Payment value</CardTitle>
              <MetricInfo text="Daily USD-equivalent value of payments initiated, in the selected range and filter." />
            </div>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={54}
                  tickFormatter={(v: number) => formatCompactCurrency(v)}
                />
                <RechartsTooltip
                  formatter={(v: number) => formatCurrency(v, 'USD', { decimals: false })}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Payment value"
                  stroke="var(--chart-1)"
                  fill="url(#valueFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">Volume by payment method</CardTitle>
              <MetricInfo text="USD-equivalent value by rail. Select a rail to filter the page." />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {methods.map((slice, i) => {
              const total = methods.reduce((s, m) => s + m.value, 0) || 1;
              const share = (slice.value / total) * 100;
              const method = slice.key as PaymentMethod;
              const dimmed =
                filters.paymentMethod && filters.paymentMethod !== method;
              return (
                <button
                  key={slice.key}
                  type="button"
                  aria-pressed={filters.paymentMethod === method}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      paymentMethod:
                        f.paymentMethod === method ? null : method,
                    }))
                  }
                  className="w-full rounded-md px-1 py-1 text-left transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium">
                      {PAYMENT_METHOD_LABELS[method]}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCompactCurrency(slice.value)} ·{' '}
                      {formatNumber(slice.count)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(share, 1)}%`,
                        backgroundColor: dimmed
                          ? 'var(--muted-foreground)'
                          : CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <Globe2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">
                Domestic and cross-border
              </CardTitle>
              <MetricInfo text="Payment value by beneficiary country, split between domestic corridors and cross-border corridors." />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {geo.slice(0, 8).map((row) => {
              const total = row.domesticValue + row.crossBorderValue || 1;
              const domesticShare = (row.domesticValue / total) * 100;
              return (
                <div key={row.country}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium">{row.country}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCompactCurrency(total)}
                    </span>
                  </div>
                  <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-[var(--chart-1)]"
                      style={{ width: `${domesticShare}%` }}
                      title={`Domestic ${formatCompactCurrency(row.domesticValue)}`}
                    />
                    <div
                      className="h-full bg-[var(--chart-2)]"
                      style={{ width: `${100 - domesticShare}%` }}
                      title={`Cross-border ${formatCompactCurrency(row.crossBorderValue)}`}
                    />
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatNumber(row.count - row.crossBorderCount)} domestic ·{' '}
                    {formatNumber(row.crossBorderCount)} cross-border
                  </div>
                </div>
              );
            })}
            {geo.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No payments in this range.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-base">
                  Needs attention right now
                </CardTitle>
                <MetricInfo text="Ranked by priority, service-level exposure, overdue time, escalation and payment value." />
              </div>
              <CardDescription>
                The five open exceptions with the highest operational exposure.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/exceptions">Open workbench</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ExceptionCallout
              exceptions={urgent}
              customerById={customerById}
              vendorById={vendorById}
              userById={userById}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
