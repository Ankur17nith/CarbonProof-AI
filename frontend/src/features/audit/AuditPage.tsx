import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AuditEvent, PaginatedResponse } from '@/types/api';
import { formatDate } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { History, Filter, AlertTriangle, ShieldCheck } from 'lucide-react';

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('ALL');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit', page, entityFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (entityFilter !== 'ALL') params.append('entityType', entityFilter);
      return api.get<PaginatedResponse<AuditEvent>>(`audit?${params.toString()}`);
    },
  });

  const auditEvents = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">System Audit Trail</h2>
          <p className="text-xs text-fg-secondary mt-1">
            Immutable administrative event stream recording all lifecycle mutations, assessments, and settlements.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-fg-muted" />
        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-fg shadow-subtle focus-ring"
          aria-label="Filter audit events by entity type"
        >
          <option value="ALL">All Entity Types</option>
          <option value="Project">Projects</option>
          <option value="Evidence">Evidence</option>
          <option value="Assessment">Assessments</option>
          <option value="Review">Reviews</option>
          <option value="CreditBatch">Credit Batches</option>
        </select>
      </div>

      {/* Audit Table */}
      <Card>
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-status-error-text mx-auto" />
            <p className="text-xs text-status-error-text font-medium">
              {error instanceof Error ? error.message : 'Failed to load audit events'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : auditEvents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <History className="h-8 w-8 text-fg-muted mx-auto" />
            <h4 className="text-sm font-semibold">No audit events recorded</h4>
            <p className="text-xs text-fg-secondary max-w-sm mx-auto">
              Mutations across projects, evidence, assessments, and credits will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Correlation ID</TableHead>
                  <TableHead>Metadata Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs text-fg-muted whitespace-nowrap">
                      {formatDate(event.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono font-medium">
                        {event.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-fg">
                      {event.entityType}{' '}
                      <span className="text-[11px] text-fg-muted font-normal font-mono block">
                        {event.entityId.slice(0, 8)}…
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-fg-secondary">
                      {event.correlationId ? `${event.correlationId.slice(0, 8)}…` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-fg-secondary font-mono max-w-xs truncate">
                      {JSON.stringify(event.metadata)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-fg-muted">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
