import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import type { Project, ProjectStatus, PaginatedResponse } from '@/types/api';
import { formatDate, getProjectStatusConfig } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Search, FolderTree, ExternalLink, ShieldCheck, Filter } from 'lucide-react';
import { toast } from 'sonner';

const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .max(120),
  description: z.string().max(5000).optional(),
  projectType: z.string().trim().min(1, 'Project type is required').max(120),
  methodology: z.string().trim().min(1, 'Methodology is required').max(200),
  countryOrRegion: z.string().max(120).optional(),
  registryName: z.string().max(160).optional(),
  externalProjectId: z.string().max(200).optional(),
  externalProjectUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  isSynthetic: z.boolean().default(false),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['projects', searchTerm, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '50', sort: 'createdAt' });
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      return api.get<PaginatedResponse<Project>>(`projects?${params.toString()}`);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      projectType: 'AFFORESTATION_REFORESTATION',
      methodology: 'VM0007 / Verified Carbon Standard',
      countryOrRegion: '',
      registryName: 'Verra / VCS',
      externalProjectId: '',
      externalProjectUrl: '',
      isSynthetic: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: ProjectFormData) =>
      api.post<Project>('projects', {
        ...values,
        externalProjectUrl: values.externalProjectUrl || undefined,
      }),
    onSuccess: (newProject) => {
      toast.success(`Project "${newProject.name}" registered successfully.`);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreateModalOpen(false);
      reset();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to register project';
      toast.error(msg);
    },
  });

  const onSubmit = (formData: ProjectFormData) => {
    createMutation.mutate(formData);
  };

  const projects = data?.items ?? [];

  return (
    <div className="space-y-6 text-left">
      {/* Header and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Project Explorer</h2>
          <p className="text-xs text-fg-secondary mt-1">
            Registered carbon mitigation initiatives and associated verification lifecycles.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4" />
          <span>Register Project</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fg-muted" />
          <input
            type="search"
            placeholder="Search by project name, slug, or registry ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-4 text-xs shadow-subtle focus-ring placeholder:text-fg-muted text-fg"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-fg-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-fg shadow-subtle focus-ring"
            aria-label="Filter by project status"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="VERIFIED_INTERNAL">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Projects Table */}
      <Card>
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-xs text-status-error-text font-medium">
              {error instanceof Error ? error.message : 'Failed to load projects'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FolderTree className="h-8 w-8 text-fg-muted mx-auto" />
            <h3 className="text-sm font-semibold text-fg">No projects found</h3>
            <p className="text-xs text-fg-secondary max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL'
                ? 'No projects match your search criteria. Try clearing filters.'
                : 'Get started by registering your first environmental mitigation initiative.'}
            </p>
            {(!searchTerm && statusFilter === 'ALL') && (
              <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4" />
                <span>Register Project</span>
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name & Slug</TableHead>
                <TableHead>Type & Methodology</TableHead>
                <TableHead>Registry Ref</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const statusCfg = getProjectStatusConfig(project.projectStatus);
                return (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/projects/${project.id}`}
                        className="text-fg font-semibold hover:text-accent hover:underline flex items-center gap-1.5"
                      >
                        <span>{project.name}</span>
                      </Link>
                      <span className="block text-[11px] text-fg-muted font-mono mt-0.5">
                        {project.slug}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-fg">{project.projectType.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] text-fg-muted truncate max-w-[200px]">
                        {project.methodology}
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.externalProjectId ? (
                        <div className="text-xs font-mono text-fg-secondary">
                          {project.registryName ? `${project.registryName}: ` : ''}
                          {project.externalProjectId}
                        </div>
                      ) : (
                        <span className="text-xs text-fg-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {project.isSynthetic ? (
                        <Badge variant="outline" className="text-[10px] bg-status-info-bg/40 text-status-info-text border-status-info-border">
                          Synthetic Demo
                        </Badge>
                      ) : (
                        <span className="text-xs text-fg-secondary">Production</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-fg-muted">
                      {formatDate(project.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/projects/${project.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs">
                          Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Register Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Carbon Mitigation Project"
        description="Enter methodology details and registry identifiers to initiate compliance auditing."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Project Name"
            placeholder="e.g. Kasigau Corridor REDD+ Phase II"
            required
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="Unique Slug (URL Identifier)"
            placeholder="e.g. kasigau-corridor-redd-phase-2"
            required
            hint="Lowercase letters, numbers, and hyphens only"
            error={errors.slug?.message}
            {...register('slug')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Project Type"
              placeholder="e.g. REFORESTATION"
              required
              error={errors.projectType?.message}
              {...register('projectType')}
            />
            <Input
              label="Methodology"
              placeholder="e.g. VM0007 / VCS"
              required
              error={errors.methodology?.message}
              {...register('methodology')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Country / Region"
              placeholder="e.g. Kenya"
              error={errors.countryOrRegion?.message}
              {...register('countryOrRegion')}
            />
            <Input
              label="Registry Name"
              placeholder="e.g. Verra / Gold Standard"
              error={errors.registryName?.message}
              {...register('registryName')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="External Registry ID"
              placeholder="e.g. VCS-841"
              error={errors.externalProjectId?.message}
              {...register('externalProjectId')}
            />
            <Input
              label="External Registry URL"
              type="url"
              placeholder="https://registry.verra.org/..."
              error={errors.externalProjectUrl?.message}
              {...register('externalProjectUrl')}
            />
          </div>

          <Textarea
            label="Project Description"
            placeholder="Describe geographical boundaries, baseline estimation, and verification scope…"
            rows={2}
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isSynthetic"
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              {...register('isSynthetic')}
            />
            <label htmlFor="isSynthetic" className="text-xs text-fg-secondary">
              Mark as synthetic demonstration data
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
