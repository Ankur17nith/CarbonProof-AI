import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Project, Evidence, PaginatedResponse } from '@/types/api';
import {
  formatDate,
  formatFileSize,
  truncateHash,
  getBlockchainStatusConfig,
} from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
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
  FileCheck2,
  Upload,
  Fingerprint,
  Download,
  Copy,
  Check,
  Search,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

export function EvidencePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Form states
  const [targetProjectId, setTargetProjectId] = useState<string>('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('field-audit');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // 1. Fetch Projects for filter and selector
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'dropdown'],
    queryFn: () => api.get<PaginatedResponse<Project>>('projects?pageSize=100'),
  });

  const projects = projectsData?.items ?? [];

  // 2. Fetch Evidence (we can fetch all project evidence or per project)
  // Since backend has GET /projects/:id/evidence, we fetch for selected project or aggregate
  const { data: allEvidence, isLoading, refetch } = useQuery({
    queryKey: ['evidence', selectedProjectId],
    queryFn: async () => {
      if (selectedProjectId !== 'ALL') {
        return api.get<Evidence[]>(`projects/${selectedProjectId}/evidence`);
      }
      // Aggregate across projects
      if (projects.length === 0) return [];
      const results = await Promise.all(
        projects.slice(0, 10).map(async (p) => {
          try {
            return await api.get<Evidence[]>(`projects/${p.id}/evidence`);
          } catch {
            return [];
          }
        }),
      );
      return results.flat();
    },
    enabled: Boolean(projectsData),
  });

  // Verify hash mutation
  const verifyIntegrityMutation = useMutation({
    mutationFn: (evidenceId: string) =>
      api.post<{ status: 'MATCH' | 'MISMATCH' | 'UNAVAILABLE'; expectedHash: string }>(
        `evidence/${evidenceId}/verify-integrity`,
      ),
    onSuccess: (res) => {
      if (res.status === 'MATCH') {
        toast.success('SHA-256 integrity verified: Stored bytes match fingerprint.');
      } else {
        toast.error(`Verification status: ${res.status}`);
      }
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!targetProjectId) throw new Error('Please select a target project');
      if (!uploadFile) throw new Error('Please select a file to upload');

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle || uploadFile.name);
      formData.append('evidenceType', uploadType);
      formData.append('mediaType', uploadFile.type || 'application/octet-stream');
      return api.post<Evidence>(`projects/${targetProjectId}/evidence`, formData);
    },
    onSuccess: (newEv) => {
      toast.success(`Evidence "${newEv.title}" submitted successfully.`);
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadTitle('');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to upload evidence');
    },
  });

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
    toast.info('Hash copied to clipboard');
  };

  const filteredEvidence = (allEvidence ?? []).filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sha256.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.evidenceType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Evidence Repository</h2>
          <p className="text-xs text-fg-secondary mt-1">
            Auditable sensor telemetry, remote sensing artifacts, and third-party laboratory assays.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            if (projects.length > 0) setTargetProjectId(projects[0].id);
            setIsUploadModalOpen(true);
          }}
        >
          <Upload className="h-4 w-4" />
          <span>Upload Evidence</span>
        </Button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fg-muted" />
          <input
            type="search"
            placeholder="Search by evidence title, SHA-256 hash, or category…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-4 text-xs shadow-subtle focus-ring placeholder:text-fg-muted text-fg"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-fg-muted" />
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-fg shadow-subtle focus-ring max-w-[200px] truncate"
            aria-label="Filter evidence by project"
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Evidence Table Card */}
      <Card>
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredEvidence.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileCheck2 className="h-8 w-8 text-fg-muted mx-auto" />
            <h4 className="text-sm font-semibold">No evidence documents found</h4>
            <p className="text-xs text-fg-secondary max-w-sm mx-auto">
              Select a project and upload evidence artifacts to build an audit trail.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>SHA-256 Content Fingerprint</TableHead>
                <TableHead>Size & Format</TableHead>
                <TableHead>Settlement Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvidence.map((ev) => {
                const bcConfig = getBlockchainStatusConfig(ev.blockchain?.status);
                const isCopied = copiedHash === ev.sha256;

                return (
                  <TableRow key={ev.id}>
                    <TableCell>
                      <div className="font-semibold text-xs text-fg">{ev.title}</div>
                      <Link
                        to={`/projects/${ev.projectId}`}
                        className="text-[11px] text-accent hover:underline"
                      >
                        Project details →
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono capitalize">
                        {ev.evidenceType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="bg-surface-secondary px-2 py-0.5 rounded border border-border text-fg-secondary">
                          {truncateHash(ev.sha256, 8, 6)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyHash(ev.sha256)}
                          className="rounded p-1 text-fg-muted hover:text-fg focus-ring"
                          title="Copy SHA-256"
                          aria-label="Copy SHA-256 hash"
                        >
                          {isCopied ? (
                            <Check className="h-3.5 w-3.5 text-status-success-text" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-fg-secondary">
                      {formatFileSize(ev.fileSize)} · {ev.mediaType}
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
                        onClick={() => verifyIntegrityMutation.mutate(ev.id)}
                        isLoading={verifyIntegrityMutation.isPending}
                        title="Run cryptographic integrity verification"
                      >
                        <Fingerprint className="h-3.5 w-3.5" />
                        <span>Verify</span>
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

      {/* Upload Evidence Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Verification Evidence"
        description="Select target project and upload file artifact. SHA-256 hash is calculated upon receipt."
      >
        <div className="space-y-4">
          <Select
            label="Target Project"
            value={targetProjectId}
            onChange={(e) => setTargetProjectId(e.target.value)}
            required
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.slug})
              </option>
            ))}
          </Select>

          <Input
            label="Document Title"
            placeholder="e.g. Q3 2026 Drone Canopy Cover Photogrammetry"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            required
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
            <label className="block text-xs font-medium text-fg">Document File</label>
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-fg file:mr-4 file:rounded-md file:border-0 file:bg-surface-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-fg hover:file:bg-surface-hover"
            />
            <p className="text-[11px] text-fg-muted">Max file size: 25 MB.</p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              Upload Artifact
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
