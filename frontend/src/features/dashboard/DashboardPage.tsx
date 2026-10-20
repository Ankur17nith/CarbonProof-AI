import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type {
  Project,
  Assessment,
  CreditBatch,
  AuditEvent,
  PaginatedResponse,
} from '@/types/api';
import { formatNumber, formatDate, getRiskLevelConfig, getSeverityConfig } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderTree,
  FileCheck2,
  BrainCircuit,
  Coins,
  History,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export function DashboardPage() {
  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects', 'summary'],
    queryFn: () => api.get<PaginatedResponse<Project>>('projects?pageSize=100'),
  });

  const { data: assessments, isLoading: loadingAssessments } = useQuery({
    queryKey: ['assessments', 'recent'],
    queryFn: () => api.get<Assessment[]>('assessments'),
  });

  const { data: creditBatches, isLoading: loadingCredits } = useQuery({
    queryKey: ['credits', 'summary'],
    queryFn: () => api.get<CreditBatch[]>('credits/batches'),
  });

  const { data: auditData, isLoading: loadingAudit } = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => api.get<PaginatedResponse<AuditEvent>>('audit?pageSize=5'),
  });

  const projects = projectsData?.items ?? [];
  const totalProjects = projectsData?.total ?? 0;
  const underReviewCount = projects.filter((p) => p.projectStatus === 'UNDER_REVIEW').length;
  const verifiedCount = projects.filter((p) => p.projectStatus === 'VERIFIED_INTERNAL').length;

  // Aggregate credit numbers
  const totalCreditsIssued = (creditBatches ?? []).reduce(
    (acc, b) => acc + BigInt(b.issuedQuantity || '0'),
    0n,
  );
  const totalCreditsRetired = (creditBatches ?? []).reduce(
    (acc, b) => acc + BigInt(b.retiredQuantity || '0'),
    0n,
  );

  return (
    <div className="space-y-6 text-left">
      {/* Top Welcome / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Verification State Overview</h2>
          <p className="text-xs text-fg-secondary mt-1">
            Real-time compliance heuristics, evidence integrity, and dual-layer blockchain settlement.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/projects">
            <Button variant="outline" size="sm">
              <FolderTree className="h-3.5 w-3.5" />
              <span>Explore Projects</span>
            </Button>
          </Link>
          <Link to="/evidence">
            <Button variant="primary" size="sm">
              <FileCheck2 className="h-3.5 w-3.5" />
              <span>Submit Evidence</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Synthetic Demo Banner Disclosure */}
      <div className="rounded-lg border border-accent/30 bg-accent-soft/40 p-3.5 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-xs">
          <span className="font-semibold text-fg">IEEE ClimateChain Verified Prototype</span>
          <p className="text-fg-secondary leading-relaxed">
            All rule evaluations, SHA-256 fingerprint verifications, and on-chain credit operations run against live backend models and local EVM contracts. Seeded demo records are explicitly labeled as synthetic.
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-fg-secondary">Total Projects</CardTitle>
            <FolderTree className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            {loadingProjects ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold tracking-tight">{formatNumber(totalProjects)}</div>
                <p className="text-[11px] text-fg-muted">
                  <span className="text-status-success-text font-medium">{verifiedCount} verified</span> · {underReviewCount} in review
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Assessments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-fg-secondary">Evaluations Run</CardTitle>
            <BrainCircuit className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            {loadingAssessments ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold tracking-tight">
                  {formatNumber(assessments?.length ?? 0)}
                </div>
                <p className="text-[11px] text-fg-muted">
                  Deterministic rule engine v1.0
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Issued Credits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-fg-secondary">Issued Supply</CardTitle>
            <Coins className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            {loadingCredits ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold tracking-tight">
                  {formatNumber(totalCreditsIssued.toString())}{' '}
                  <span className="text-xs font-normal text-fg-muted">tCO2e</span>
                </div>
                <p className="text-[11px] text-fg-muted">
                  Across {creditBatches?.length ?? 0} registered batches
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Retired Credits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-fg-secondary">Retired Permanently</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            {loadingCredits ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold tracking-tight">
                  {formatNumber(totalCreditsRetired.toString())}{' '}
                  <span className="text-xs font-normal text-fg-muted">tCO2e</span>
                </div>
                <p className="text-[11px] text-fg-muted">
                  Final environmental retirement
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid: Recent Assessments & Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Assessments */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Assessments</CardTitle>
              <CardDescription>
                AI & deterministic rule checks evaluating evidence consistency.
              </CardDescription>
            </div>
            <Link to="/assessments" className="text-xs text-accent hover:underline flex items-center gap-1 font-medium">
              <span>View all</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loadingAssessments ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : assessments && assessments.length > 0 ? (
              <div className="divide-y divide-border/60">
                {assessments.slice(0, 5).map((assessment) => {
                  const riskCfg = getRiskLevelConfig(assessment.riskLevel);
                  return (
                    <div
                      key={assessment.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/projects/${assessment.projectId}`}
                            className="text-xs font-semibold hover:text-accent hover:underline text-fg"
                          >
                            Project ID: {assessment.projectId.slice(0, 8)}…
                          </Link>
                          <Badge className={riskCfg.className}>
                            {riskCfg.label} ({assessment.riskScore}/100)
                          </Badge>
                        </div>
                        <p className="text-[11px] text-fg-secondary">
                          Ruleset: {assessment.ruleSetVersion} · Evaluated {formatDate(assessment.assessedAt)}
                        </p>
                      </div>

                      <Link to={`/projects/${assessment.projectId}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          Review Findings
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-fg-muted">
                No assessments executed yet. Select a project and run verification.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right 1 Col: Audit Activity Log */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Audit Stream</CardTitle>
              <CardDescription>Immutable administrative ledger.</CardDescription>
            </div>
            <History className="h-4 w-4 text-fg-muted" />
          </CardHeader>
          <CardContent>
            {loadingAudit ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : auditData && auditData.items.length > 0 ? (
              <div className="space-y-3">
                {auditData.items.map((event) => (
                  <div key={event.id} className="text-xs space-y-0.5 border-l-2 border-accent/40 pl-3 py-0.5">
                    <div className="font-medium text-fg truncate">
                      {event.action.replace(/_/g, ' ')}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-fg-muted">
                      <span>{event.entityType}</span>
                      <span>•</span>
                      <span>{formatDate(event.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-fg-muted">
                No audit events logged.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
