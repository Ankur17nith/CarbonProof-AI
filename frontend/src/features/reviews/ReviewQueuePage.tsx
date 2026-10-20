import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Assessment, Review, ReviewDecision, Project, PaginatedResponse } from '@/types/api';
import {
  formatDate,
  getRiskLevelConfig,
} from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
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
  ClipboardList,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

export function ReviewQueuePage() {
  const queryClient = useQueryClient();
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decision, setDecision] = useState<ReviewDecision>('APPROVED_FOR_INTERNAL_REVIEW');
  const [rationale, setRationale] = useState('');

  // 1. Fetch assessments
  const { data: assessments, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['assessments', 'queue'],
    queryFn: () => api.get<Assessment[]>('assessments'),
  });

  // 2. Fetch projects for reference
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'queue-names'],
    queryFn: () => api.get<PaginatedResponse<Project>>('projects?pageSize=100'),
  });

  const projectMap = new Map((projectsData?.items ?? []).map((p) => [p.id, p]));

  // Mutation: Submit Review
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
      toast.success('Compliance audit decision successfully recorded.');
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      setIsDecisionModalOpen(false);
      setRationale('');
      setSelectedAssessment(null);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to record decision');
    },
  });

  const handleOpenDecision = (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    setDecision('APPROVED_FOR_INTERNAL_REVIEW');
    setRationale('');
    setIsDecisionModalOpen(true);
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Reviewer Decision Queue</h2>
          <p className="text-xs text-fg-secondary mt-1">
            Authoritative compliance review queue for environmental verification assessments.
          </p>
        </div>
      </div>

      {/* Reviewer Guidelines Notice */}
      <div className="rounded-lg border border-border bg-surface-secondary/40 p-4 text-xs space-y-1">
        <span className="font-semibold text-fg">Reviewer Separation of Duties</span>
        <p className="text-fg-secondary leading-relaxed">
          Decisions recorded here update the project compliance state and are permanently audited. Reviewers cannot approve projects they authored.
        </p>
      </div>

      {/* Queue Table */}
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
              {error instanceof Error ? error.message : 'Failed to load review queue'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : !assessments || assessments.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ClipboardList className="h-8 w-8 text-fg-muted mx-auto" />
            <h4 className="text-sm font-semibold">Queue is clear</h4>
            <p className="text-xs text-fg-secondary max-w-sm mx-auto">
              There are no pending assessments awaiting reviewer review.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Assessment ID</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Rule Violations</TableHead>
                <TableHead>Evaluated Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.map((a) => {
                const project = projectMap.get(a.projectId);
                const riskCfg = getRiskLevelConfig(a.riskLevel);
                const findingsCount = a.findings?.length ?? 0;

                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-semibold text-xs text-fg">
                        {project ? project.name : `Project ${a.projectId.slice(0, 8)}…`}
                      </div>
                      <span className="text-[11px] text-fg-muted font-mono">
                        {project?.slug ?? a.projectId}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-fg-secondary">
                      {a.id.slice(0, 10)}…
                    </TableCell>
                    <TableCell>
                      <Badge className={riskCfg.className}>
                        {riskCfg.label} ({a.riskScore}/100)
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {findingsCount > 0 ? (
                        <span className="text-status-warning-text font-medium">
                          {findingsCount} rule findings
                        </span>
                      ) : (
                        <span className="text-status-success-text font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Clear</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-fg-muted">
                      {formatDate(a.assessedAt)}
                    </TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      <Link to={`/projects/${a.projectId}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          Inspect
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleOpenDecision(a)}
                      >
                        Submit Decision
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Decision Modal */}
      <Modal
        isOpen={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        title="Record Compliance Review Decision"
        description={
          selectedAssessment
            ? `Recording formal decision for assessment ${selectedAssessment.id.slice(0, 8)}…`
            : 'Record compliance decision'
        }
      >
        <div className="space-y-4">
          <Select
            label="Formal Decision"
            value={decision}
            onChange={(e) => setDecision(e.target.value as ReviewDecision)}
            required
          >
            <option value="APPROVED_FOR_INTERNAL_REVIEW">
              Approve for Internal Review (Compliant)
            </option>
            <option value="NEEDS_MORE_EVIDENCE">
              Request Additional Evidence (Inconclusive)
            </option>
            <option value="REJECTED">Reject Project Compliance (Violations Detected)</option>
          </Select>

          <Textarea
            label="Auditor Rationale & Evidence Analysis"
            placeholder="Document verification findings, observed telemetry bounds, and justification for this decision…"
            rows={4}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDecisionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={reviewMutation.isPending}
              onClick={() => {
                if (selectedAssessment) {
                  reviewMutation.mutate({
                    assessmentId: selectedAssessment.id,
                    decision,
                    rationale,
                  });
                }
              }}
            >
              Commit Decision
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
