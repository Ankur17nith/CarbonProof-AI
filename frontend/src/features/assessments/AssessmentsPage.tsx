import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Assessment, AssessmentFinding } from '@/types/api';
import {
  formatDate,
  getRiskLevelConfig,
  getSeverityConfig,
} from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BrainCircuit,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export function AssessmentsPage() {
  const [expandedAssessmentId, setExpandedAssessmentId] = useState<string | null>(null);

  const { data: assessments, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['assessments', 'all'],
    queryFn: () => api.get<Assessment[]>('assessments'),
  });

  const toggleExpand = (id: string) => {
    setExpandedAssessmentId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">
            Assessment & Heuristic Verification
          </h2>
          <p className="text-xs text-fg-secondary mt-1">
            Deterministic rule evaluations and AI explanations analyzing project evidence consistency.
          </p>
        </div>
      </div>

      {/* Disclaimers Card */}
      <div className="rounded-lg border border-border bg-surface-secondary/40 p-4 space-y-1 text-xs">
        <div className="flex items-center gap-2 font-semibold text-fg">
          <Info className="h-4 w-4 text-accent" />
          <span>Explainability & Compliance Notice</span>
        </div>
        <p className="text-fg-secondary leading-relaxed">
          The CarbonProof AI verification engine evaluates submitted telemetry against deterministic rulesets (e.g. soil core density limits, canopy mortality bounds, and temporal reporting consistency). Scores indicate document completeness and boundary adherence.
        </p>
      </div>

      {/* Assessments List */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : isError ? (
        <Card className="p-8 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-status-error-text mx-auto" />
          <p className="text-xs text-status-error-text font-medium">
            {error instanceof Error ? error.message : 'Failed to load assessments'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      ) : !assessments || assessments.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <BrainCircuit className="h-8 w-8 text-fg-muted mx-auto" />
          <h3 className="text-sm font-semibold">No assessments completed</h3>
          <p className="text-xs text-fg-secondary max-w-sm mx-auto">
            Navigate to a project and trigger an automated assessment to inspect rule evaluations.
          </p>
          <Link to="/projects">
            <Button variant="primary" size="sm">
              Explore Projects
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {assessments.map((assessment) => {
            const isExpanded = expandedAssessmentId === assessment.id;
            const riskCfg = getRiskLevelConfig(assessment.riskLevel);
            const findingsCount = assessment.findings?.length ?? 0;

            return (
              <Card key={assessment.id} className="overflow-hidden transition-all border-border">
                <div
                  onClick={() => toggleExpand(assessment.id)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-surface-secondary/40 transition-colors"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(assessment.id);
                    }
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-fg">
                        Project ID: {assessment.projectId.slice(0, 10)}…
                      </span>
                      <Badge className={riskCfg.className}>
                        {riskCfg.label} ({assessment.riskScore}/100)
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Ruleset: {assessment.ruleSetVersion}
                      </Badge>
                    </div>
                    <p className="text-xs text-fg-secondary">
                      Evaluated on {formatDate(assessment.assessedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-semibold text-fg">
                        {findingsCount} {findingsCount === 1 ? 'Finding' : 'Findings'}
                      </span>
                      <span className="block text-[11px] text-fg-muted">
                        Status: {assessment.assessmentStatus.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="text-fg-muted p-1">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Findings Section */}
                {isExpanded && (
                  <div className="border-t border-border/80 bg-surface-secondary/20 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-fg">
                        Rule Evaluation Findings
                      </h4>
                      <Link
                        to={`/projects/${assessment.projectId}`}
                        className="text-xs text-accent hover:underline flex items-center gap-1"
                      >
                        <span>Open project workspace</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>

                    {!assessment.findings || assessment.findings.length === 0 ? (
                      <div className="rounded-md border border-border bg-surface p-4 text-center text-xs text-fg-muted">
                        <CheckCircle2 className="h-5 w-5 text-status-success-text mx-auto mb-1.5" />
                        <span>All baseline rule assertions passed without flagged inconsistencies.</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {assessment.findings.map((finding) => {
                          const sevCfg = getSeverityConfig(finding.severity);
                          return (
                            <div
                              key={finding.id}
                              className="rounded-md border border-border bg-surface p-4 space-y-2 text-xs"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge className={sevCfg.className}>{sevCfg.label}</Badge>
                                  <span className="font-semibold text-fg">{finding.title}</span>
                                </div>
                                <span className="text-[10px] font-mono text-fg-muted">
                                  Rule ID: {finding.ruleId} · Category: {finding.category}
                                </span>
                              </div>

                              <p className="text-xs text-fg-secondary leading-relaxed">
                                {finding.explanation}
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px]">
                                <div className="rounded bg-surface-secondary/50 p-2 border border-border/60">
                                  <span className="font-semibold text-fg">Expected Condition:</span>
                                  <p className="text-fg-secondary mt-0.5">{finding.expectedCondition}</p>
                                </div>
                                <div className="rounded bg-surface-secondary/50 p-2 border border-border/60">
                                  <span className="font-semibold text-fg">Recommendation:</span>
                                  <p className="text-fg-secondary mt-0.5">{finding.recommendation}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
