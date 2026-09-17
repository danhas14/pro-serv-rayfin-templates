import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  PriorityBadge,
  SlaBadge,
  StatusBadge,
} from '@/components/StatusIndicators';
import { EmptyState } from '@/components/States';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  EXCEPTION_TYPE_SHORT_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/domain/enums';
import type { CustomerRow, ExceptionRow, UserRow, VendorRow } from '@/services/columns';
import { formatCurrency, formatDuration, hoursBetween } from '@/lib/format';

export interface ExceptionTableProps {
  exceptions: ExceptionRow[];
  customerById: Map<string, CustomerRow>;
  vendorById: Map<string, VendorRow>;
  userById: Map<string, UserRow>;
  emptyTitle?: string;
  emptyDescription?: string;
  dense?: boolean;
}

export function ExceptionTable({
  exceptions,
  customerById,
  vendorById,
  userById,
  emptyTitle = 'No exceptions match these filters',
  emptyDescription = 'Adjust or clear the filters to widen the queue.',
  dense,
}: ExceptionTableProps) {
  if (exceptions.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">Exception</TableHead>
            <TableHead>Customer / vendor</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            {!dense && <TableHead>Method</TableHead>}
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Service level</TableHead>
            {!dense && <TableHead>Assigned to</TableHead>}
            <TableHead className="text-right">Open for</TableHead>
            <TableHead className="w-[44px]">
              <span className="sr-only">Open</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exceptions.map((exception) => {
            const customer = customerById.get(exception.customer_id);
            const vendor = exception.vendor_id
              ? vendorById.get(exception.vendor_id)
              : undefined;
            const assignee = exception.assignedTo_id
              ? userById.get(exception.assignedTo_id)
              : undefined;

            return (
              <TableRow key={exception.id} className="align-top">
                <TableCell className="font-medium">
                  <Link
                    to={`/exceptions/${exception.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {exception.exceptionCode}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {exception.invoiceNumber}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{customer?.name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">
                    {vendor?.name ?? 'No vendor'}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {EXCEPTION_TYPE_SHORT_LABELS[exception.exceptionType]}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatCurrency(exception.amount, exception.currency, {
                    decimals: false,
                  })}
                  {exception.currency !== 'USD' ? (
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(exception.amountUsd, 'USD', {
                        decimals: false,
                      })}
                    </div>
                  ) : null}
                </TableCell>
                {!dense && (
                  <TableCell className="text-sm">
                    {PAYMENT_METHOD_LABELS[exception.paymentMethod]}
                  </TableCell>
                )}
                <TableCell>
                  <PriorityBadge priority={exception.priority} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={exception.status} />
                </TableCell>
                <TableCell>
                  <SlaBadge risk={exception.slaRisk} />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {exception.slaTargetHours}h target
                  </div>
                </TableCell>
                {!dense && (
                  <TableCell className="text-sm">
                    {assignee?.displayName ?? (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right text-sm tabular-nums">
                  {formatDuration(hoursBetween(exception.createdAt))}
                </TableCell>
                <TableCell>
                  <Link
                    to={`/exceptions/${exception.id}`}
                    aria-label={`Open ${exception.exceptionCode}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
