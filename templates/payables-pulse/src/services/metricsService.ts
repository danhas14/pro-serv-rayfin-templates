import {
  METRIC_COLUMNS,
  PAYMENT_COLUMNS,
  type MetricRow,
  type PaymentRow,
} from './columns';
import { db, MAX_ROWS } from './dataUtils';

export async function listDailyMetrics(): Promise<MetricRow[]> {
  return db()
    .DailyOperationalMetric.select([...METRIC_COLUMNS])
    .orderBy({ metricDateKey: 'asc' })
    .first(400)
    .execute();
}

/**
 * Load the payment rows the dashboards slice through.
 *
 * Data API Builder has no server-side aggregation, so the 90-day working set
 * is pulled once and every KPI, chart and filter is computed from it in memory.
 */
export async function listPayments(since: Date): Promise<PaymentRow[]> {
  return db()
    .Payment.select([...PAYMENT_COLUMNS])
    .where({ initiatedAt: { gte: since } })
    .orderBy({ initiatedAt: 'desc' })
    .first(MAX_ROWS)
    .execute();
}

export async function listPaymentsForCustomer(
  customerId: string
): Promise<PaymentRow[]> {
  return db()
    .Payment.select([...PAYMENT_COLUMNS])
    .where({ customer_id: { eq: customerId } })
    .orderBy({ initiatedAt: 'desc' })
    .first(MAX_ROWS)
    .execute();
}

export async function listPaymentsForVendor(
  vendorId: string
): Promise<PaymentRow[]> {
  return db()
    .Payment.select([...PAYMENT_COLUMNS])
    .where({ vendor_id: { eq: vendorId } })
    .orderBy({ initiatedAt: 'desc' })
    .first(1000)
    .execute();
}
