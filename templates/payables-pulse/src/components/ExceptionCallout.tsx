import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  PriorityBadge,
  SlaBadge,
  StatusBadge,
} from '@/components/StatusIndicators';
import { EmptyState } from '@/components/States';
import {
  EXCEPTION_TYPE_SHORT_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/domain/enums';
import { formatCurrency, formatDuration, hoursBetween } from '@/lib/format';
import type { CustomerRow, ExceptionRow, UserRow, VendorRow } from '@/services/columns';

/**
 * Compact card list used where a full queue table would be clipped, such as the
 * dashboard's "needs attention" panel.
 */
export function ExceptionCallout({
  exceptions,
  customerById,
  vendorById,
  userById,
}: {
  exceptions: ExceptionRow[];
  customerById: Map<string, CustomerRow>;
  vendorById: Map<string, VendorRow>;
  userById: Map<string, UserRow>;
}) {
  if (exceptions.length === 0) {
    return (
      <EmptyState
        title="Nothing needs immediate attention"
        description="No open exceptions match the current filters."
      />
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {exceptions.map((exception) => {
        const customer = customerById.get(exception.customer_id);
        const vendor = exception.vendor_id
          ? vendorById.get(exception.vendor_id)
          : undefined;
        const assignee = exception.assignedTo_id
          ? userById.get(exception.assignedTo_id)
          : undefined;

        return (
          <li key={exception.id}>
            <Link
              to={`/exceptions/${exception.id}`}
              className="block px-3 py-2.5 transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">
                      {exception.exceptionCode}
                    </span>
                    <span className="truncate text-sm text-foreground">
                      {customer?.name ?? 'Unknown customer'}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {exception.invoiceNumber} · {vendor?.name ?? 'No vendor'} ·{' '}
                    {EXCEPTION_TYPE_SHORT_LABELS[exception.exceptionType]}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-medium tabular-nums">
                    {formatCurrency(exception.amount, exception.currency, {
                      decimals: false,
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[exception.paymentMethod]}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <PriorityBadge priority={exception.priority} />
                  <StatusBadge status={exception.status} />
                  <SlaBadge risk={exception.slaRisk} />
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {formatDuration(hoursBetween(exception.createdAt))} open ·{' '}
                    {exception.slaTargetHours}h target ·{' '}
                    {assignee?.displayName ?? 'Unassigned'}
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
