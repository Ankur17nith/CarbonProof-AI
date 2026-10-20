import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type {
  Project,
  Evidence,
  Assessment,
  CreditBatch,
  Review,
  ReviewDecision,
} from '@/types/api';
import {
  formatDate,
  formatNumber,
  formatFileSize,
  truncateHash,
  getProjectStatusConfig,
  getSeverityConfig,
  getRiskLevelConfig,
  getBlockchainStatusConfig,
} from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  FolderTree,
  FileCheck2,
  BrainCircuit,
  Coins,
  History,
  Upload,
  Play,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Download,
  Fingerprint,
} from 'lucide-react';
import { toast } from 'sonner';

export function ProjectDetailPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<'evidence' | 'assessments' | 'credits' | 'reviews'>('evidence');

  // Modal states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [isRetireOpen, setIsRetireOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Upload Form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('field-audit');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Batch Form state
  const [batchRef, setBatchRef] = useState('');
  const [batchUnit, setBatchUnit] = useState('tCO2e');
  const [batchTotal, setBatchTotal] = useState('1000');

  // Mutation Quantity state
  const [mutateQty, setMutateQty] = useState('100');

  // Review Form state
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>('APPROVED_FOR_INTERNAL_REVIEW');
  const [reviewRationale, setReviewRationale] = useState('');

  // 1. Fetch Project
  const { data: project, isLoading: loadingProject, isError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<Project>(`projects/${projectId}`),
    enabled: Boolean(projectId),
  });

  // 2. Fetch Evidence
  const { data: evidenceList, isLoading: loadingEvidence } = useQuery({
    queryKey: ['project-evidence', projectId],
    queryFn: () => api.get<Evidence[]>(`projects/${projectId}/evidence`),
    enabled: Boolean(projectId),
  });

  // 3. Fetch Assessments
  const { data: assessments, isLoading: loadingAssessments } = useQuery({
    queryKey: ['project-assessments', projectId],
    queryFn: () => api.get<Assessment[]>(`projects/${projectId}/assessments`),
    enabled: Boolean(projectId),
  });

  // 4. Fetch Credit Batches
  const { data: creditBatches, isLoading: loadingCredits } = useQuery({
    queryKey: ['project-credits', projectId],
    queryFn: () => api.get<CreditBatch[]>(`projects/${projectId}/credits`),
    enabled: Boolean(projectId),
  });

  // Mutation: Run Assessment
  const runAssessmentMutation = useMutation({
    mutationFn: () =>
      api.post<Assessment>(`projects/${projectId}/assessments`, {
        evidenceIds: (evidenceList ?? []).map((e) => e.id),
      }),
    onSuccess: (newAssessment) => {
      toast.success(
        `Assessment completed! Risk Score: ${newAssessment.riskScore}/100 (${newAssessment.riskLevel})`,
      );
      queryClient.invalidateQueries({ queryKey: ['project-assessments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setActiveTab('assessments');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Assessment execution failed');
    },
  });

  // Mutation: Upload Evidence
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('Please select a file to upload');
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle || uploadFile.name);
      formData.append('evidenceType', uploadType);
      formData.append('mediaType', uploadFile.type || 'application/octet-stream');
      return api.post<Evidence>(`projects/${projectId}/evidence`, formData);
    },
    onSuccess: (newEv) => {
      toast.success(`Evidence "${newEv.title}" uploaded. Hash recorded on-chain.`);
      queryClient.invalidateQueries({ queryKey: ['project-evidence', projectId] });
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadTitle('');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Evidence upload failed');
    },
  });

  // Mutation: Verify Integrity
  const verifyIntegrityMutation = useMutation({
    mutationFn: (evidenceId: string) =>
      api.post<{ status: 'MATCH' | 'MISMATCH' | 'UNAVAILABLE'; expectedHash: string }>(
        `evidence/${evidenceId}/verify-integrity`,
      ),
    onSuccess: (res) => {
      if (res.status === 'MATCH') {
        toast.success(`Hash integrity MATCH! Server bytes correspond to fingerprint.`);
      } else {
        toast.error(`Integrity check status: ${res.status}`);
      }
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Integrity verification failed');
    },
  });

  // Mutation: Create Credit Batch
  const createBatchMutation = useMutation({
    mutationFn: () =>
      api.post<CreditBatch>('credits/batches', {
        projectId,
        batchReference: batchRef,
        unit: batchUnit,
        totalQuantity: batchTotal,
      }),
    onSuccess: (b) => {
      toast.success(`Credit batch "${b.batchReference}" created (${b.totalQuantity} ${b.unit}).`);
      queryClient.invalidateQueries({ queryKey: ['project-credits', projectId] });
      setIsBatchOpen(false);
      setBatchRef('');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create credit batch');
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
        `Successfully issued credits! New balance: ${res.batch.issuedQuantity} ${res.batch.unit}`,
      );
      queryClient.invalidateQueries({ queryKey: ['project-credits', projectId] });
      setIsIssueOpen(false);
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
      toast.success(`Credits retired permanently. Total retired: ${res.batch.retiredQuantity}`);
      queryClient.invalidateQueries({ queryKey: ['project-credits', projectId] });
      setIsRetireOpen(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Retirement failed');
    },
  });

  // Mutation: Submit Review Decision
  const reviewMutation = useMutation({
    mutationFn: ({
      assessmentId,
      decision,
      rationale,
    }: {
      assessmentId: string;
      decision: ReviewDecision;
      rationale: string;
    }) =>
      api.post<Review>(`assessments/${assessmentId}/reviews`, { decision, rationale }),
    onSuccess: () => {
      toast.success('Review decision recorded.');
      queryClient.invalidateQueries({ queryKey: ['project-assessments', projectId] });
      setIsReviewOpen(false);
      setReviewRationale('');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to record review decision');
    },
  });

  if (loadingProject) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <Card className="p-12 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-status-error-text mx-auto" />
        <h3 className="text-sm font-semibold">Project Not Found</h3>
        <p className="text-xs text-fg-secondary">
          The requested project record does not exist or you do not have permission to inspect it.
        </p>
        <Link to="/projects">
          <Button variant="secondary" size="sm">
            Back to Project Explorer
          </Button>
        </Link>
      </Card>
    );
  }

  const statusCfg = getProjectStatusConfig(project.projectStatus);
  const latestAssessment = assessments?.[0];

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-fg">{project.name}</h2>
            <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
            {project.isSynthetic && (
              <Badge variant="outline" className="bg-status-info-bg/30 text-status-info-text border-status-info-border text-[10px]">
                Synthetic Demo
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted font-mono">
            <span>Slug: {project.slug}</span>
            <span>•</span>
            <span>Methodology: {project.methodology}</span>
            {project.countryOrRegion && (
              <>
                <span>•</span>
                <span>Region: {project.countryOrRegion}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsUploadOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Evidence</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            isLoading={runAssessmentMutation.isPending}
            onClick={() => runAssessmentMutation.mutate()}
          >
            <Play className="h-3.5 w-3.5" />
            <span>Run Rule Assessment</span>
          </Button>
        </div>
      </div>

      {/* Description / Summary Card */}
      {project.description && (
        <Card className="bg-surface-secondary/30 p-4">
          <p className="text-xs text-fg-secondary leading-relaxed">{project.description}</p>
        </Card>
      )}

      {/* Navigation Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
        tabs={[
          { id: 'evidence', label: 'Evidence Inventory', count: evidenceList?.length ?? 0 },
          { id: 'assessments', label: 'Assessments & Findings', count: assessments?.length ?? 0 },
          { id: 'credits', label: 'Credit Batches', count: creditBatches?.length ?? 0 },
        ]}
      />

      {/* Tab 1: Evidence Inventory */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-fg">Submitted Primary & Secondary Evidence</h3>
              <p className="text-xs text-fg-secondary">
                SHA-256 fingerprints are registered in local storage and mirrored to the local EVM registry.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              <span>Add Evidence</span>
            </Button>
          </div>

          <Card>
            {loadingEvidence ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !evidenceList || evidenceList.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <FileCheck2 className="h-8 w-8 text-fg-muted mx-auto" />
                <h4 className="text-sm font-semibold">No evidence uploaded yet</h4>
                <p className="text-xs text-fg-secondary max-w-sm mx-auto">
                  Upload satellite telemetry, carbon stock estimations, or third-party audit reports.
                </p>
                <Button variant="primary" size="sm" onClick={() => setIsUploadOpen(true)}>
                  Upload First Evidence
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title & Type</TableHead>
                    <TableHead>SHA-256 Fingerprint</TableHead>
                    <TableHead>Format & Size</TableHead>
                    <TableHead>Blockchain Status</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evidenceList.map((ev) => {
                    const bcConfig = getBlockchainStatusConfig(ev.blockchain?.status);
                    return (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <div className="font-semibold text-xs text-fg">{ev.title}</div>
                          <div className="text-[11px] text-fg-muted font-mono">{ev.evidenceType}</div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="font-mono text-xs text-fg-secondary bg-surface-secondary px-2 py-0.5 rounded border border-border"
                            title={ev.sha256}
                          >
                            {truncateHash(ev.sha256, 8, 6)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-fg-secondary">
                          {ev.mediaType} · {formatFileSize(ev.fileSize)}
                        </TableCell>
                        <TableCell>
                          <Badge className={bcConfig.className}>{bcConfig.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-fg-muted">
                          {formatDate(ev.createdAt)}
                        </TableCell>
                        <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            title="Verify stored bytes against SHA-256 fingerprint"
                            onClick={() => verifyIntegrityMutation.mutate(ev.id)}
                            isLoading={verifyIntegrityMutation.isPending}
                          >
                            <Fingerprint className="h-3.5 w-3.5" />
                            <span>Verify Hash</span>
                          </Button>
                          <a
                            href={`/api/v1/evidence/${ev.id}/download`}
                            download
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline px-2 py-1"
                          >
                            <Download className="h-3 w-3" />
                            <span>Download</span>
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Assessments & Findings */}
      {activeTab === 'assessments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-fg">Evaluation History & Rule Findings</h3>
              <p className="text-xs text-fg-secondary">
                Rule evaluations compute a deterministic risk score across all registered project evidence.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              isLoading={runAssessmentMutation.isPending}
              onClick={() => runAssessmentMutation.mutate()}
            >
              <Play className="h-3.5 w-3.5" />
              <span>Run Assessment Now</span>
            </Button>
          </div>

          {loadingAssessments ? (
            <Skeleton className="h-36 w-full" />
          ) : !latestAssessment ? (
            <Card className="p-12 text-center space-y-3">
              <BrainCircuit className="h-8 w-8 text-fg-muted mx-auto" />
              <h4 className="text-sm font-semibold">No assessments completed</h4>
              <p className="text-xs text-fg-secondary max-w-sm mx-auto">
                Trigger an automated verification check to analyze evidence against baseline methodology rules.
              </p>
              <Button
                variant="primary"
                size="sm"
                isLoading={runAssessmentMutation.isPending}
                onClick={() => runAssessmentMutation.mutate()}
              >
                Run Rule Assessment
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Scorecard Hero */}
              <Card className="p-5 border-border bg-surface">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-mono text-fg-muted uppercase">
                      Assessment ID: {latestAssessment.id.slice(0, 8)}…
                    </span>
                    <h4 className="text-base font-semibold text-fg">
                      Latest Evaluation: Ruleset {latestAssessment.ruleSetVersion}
                    </h4>
                    <p className="text-xs text-fg-secondary">
                      Evaluated {formatDate(latestAssessment.assessedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-fg-muted uppercase font-mono">Risk Score</div>
                      <div className="text-2xl font-bold font-mono text-fg">
                        {latestAssessment.riskScore}
                        <span className="text-sm text-fg-muted font-normal">/100</span>
                      </div>
                    </div>
                    <Badge
                      className={
                        getRiskLevelConfig(latestAssessment.riskLevel).className +
                        ' text-sm px-3 py-1 font-semibold'
                      }
                    >
                      {latestAssessment.riskLevel}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 text-[11px] text-fg-muted leading-relaxed">
                  <strong className="text-fg">Disclaimer:</strong> The risk score is an automated heuristic reflecting evidence consistency and document completeness checks. It does not constitute fraud certainty or official third-party carbon certification.
                </div>
              </Card>

              {/* Review Decision CTA for Reviewers/Admins */}
              {(role === 'REVIEWER' || role === 'ADMIN') && (
                <div className="rounded-lg border border-border bg-surface-secondary/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-semibold text-fg">Reviewer Decision Action</h5>
                    <p className="text-[11px] text-fg-secondary">
                      Record an authorized compliance audit decision for this assessment.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReviewOpen(true)}
                  >
                    Submit Decision
                  </Button>
                </div>
              )}

              {/* Findings Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-fg">
                  Findings ({latestAssessment.findings?.length ?? 0})
                </h4>

                {!latestAssessment.findings || latestAssessment.findings.length === 0 ? (
                  <Card className="p-8 text-center text-xs text-fg-muted">
                    <CheckCircle2 className="h-6 w-6 text-status-success-text mx-auto mb-2" />
                    <span>No rule violations or data inconsistencies detected in this run.</span>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {latestAssessment.findings.map((finding) => {
                      const sevCfg = getSeverityConfig(finding.severity);
                      return (
                        <Card key={finding.id} className="p-4 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge className={sevCfg.className}>{sevCfg.label}</Badge>
                              <span className="text-xs font-semibold text-fg">{finding.title}</span>
                            </div>
                            <span className="text-[10px] font-mono text-fg-muted">
                              Rule: {finding.ruleId} · Category: {finding.category}
                            </span>
                          </div>

                          <p className="text-xs text-fg-secondary leading-relaxed">
                            {finding.explanation}
                          </p>

                          <div className="rounded bg-surface-secondary/60 p-2.5 text-[11px] space-y-1">
                            <div>
                              <strong className="text-fg">Expected:</strong>{' '}
                              <span className="text-fg-secondary">{finding.expectedCondition}</span>
                            </div>
                            <div>
                              <strong className="text-fg">Recommendation:</strong>{' '}
                              <span className="text-fg-secondary">{finding.recommendation}</span>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Credit Batches */}
      {activeTab === 'credits' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-fg">Carbon Credit Ledger & Settlement</h3>
              <p className="text-xs text-fg-secondary">
                Credits are tracked as integer quantities with strictly non-negative available balances.
              </p>
            </div>
            {(role === 'CONTRIBUTOR' || role === 'ADMIN') && (
              <Button variant="primary" size="sm" onClick={() => setIsBatchOpen(true)}>
                <Coins className="h-3.5 w-3.5" />
                <span>Create Credit Batch</span>
              </Button>
            )}
          </div>

          <Card>
            {loadingCredits ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !creditBatches || creditBatches.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Coins className="h-8 w-8 text-fg-muted mx-auto" />
                <h4 className="text-sm font-semibold">No credit batches created</h4>
                <p className="text-xs text-fg-secondary max-w-sm mx-auto">
                  Create a credit batch to issue and retire verified carbon credits.
                </p>
                {(role === 'CONTRIBUTOR' || role === 'ADMIN') && (
                  <Button variant="primary" size="sm" onClick={() => setIsBatchOpen(true)}>
                    Create Credit Batch
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Ref</TableHead>
                    <TableHead>Total Pool</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Retired</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditBatches.map((batch) => {
                    const total = BigInt(batch.totalQuantity || '0');
                    const issued = BigInt(batch.issuedQuantity || '0');
                    const retired = BigInt(batch.retiredQuantity || '0');
                    const available = issued - retired;

                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-semibold text-xs">
                          {batch.batchReference}
                          {batch.isSynthetic && (
                            <span className="block text-[10px] text-fg-muted font-normal">
                              Synthetic demo batch
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {formatNumber(batch.totalQuantity)} {batch.unit}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-status-success-text">
                          {formatNumber(batch.issuedQuantity)}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-status-error-text">
                          {formatNumber(batch.retiredQuantity)}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-bold text-fg">
                          {formatNumber(available.toString())}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {batch.lifecycleStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                          {role === 'ADMIN' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setSelectedBatchId(batch.id);
                                  setIsIssueOpen(true);
                                }}
                              >
                                Issue
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setSelectedBatchId(batch.id);
                                  setIsRetireOpen(true);
                                }}
                              >
                                Retire
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
        </div>
      )}

      {/* Upload Evidence Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Verification Evidence"
        description="Select a document or structured report. SHA-256 will be calculated server-side upon receipt."
      >
        <div className="space-y-4">
          <Input
            label="Document Title"
            placeholder="e.g. Q3 2026 Soil Organic Carbon Laboratory Assays"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
          />

          <Select
            label="Evidence Category"
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value)}
          >
            <option value="field-audit">Field Audit & Telemetry</option>
            <option value="satellite">Satellite Remote Sensing</option>
            <option value="soil-sample">Soil Core Sampling Report</option>
            <option value="financial-registry">Financial Registry Reconciliation</option>
          </Select>

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-fg">Evidence File</label>
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-fg file:mr-4 file:rounded-md file:border-0 file:bg-surface-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-fg hover:file:bg-surface-hover"
            />
            <p className="text-[11px] text-fg-muted">
              Supported: PDF, JSON, CSV, PNG, JPEG. Max upload size: 25 MB.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              Upload & Fingerprint
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Batch Modal */}
      <Modal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        title="Create Credit Batch"
        description="Establish an authorized volume pool for issuance and permanent retirement."
      >
        <div className="space-y-4">
          <Input
            label="Batch Reference"
            placeholder="e.g. V-KEN-2026-B1"
            value={batchRef}
            onChange={(e) => setBatchRef(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Unit"
              value={batchUnit}
              onChange={(e) => setBatchUnit(e.target.value)}
              required
            />
            <Input
              label="Total Capacity Quantity"
              type="number"
              value={batchTotal}
              onChange={(e) => setBatchTotal(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsBatchOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={createBatchMutation.isPending}
              onClick={() => createBatchMutation.mutate()}
            >
              Create Pool
            </Button>
          </div>
        </div>
      </Modal>

      {/* Issue Modal */}
      <Modal
        isOpen={isIssueOpen}
        onClose={() => setIsIssueOpen(false)}
        title="Issue Credits"
        description="Issues verified credits into circulation from unissued pool supply."
      >
        <div className="space-y-4">
          <Input
            label="Quantity to Issue (Integer)"
            type="number"
            min="1"
            value={mutateQty}
            onChange={(e) => setMutateQty(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsIssueOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={issueMutation.isPending}
              onClick={() => {
                if (selectedBatchId) {
                  issueMutation.mutate({ batchId: selectedBatchId, quantity: mutateQty });
                }
              }}
            >
              Execute Issuance
            </Button>
          </div>
        </div>
      </Modal>

      {/* Retire Modal */}
      <Modal
        isOpen={isRetireOpen}
        onClose={() => setIsRetireOpen(false)}
        title="Permanently Retire Credits"
        description="Retiring credits burns them permanently. Quantity cannot exceed currently available balance."
      >
        <div className="space-y-4">
          <Input
            label="Quantity to Retire (Integer)"
            type="number"
            min="1"
            value={mutateQty}
            onChange={(e) => setMutateQty(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsRetireOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={retireMutation.isPending}
              onClick={() => {
                if (selectedBatchId) {
                  retireMutation.mutate({ batchId: selectedBatchId, quantity: mutateQty });
                }
              }}
            >
              Confirm Retirement
            </Button>
          </div>
        </div>
      </Modal>

      {/* Review Decision Modal */}
      <Modal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        title="Submit Reviewer Compliance Decision"
        description="Recorded decisions are permanently logged in the project audit history."
      >
        <div className="space-y-4">
          <Select
            label="Decision"
            value={reviewDecision}
            onChange={(e) => setReviewDecision(e.target.value as ReviewDecision)}
          >
            <option value="APPROVED_FOR_INTERNAL_REVIEW">Approve for Internal Review</option>
            <option value="NEEDS_MORE_EVIDENCE">Request Additional Evidence</option>
            <option value="REJECTED">Reject Project Compliance</option>
          </Select>

          <Textarea
            label="Review Rationale & Justification"
            placeholder="Explain methodology compliance findings and supporting evidence validation…"
            rows={3}
            value={reviewRationale}
            onChange={(e) => setReviewRationale(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsReviewOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={reviewMutation.isPending}
              onClick={() => {
                if (latestAssessment) {
                  reviewMutation.mutate({
                    assessmentId: latestAssessment.id,
                    decision: reviewDecision,
                    rationale: reviewRationale,
                  });
                }
              }}
            >
              Record Decision
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
