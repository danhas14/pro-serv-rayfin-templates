import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import { listAuditEvents } from '@/services/auditService';
import type { AuditRow } from '@/services/columns';

export function AuditTrail() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listAuditEvents(300));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load the audit trail.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      `${row.actingUserName} ${row.entityType} ${row.entityLabel} ${row.action} ${row.fieldName ?? ''} ${row.explanation ?? ''}`
        .toLowerCase()
        .includes(term)
    );
  }, [rows, search]);

  if (loading) return <LoadingState label="Loading the audit trail…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit Trail</h1>
          <p className="text-sm text-muted-foreground">
            Every write in Payables Pulse appends a record here. The data API
            grants read and create only, so entries cannot be edited or deleted.
          </p>
        </div>
        <div className="relative min-w-[260px]">
          <Search
            className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search the audit trail"
            placeholder="Search actor, entity or action"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filtered.length.toLocaleString()} recent events
          </CardTitle>
          <CardDescription>
            Most recent first, capped at the latest 300 entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          {filtered.length === 0 ? (
            <EmptyState
              className="mx-6 mb-6"
              title="No audit events"
              description="Actions taken in the application will appear here immediately."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">When</TableHead>
                  <TableHead>Acting user</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id} className="align-top">
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {formatDateTime(row.occurredAt)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {row.actingUserName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.actingUserRole}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{row.entityLabel}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.entityType}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.action}</Badge>
                    </TableCell>
                    <TableCell className="max-w-sm text-xs break-words whitespace-normal text-muted-foreground">
                      {row.fieldName ? (
                        <span className="font-medium text-foreground">
                          {row.fieldName}:{' '}
                        </span>
                      ) : null}
                      {row.previousValue ? `${row.previousValue} → ` : ''}
                      {row.newValue ?? ''}
                      {row.explanation ? (
                        <div className="mt-0.5">{row.explanation}</div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
