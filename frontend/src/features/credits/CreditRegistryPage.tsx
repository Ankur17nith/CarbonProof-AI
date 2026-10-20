import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { CreditBatch, Project, PaginatedResponse, CreditLifecycleEvent } from '@/types/api';
import {
  formatDate,
  formatNumber,
  truncateHash,
  getBlockchainStatusConfig,
} from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Coins,
  Plus,
  ArrowUpRight,
  Flame,
  History,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export function CreditRegistryPage() {
  const queryClient = useQueryClient();
  const { role } = useAuth();

  const [selectedBatch, setSelectedBatch] = useState<CreditBatch | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isRetireModalOpen, setIsRetireModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Form states
  const [newProjectId, setNewProjectId] = useState('');
  const [newBatchRef, setNewBatchRef] = useState('');
  const [newUnit, setNewUnit] = useState('tCO2e');
  const [newTotalQty, setNewTotalQty] = useState('1000');
  const [actionQuantity, setActionQuantity] = useState('100');

  // 1. Fetch batches
  const { data: batches, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['credits', 'all-batches'],
    queryFn: () => api.get<CreditBatch[]>('credits/batches'),
  });

  // 2. Fetch projects for creation dropdown
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'credits-dropdown'],
    queryFn: () => api.get<PaginatedResponse<Project>>('projects?pageSize=100'),
  });

  const projects = projectsData?.items ?? [];
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // 3. Fetch events for selected batch history
  const { data: batchEvents, isLoading: loadingEvents } = useQuery({
    queryKey: ['credit-events', selectedBatch?.id],
    queryFn: () => api.get<CreditLifecycleEvent[]>(`credits/batches/${selectedBatch?.id}/events`),
    enabled: Boolean(selectedBatch && isHistoryModalOpen),
  });

  // Mutation: Create Batch
  const createBatchMutation = useMutation({
    mutationFn: () =>
      api.post<CreditBatch>('credits/batches', {
        projectId: newProjectId,
        batchReference: newBatchRef,
        unit: newUnit,
        totalQuantity: newTotalQty,
      }),
    onSuccess: (b) => {
      toast.success(`Batch "${b.batchReference}" registered successfully.`);
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setIsCreateModalOpen(false);
      setNewBatchRef('');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to register credit batch');
    },
  });

  // Mutation: Issue Credits
  const issueMutation = useMutation({
    mutationFn: ({ batchId, quantity }: { batchId: string; quantity: string }) =>
      api.post<{ batch: CreditBatch; replayed: boolean }>(
        `credits/batches/${batchId}/issue`,
        { quantity },
        { idempotencyKey: `issue-${batchId}-${Date.now()}` },
      ),
    onSuccess: (res) => {
      toast.success(
        `Issued ${actionQuantity} credits! Available balance: ${
          BigInt(res.batch.issuedQuantity) - BigInt(res.batch.retiredQuantity)
        }`,
      );
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setIsIssueModalOpen(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Issuance failed');
    },
  });

  // Mutation: Retire Credits
  const retireMutation = useMutation({
    mutationFn: ({ batchId, quantity }: { batchId: string; quantity: string }) =>
      api.post<{ batch: CreditBatch; replayed: boolean }>(
        `credits/batches/${batchId}/retire`,
        { quantity },
        { idempotencyKey: `retire-${batchId}-${Date.now()}` },
      ),
    onSuccess: (res) => {
      toast.success(`Retired ${actionQuantity} credits permanently on-chain.`);
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      setIsRetireModalOpen(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Retirement failed');
    },
  });

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Carbon Credit Registry</h2>
          <p className="text-xs text-fg-secondary mt-1">
            Dual-layer credit allocation ledger, supply verification, and on-chain settlement.
          </p>
        </div>
        {(role === 'CONTRIBUTOR' || role === 'ADMIN') && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (projects.length > 0) setNewProjectId(projects[0].id);
              setIsCreateModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Create Batch</span>
          </Button>
        )}
      </div>

      {/* Batches Table Card */}
      <Card>
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-status-error-text mx-auto" />
            <p className="text-xs text-status-error-text font-medium">
              {error instanceof Error ? error.message : 'Failed to load credit batches'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : !batches || batches.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Coins className="h-8 w-8 text-fg-muted mx-auto" />
            <h4 className="text-sm font-semibold">No credit pools registered</h4>
            <p className="text-xs text-fg-secondary max-w-sm mx-auto">
              Register a project and create a credit batch pool to start lifecycle management.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch Ref & Project</TableHead>
                <TableHead>Total Pool</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Retired</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Lifecycle Status</TableHead>
                <TableHead>Settlement</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => {
                const project = projectMap.get(batch.projectId);
                const total = BigInt(batch.totalQuantity || '0');
                const issued = BigInt(batch.issuedQuantity || '0');
                const retired = BigInt(batch.retiredQuantity || '0');
                const available = issued - retired;

                return (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div className="font-semibold text-xs text-fg">{batch.batchReference}</div>
                      <Link
                        to={`/projects/${batch.projectId}`}
                        className="text-[11px] text-accent hover:underline block truncate max-w-[180px]"
                      >
                        {project ? project.name : `Project ${batch.projectId.slice(0, 8)}…`}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatNumber(batch.totalQuantity)} {batch.unit}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-status-success-text">
                      {formatNumber(batch.issuedQuantity)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-status-error-text">
                      {formatNumber(batch.retiredQuantity)}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-fg">
                      {formatNumber(available.toString())}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {batch.lifecycleStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {batch.contractAddress ? (
                        <div className="space-y-0.5">
                          <span className="block text-[10px] font-mono text-fg-secondary" title={batch.contractAddress}>
                            Contract: {truncateHash(batch.contractAddress, 6, 4)}
                          </span>
                          <Badge variant="success" className="text-[9px] py-0 px-1.5">
                            Chain {batch.chainId ?? 31337}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-fg-muted">In-Memory / Off-Chain</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSelectedBatch(batch);
                          setIsHistoryModalOpen(true);
                        }}
                      >
                        <History className="h-3.5 w-3.5" />
                        <span>History</span>
                      </Button>

                      {role === 'ADMIN' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setSelectedBatch(batch);
                              setActionQuantity('100');
                              setIsIssueModalOpen(true);
                            }}
                          >
                            <ArrowUpRight className="h-3 w-3" />
                            <span>Issue</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setSelectedBatch(batch);
                              setActionQuantity('50');
                              setIsRetireModalOpen(true);
                            }}
                          >
                            <Flame className="h-3 w-3 text-status-error-text" />
                            <span>Retire</span>
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create Batch Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Credit Batch"
        description="Establish an authorized volume pool for issuance and retirement."
      >
        <div className="space-y-4">
          <Select
            label="Associated Project"
            value={newProjectId}
            onChange={(e) => setNewProjectId(e.target.value)}
            required
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.slug})
              </option>
            ))}
          </Select>

          <Input
            label="Batch Reference Identifier"
            placeholder="e.g. V-REDD-2026-001"
            value={newBatchRef}
            onChange={(e) => setNewBatchRef(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Credit Unit"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              required
            />
            <Input
              label="Total Capacity Quantity"
              type="number"
              min="1"
              value={newTotalQty}
              onChange={(e) => setNewTotalQty(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={createBatchMutation.isPending}
              onClick={() => createBatchMutation.mutate()}
            >
              Register Pool
            </Button>
          </div>
        </div>
      </Modal>

      {/* Issue Modal */}
      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title={selectedBatch ? `Issue Credits: ${selectedBatch.batchReference}` : 'Issue Credits'}
        description="Mint authorized credits into active circulation. Idempotency protects against double-spending."
      >
        <div className="space-y-4">
          <Input
            label="Quantity to Issue"
            type="number"
            min="1"
            value={actionQuantity}
            onChange={(e) => setActionQuantity(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsIssueModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={issueMutation.isPending}
              onClick={() => {
                if (selectedBatch) {
                  issueMutation.mutate({ batchId: selectedBatch.id, quantity: actionQuantity });
                }
              }}
            >
              Confirm Issuance
            </Button>
          </div>
        </div>
      </Modal>

      {/* Retire Modal */}
      <Modal
        isOpen={isRetireModalOpen}
        onClose={() => setIsRetireModalOpen(false)}
        title={selectedBatch ? `Retire Credits: ${selectedBatch.batchReference}` : 'Retire Credits'}
        description="Permanently burn credits to claim carbon offset. Quantity cannot exceed available issued balance."
      >
        <div className="space-y-4">
          <Input
            label="Quantity to Retire"
            type="number"
            min="1"
            value={actionQuantity}
            onChange={(e) => setActionQuantity(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsRetireModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={retireMutation.isPending}
              onClick={() => {
                if (selectedBatch) {
                  retireMutation.mutate({ batchId: selectedBatch.id, quantity: actionQuantity });
                }
              }}
            >
              Execute Permanent Retirement
            </Button>
          </div>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Lifecycle Events: ${selectedBatch?.batchReference ?? ''}`}
        description="Immutable record of issuance and retirement operations."
      >
        <div className="space-y-3">
          {loadingEvents ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !batchEvents || batchEvents.length === 0 ? (
            <p className="text-center text-xs text-fg-muted py-6">
              No issuance or retirement operations executed yet for this batch.
            </p>
          ) : (
            <div className="divide-y divide-border/60 max-h-80 overflow-y-auto">
              {batchEvents.map((event) => (
                <div key={event.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={event.eventType === 'ISSUED' ? 'success' : 'error'}
                        className="text-[10px]"
                      >
                        {event.eventType}
                      </Badge>
                      <span className="font-mono font-bold text-fg">
                        {formatNumber(event.quantity)}
                      </span>
                    </div>
                    {event.transactionHash && (
                      <span className="block text-[10px] font-mono text-fg-muted mt-0.5">
                        Tx: {truncateHash(event.transactionHash, 8, 6)}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-fg-muted">{formatDate(event.createdAt)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsHistoryModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
