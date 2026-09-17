import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ExceptionTable } from '@/components/ExceptionTable';
import { ErrorState, LoadingState } from '@/components/States';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  EXCEPTION_STATUSES,
  EXCEPTION_STATUS_LABELS,
  EXCEPTION_TYPES,
  EXCEPTION_TYPE_SHORT_LABELS,
  OPEN_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_RANK,
  SLA_RISK_LABELS,
  type ExceptionPriority,
  type ExceptionStatus,
  type ExceptionType,
  type PaymentMethod,
  type SlaRisk,
} from '@/domain/enums';
import { useData } from '@/hooks/DataContext';
import { useSession } from '@/hooks/SessionContext';

type SortKey = 'urgency' | 'newest' | 'oldest' | 'amount' | 'sla';

interface WorkbenchFilters {
  search: string;
  customerId: string;
  vendorId: string;
  paymentMethod: string;
  exceptionType: string;
  priority: string;
  status: string;
  assignee: string;
  country: string;
  currency: string;
  slaRisk: string;
  createdWithinDays: string;
}

const EMPTY_FILTERS: WorkbenchFilters = {
  search: '',
  customerId: 'all',
  vendorId: 'all',
  paymentMethod: 'all',
  exceptionType: 'all',
  priority: 'all',
  status: 'open',
  assignee: 'all',
  country: 'all',
  currency: 'all',
  slaRisk: 'all',
  createdWithinDays: '90',
};

export function ExceptionWorkbench() {
  const {
    exceptions,
    customers,
    vendors,
    users,
    customerById,
    vendorById,
    userById,
    loading,
    error,
    refresh,
  } = useData();
  const { operator } = useSession();
  const [filters, setFilters] = useState<WorkbenchFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('urgency');

  const countries = useMemo(
    () => [...new Set(exceptions.map((e) => e.country))].sort(),
    [exceptions]
  );
  const currencies = useMemo(
    () => [...new Set(exceptions.map((e) => e.currency))].sort(),
    [exceptions]
  );

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    const cutoff =
      Date.now() - Number(filters.createdWithinDays) * 86_400_000;

    const rows = exceptions.filter((e) => {
      if (new Date(e.createdAt).getTime() < cutoff) return false;
      if (filters.status === 'open' && !OPEN_STATUSES.includes(e.status)) {
        return false;
      }
      if (
        filters.status !== 'open' &&
        filters.status !== 'all' &&
        e.status !== filters.status
      ) {
        return false;
      }
      if (filters.customerId !== 'all' && e.customer_id !== filters.customerId) {
        return false;
      }
      if (filters.vendorId !== 'all' && e.vendor_id !== filters.vendorId) {
        return false;
      }
      if (
        filters.paymentMethod !== 'all' &&
        e.paymentMethod !== filters.paymentMethod
      ) {
        return false;
      }
      if (
        filters.exceptionType !== 'all' &&
        e.exceptionType !== filters.exceptionType
      ) {
        return false;
      }
      if (filters.priority !== 'all' && e.priority !== filters.priority) {
        return false;
      }
      if (filters.assignee === 'unassigned' && e.assignedTo_id) return false;
      if (filters.assignee === 'mine' && e.assignedTo_id !== operator?.id) {
        return false;
      }
      if (
        filters.assignee !== 'all' &&
        filters.assignee !== 'unassigned' &&
        filters.assignee !== 'mine' &&
        e.assignedTo_id !== filters.assignee
      ) {
        return false;
      }
      if (filters.country !== 'all' && e.country !== filters.country) {
        return false;
      }
      if (filters.currency !== 'all' && e.currency !== filters.currency) {
        return false;
      }
      if (filters.slaRisk !== 'all' && e.slaRisk !== filters.slaRisk) {
        return false;
      }
      if (term) {
        const haystack = [
          e.exceptionCode,
          e.invoiceNumber,
          e.paymentReference ?? '',
          customerById.get(e.customer_id)?.name ?? '',
          e.vendor_id ? (vendorById.get(e.vendor_id)?.name ?? '') : '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    const sorted = [...rows];
    switch (sort) {
      case 'newest':
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'oldest':
        sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case 'amount':
        sorted.sort((a, b) => b.amountUsd - a.amountUsd);
        break;
      case 'sla':
        sorted.sort(
          (a, b) =>
            new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime()
        );
        break;
      default:
        sorted.sort((a, b) => {
          const risk = { breached: 0, 'at-risk': 1, 'on-track': 2 };
          const byRisk = risk[a.slaRisk] - risk[b.slaRisk];
          if (byRisk !== 0) return byRisk;
          const byPriority =
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          if (byPriority !== 0) return byPriority;
          return new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime();
        });
    }
    return sorted;
  }, [exceptions, filters, sort, operator?.id, customerById, vendorById]);

  if (loading && exceptions.length === 0) {
    return <LoadingState label="Loading the exception queue…" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={() => void refresh()} />;
  }

  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Exception Workbench
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length.toLocaleString()} of{' '}
            {exceptions.length.toLocaleString()} exceptions match the current
            filters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="sort" className="text-xs text-muted-foreground">
            Sort by
          </Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger id="sort" className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urgency">Operational urgency</SelectItem>
              <SelectItem value="sla">Service-level due date</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="amount">Largest amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search
                className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Search exceptions"
                placeholder="Search exception, invoice, payment, customer or vendor"
                className="pl-8"
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
              />
            </div>
            {dirty ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Reset filters
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <FilterSelect
              label="Customer"
              value={filters.customerId}
              onChange={(v) => setFilters((f) => ({ ...f, customerId: v }))}
              allLabel="All customers"
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
            <FilterSelect
              label="Vendor"
              value={filters.vendorId}
              onChange={(v) => setFilters((f) => ({ ...f, vendorId: v }))}
              allLabel="All vendors"
              options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            />
            <FilterSelect
              label="Payment method"
              value={filters.paymentMethod}
              onChange={(v) => setFilters((f) => ({ ...f, paymentMethod: v }))}
              allLabel="All methods"
              options={PAYMENT_METHODS.map((m: PaymentMethod) => ({
                value: m,
                label: PAYMENT_METHOD_LABELS[m],
              }))}
            />
            <FilterSelect
              label="Exception type"
              value={filters.exceptionType}
              onChange={(v) => setFilters((f) => ({ ...f, exceptionType: v }))}
              allLabel="All types"
              options={EXCEPTION_TYPES.map((t: ExceptionType) => ({
                value: t,
                label: EXCEPTION_TYPE_SHORT_LABELS[t],
              }))}
            />
            <FilterSelect
              label="Priority"
              value={filters.priority}
              onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
              allLabel="All priorities"
              options={PRIORITIES.map((p: ExceptionPriority) => ({
                value: p,
                label: PRIORITY_LABELS[p],
              }))}
            />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              allLabel="All statuses"
              extraOptions={[{ value: 'open', label: 'Open only' }]}
              options={EXCEPTION_STATUSES.map((s: ExceptionStatus) => ({
                value: s,
                label: EXCEPTION_STATUS_LABELS[s],
              }))}
            />
            <FilterSelect
              label="Assigned specialist"
              value={filters.assignee}
              onChange={(v) => setFilters((f) => ({ ...f, assignee: v }))}
              allLabel="Anyone"
              extraOptions={[
                { value: 'mine', label: 'Assigned to me' },
                { value: 'unassigned', label: 'Unassigned' },
              ]}
              options={users
                .filter(
                  (u) =>
                    u.primaryRole === 'payment-operations-specialist' ||
                    u.primaryRole === 'operations-manager'
                )
                .map((u) => ({ value: u.id, label: u.displayName }))}
            />
            <FilterSelect
              label="Country"
              value={filters.country}
              onChange={(v) => setFilters((f) => ({ ...f, country: v }))}
              allLabel="All countries"
              options={countries.map((c) => ({ value: c, label: c }))}
            />
            <FilterSelect
              label="Currency"
              value={filters.currency}
              onChange={(v) => setFilters((f) => ({ ...f, currency: v }))}
              allLabel="All currencies"
              options={currencies.map((c) => ({ value: c, label: c }))}
            />
            <FilterSelect
              label="Service-level risk"
              value={filters.slaRisk}
              onChange={(v) => setFilters((f) => ({ ...f, slaRisk: v }))}
              allLabel="Any"
              options={(
                ['on-track', 'at-risk', 'breached'] as SlaRisk[]
              ).map((r) => ({ value: r, label: SLA_RISK_LABELS[r] }))}
            />
            <FilterSelect
              label="Created"
              value={filters.createdWithinDays}
              onChange={(v) =>
                setFilters((f) => ({ ...f, createdWithinDays: v }))
              }
              allLabel="Any time"
              hideAll
              options={[
                { value: '1', label: 'Today' },
                { value: '7', label: 'Last 7 days' },
                { value: '30', label: 'Last 30 days' },
                { value: '90', label: 'Last 90 days' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <ExceptionTable
        exceptions={filtered}
        customerById={customerById}
        vendorById={vendorById}
        userById={userById}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  extraOptions,
  hideAll,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
  extraOptions?: { value: string; label: string }[];
  hideAll?: boolean;
}) {
  const id = `filter-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {!hideAll ? <SelectItem value="all">{allLabel}</SelectItem> : null}
          {extraOptions?.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
