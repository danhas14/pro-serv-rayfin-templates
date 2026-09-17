import type {
  CustomerRow,
  ExceptionRow,
  MetricRow,
  PaymentRow,
  VendorRow,
} from '../services/columns';

import {
  OPEN_STATUSES,
  PAYMENT_METHODS,
  type ExceptionType,
  type PaymentMethod,
} from './enums';

export interface DashboardFilters {
  customerId: string | null;
  paymentMethod: PaymentMethod | null;
  exceptionType: ExceptionType | null;
  days: 1 | 7 | 30 | 90;
}

export const DEFAULT_FILTERS: DashboardFilters = {
  customerId: null,
  paymentMethod: null,
  exceptionType: null,
  days: 30,
};

export function filtersAreDefault(filters: DashboardFilters): boolean {
  return (
    !filters.customerId && !filters.paymentMethod && !filters.exceptionType
  );
}

export function windowStart(days: number, now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export function filterPayments(
  payments: PaymentRow[],
  filters: DashboardFilters,
  now = new Date()
): PaymentRow[] {
  const start = windowStart(filters.days, now).getTime();
  return payments.filter((p) => {
    if (new Date(p.initiatedAt).getTime() < start) return false;
    if (filters.customerId && p.customer_id !== filters.customerId) return false;
    if (filters.paymentMethod && p.paymentMethod !== filters.paymentMethod) {
      return false;
    }
    return true;
  });
}

export function filterExceptions(
  exceptions: ExceptionRow[],
  filters: DashboardFilters,
  now = new Date()
): ExceptionRow[] {
  const start = windowStart(filters.days, now).getTime();
  return exceptions.filter((e) => {
    if (new Date(e.createdAt).getTime() < start) return false;
    if (filters.customerId && e.customer_id !== filters.customerId) return false;
    if (filters.paymentMethod && e.paymentMethod !== filters.paymentMethod) {
      return false;
    }
    if (filters.exceptionType && e.exceptionType !== filters.exceptionType) {
      return false;
    }
    return true;
  });
}

export function isOpen(exception: ExceptionRow): boolean {
  return OPEN_STATUSES.includes(exception.status);
}

export interface CommandCenterKpis {
  todayValue: number;
  todayCount: number;
  stpRate: number;
  openExceptions: number;
  highPriorityOpen: number;
  slaAtRisk: number;
  avgResolutionHours: number;
  rebateOpportunity: number;
  windowValue: number;
  windowCount: number;
  successRate: number;
}

export function computeKpis(
  payments: PaymentRow[],
  exceptions: ExceptionRow[],
  now = new Date()
): CommandCenterKpis {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const today = payments.filter(
    (p) => new Date(p.initiatedAt).getTime() >= todayStart.getTime()
  );
  const open = exceptions.filter(isOpen);
  const resolved = exceptions.filter((e) => e.resolvedAt);
  const settled = payments.filter(
    (p) => p.status === 'settled' || p.status === 'processing'
  );
  const stp = payments.filter((p) => p.straightThrough);

  return {
    todayValue: sum(today.map((p) => p.amountUsd)),
    todayCount: today.length,
    stpRate: rate(stp.length, payments.length),
    openExceptions: open.length,
    highPriorityOpen: open.filter(
      (e) => e.priority === 'critical' || e.priority === 'high'
    ).length,
    slaAtRisk: open.filter((e) => e.slaRisk !== 'on-track').length,
    avgResolutionHours: resolved.length
      ? round1(
          resolved.reduce(
            (acc, e) =>
              acc +
              (new Date(e.resolvedAt as unknown as string).getTime() -
                new Date(e.createdAt).getTime()) /
                3_600_000,
            0
          ) / resolved.length
        )
      : 0,
    rebateOpportunity: round2(
      payments
        .filter((p) => !p.rebateEligible && p.amountUsd < 100_000)
        .reduce((acc, p) => acc + p.amountUsd * 0.0135, 0)
    ),
    windowValue: sum(payments.map((p) => p.amountUsd)),
    windowCount: payments.length,
    successRate: rate(settled.length, payments.length),
  };
}

export interface DaySeriesPoint {
  dateKey: string;
  label: string;
  value: number;
  count: number;
  created: number;
  resolved: number;
}

export function buildDailySeries(
  payments: PaymentRow[],
  exceptions: ExceptionRow[],
  days: number,
  now = new Date()
): DaySeriesPoint[] {
  const start = windowStart(days, now);
  const points: DaySeriesPoint[] = [];

  for (let i = 0; i < days; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const next = new Date(day.getTime() + 86_400_000);
    const inDay = <T,>(list: T[], accessor: (item: T) => string | Date) =>
      list.filter((item) => {
        const t = new Date(accessor(item)).getTime();
        return t >= day.getTime() && t < next.getTime();
      });

    const dayPayments = inDay(payments, (p) => p.initiatedAt as unknown as string);
    const created = inDay(exceptions, (e) => e.createdAt as unknown as string);
    const resolved = exceptions.filter((e) => {
      if (!e.resolvedAt) return false;
      const t = new Date(e.resolvedAt as unknown as string).getTime();
      return t >= day.getTime() && t < next.getTime();
    });

    points.push({
      dateKey: keyOf(day),
      label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: sum(dayPayments.map((p) => p.amountUsd)),
      count: dayPayments.length,
      created: created.length,
      resolved: resolved.length,
    });
  }

  return points;
}

/** Fast path for the unfiltered dashboard: use the pre-aggregated daily table. */
export function seriesFromMetrics(
  metrics: MetricRow[],
  days: number,
  now = new Date()
): DaySeriesPoint[] {
  const start = windowStart(days, now).getTime();
  return metrics
    .filter((m) => new Date(m.metricDate).getTime() >= start)
    .map((m) => ({
      dateKey: m.metricDateKey,
      label: new Date(m.metricDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      value: m.totalPaymentValue,
      count: m.paymentCount,
      created: m.exceptionsCreated,
      resolved: m.exceptionsResolved,
    }));
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  count: number;
}

export function methodBreakdown(payments: PaymentRow[]): Slice[] {
  return PAYMENT_METHODS.map((method) => {
    const list = payments.filter((p) => p.paymentMethod === method);
    return {
      key: method,
      label: method,
      value: sum(list.map((p) => p.amountUsd)),
      count: list.length,
    };
  });
}

export function exceptionTypeBreakdown(exceptions: ExceptionRow[]): Slice[] {
  const map = new Map<string, Slice>();
  for (const e of exceptions) {
    const entry = map.get(e.exceptionType) ?? {
      key: e.exceptionType,
      label: e.exceptionType,
      value: 0,
      count: 0,
    };
    entry.count += 1;
    entry.value += e.amountUsd;
    map.set(e.exceptionType, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export interface GeoSlice {
  country: string;
  domesticValue: number;
  crossBorderValue: number;
  count: number;
  crossBorderCount: number;
}

export function geoBreakdown(payments: PaymentRow[]): GeoSlice[] {
  const map = new Map<string, GeoSlice>();
  for (const p of payments) {
    const entry = map.get(p.country) ?? {
      country: p.country,
      domesticValue: 0,
      crossBorderValue: 0,
      count: 0,
      crossBorderCount: 0,
    };
    entry.count += 1;
    if (p.isCrossBorder) {
      entry.crossBorderValue += p.amountUsd;
      entry.crossBorderCount += 1;
    } else {
      entry.domesticValue += p.amountUsd;
    }
    map.set(p.country, entry);
  }
  return [...map.values()].sort(
    (a, b) =>
      b.domesticValue + b.crossBorderValue - (a.domesticValue + a.crossBorderValue)
  );
}

/** Ranking used by the "needs attention now" list. */
export function urgencyScore(exception: ExceptionRow, now = new Date()): number {
  const priorityWeight = { critical: 400, high: 250, medium: 120, low: 40 }[
    exception.priority
  ];
  const riskWeight = { breached: 300, 'at-risk': 150, 'on-track': 0 }[
    exception.slaRisk
  ];
  const dueIn =
    (new Date(exception.slaDueAt).getTime() - now.getTime()) / 3_600_000;
  const overdueWeight = dueIn < 0 ? Math.min(200, -dueIn * 4) : 0;
  const valueWeight = Math.min(150, exception.amountUsd / 5000);
  const escalation = exception.escalated ? 120 : 0;
  return priorityWeight + riskWeight + overdueWeight + valueWeight + escalation;
}

export function topUrgentExceptions(
  exceptions: ExceptionRow[],
  count = 5,
  now = new Date()
): ExceptionRow[] {
  return exceptions
    .filter(isOpen)
    .map((e) => ({ e, score: urgencyScore(e, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.e);
}

/* ------------------------------------------------------ customer / vendor */

export interface CustomerInsight {
  customer: CustomerRow;
  openExceptions: number;
  breachedExceptions: number;
  topExceptionTypes: Slice[];
}

export function customerInsight(
  customer: CustomerRow,
  exceptions: ExceptionRow[]
): CustomerInsight {
  const own = exceptions.filter((e) => e.customer_id === customer.id);
  return {
    customer,
    openExceptions: own.filter(isOpen).length,
    breachedExceptions: own.filter((e) => isOpen(e) && e.slaRisk === 'breached')
      .length,
    topExceptionTypes: exceptionTypeBreakdown(own).slice(0, 3),
  };
}

export interface VendorInsight {
  vendor: VendorRow;
  openExceptions: number;
  failureRate: number;
  rebateOpportunity: number;
}

export function vendorInsight(
  vendor: VendorRow,
  exceptions: ExceptionRow[],
  payments: PaymentRow[]
): VendorInsight {
  const own = exceptions.filter((e) => e.vendor_id === vendor.id);
  const vendorPayments = payments.filter((p) => p.vendor_id === vendor.id);
  const eligibleSpend = vendor.virtualCardEligible && !vendor.virtualCardEnrolled
    ? sum(
        vendorPayments
          .filter((p) => p.paymentMethod !== 'virtual-card' && p.amountUsd < 100_000)
          .map((p) => p.amountUsd)
      )
    : 0;

  return {
    vendor,
    openExceptions: own.filter(isOpen).length,
    failureRate: rate(vendor.failedPaymentCount, vendor.paymentCount90d),
    rebateOpportunity: round2(eligibleSpend * 0.0135),
  };
}

/* ---------------------------------------------------------------- numbers */

function sum(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + Number(v ?? 0), 0));
}

function rate(part: number, total: number): number {
  return total ? round1((part / total) * 100) : 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function keyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
