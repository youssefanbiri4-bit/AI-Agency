'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ExternalLink,
  FolderKanban,
  GitBranch,
  Plus,
  Search,
} from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Label, Select } from '@/components/ui/FormControls';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { StatCard } from '@/components/ui/StatCard';
import { usePagination } from '@/hooks/usePagination';
import { cn, formatDateTime } from '@/lib/utils';
import {
  formatProjectStatus,
  formatProjectType,
  getProjectHealth,
  normalizeProjectMetadata,
  projectTypes,
} from '@/lib/data/projects';
import type { ProjectRecord, ProjectStatus, ProjectType } from '@/types/database';
import { ProjectForm } from './ProjectForm';
import { ProjectPriorityBadge, ProjectStatusBadge, ProjectTypeBadge } from './ProjectBadge';

interface ProjectsClientProps {
  projects: ProjectRecord[];
}

const statusFilters: Array<{ value: 'all' | ProjectStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'planning', label: 'Planning' },
  { value: 'ready_to_deploy', label: 'Ready to Deploy' },
  { value: 'deployed', label: 'Deployed' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

function countStatus(projects: ProjectRecord[], statuses: ProjectStatus[]) {
  return projects.filter((project) => statuses.includes(project.status)).length;
}

export function ProjectsClient({ projects }: ProjectsClientProps) {
  const [showCreateForm, setShowCreateForm] = useState(projects.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ProjectType>('all');

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesType = typeFilter === 'all' || project.project_type === typeFilter;
      const matchesSearch =
        !normalizedSearch ||
        project.name.toLowerCase().includes(normalizedSearch) ||
        (project.description ?? '').toLowerCase().includes(normalizedSearch) ||
        (project.tech_stack ?? '').toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [projects, searchQuery, statusFilter, typeFilter]);

  const {
    pageItems,
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    nextPage,
    prevPage,
    goToPage,
  } = usePagination(filteredProjects, 50);

  const latestProject = projects[0] ?? null;
  const linkedGitHubProjects = projects.filter((project) => {
    const metadata = normalizeProjectMetadata(project.metadata);
    return Boolean(project.github_url || (metadata.github.owner && metadata.github.repo));
  }).length;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Projects" value={projects.length} icon={FolderKanban} subtitle="Current workspace" />
        <StatCard title="Active Projects" value={countStatus(projects, ['active'])} icon={ArrowRight} tone="brand" subtitle="In motion" />
        <StatCard title="Ready to Deploy" value={countStatus(projects, ['ready_to_deploy'])} icon={ExternalLink} tone="accent" subtitle="Awaiting release" />
        <StatCard title="Deployed" value={countStatus(projects, ['deployed'])} icon={GitBranch} tone="dark" subtitle="Live projects" />
        <StatCard title="Linked GitHub Repos" value={linkedGitHubProjects} icon={GitBranch} tone="accent" subtitle="Read-only tracking" />
      </div>

      <Card className="border-[#F7CBCA]/14 bg-[#D5E5E5]/45">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#F7CBCA]">Projects snapshot</p>
            <p className="mt-2 text-sm leading-6 text-black/62">
              {latestProject
                ? `Latest project: ${latestProject.name} / ${formatProjectStatus(latestProject.status)}`
                : 'Create your first project to start organizing delivery work.'}
            </p>
          </div>
          <Button onClick={() => setShowCreateForm((current) => !current)} variant={showCreateForm ? 'outline' : 'primary'}>
            <Plus className="h-4 w-4" />
            {showCreateForm ? 'Hide Form' : 'New Project'}
          </Button>
        </div>
      </Card>

      {showCreateForm && <ProjectForm mode="create" />}

      <Card>
        <CardHeader
          title="Project Workspace"
          description="Filter, search, and open project records from real workspace data."
          action={
              <span className="text-sm font-bold text-black/56">
                {filteredProjects.length === projects.length
                  ? `${projects.length} project${projects.length === 1 ? '' : 's'}`
                  : `Showing ${filteredProjects.length} of ${projects.length}`}
              </span>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_240px]">
          <div className="relative">
            <Label htmlFor="project-search">Search projects</Label>
            <Search className="pointer-events-none absolute bottom-3 end-3.5 h-4 w-4 text-black/34" />
            <Input
              id="project-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, description, or stack"
            />
          </div>

          <div>
            <Label htmlFor="project-status-filter">Status</Label>
            <Select
              id="project-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | ProjectStatus)}
            >
              {statusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="project-type-filter">Type</Label>
            <Select
              id="project-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as 'all' | ProjectType)}
            >
              <option value="all">All Types</option>
              {projectTypes
                .filter((type) =>
                  ['software', 'SaaS', 'website', 'automation', 'marketing_campaign', 'AI_tool'].includes(type)
                )
                .map((type) => (
                  <option key={type} value={type}>
                    {formatProjectType(type)}
                  </option>
                ))}
            </Select>
          </div>
        </div>
      </Card>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project workspace to organize tasks, releases, notes, and development progress."
          action={
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          }
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No projects match"
          description="Clear the search or adjust filters to see more project records."
        />
      ) : (
        <div>
          <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {pageItems.map((project) => {
            const health = getProjectHealth(project);
            const metadata = normalizeProjectMetadata(project.metadata);
            const githubLabel =
              metadata.github.owner && metadata.github.repo
                ? `${metadata.github.owner}/${metadata.github.repo}`
                : null;

            return (
              <article
                key={project.id}
                className="card-lift rounded-lg border border-[#F7CBCA]/10 bg-white/90 p-5 shadow-[0_18px_42px_rgba(93,107,107,0.06)]"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-black leading-snug text-[#5D6B6B]">
                      {project.name}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ProjectTypeBadge type={project.project_type} />
                      <ProjectStatusBadge status={project.status} />
                      <ProjectPriorityBadge priority={project.priority} />
                    </div>
                  </div>
                </div>

                {project.description && (
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-black/62">{project.description}</p>
                )}

                <div className="mt-4 grid gap-3 text-sm">
                  <InfoLine label="Tech stack" value={project.tech_stack} />
                  <InfoLine label="GitHub repo" value={githubLabel} />
                  <InfoLine label="Updated" value={formatDateTime(project.updated_at)} />
                  <InfoLine label="Created" value={formatDateTime(project.created_at)} />
                </div>

                <div className="mt-4 rounded-lg border border-[#E7F5DC]/24 bg-[#D5E5E5]/38 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.1em] text-[#8A4300]">Health / next action</p>
                  <p className="mt-1 text-sm font-bold text-black">{health.label}</p>
                  <p className="mt-1 text-sm leading-6 text-black/58">{health.detail}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {project.github_url && (
                    <a href={project.github_url} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
                      <GitBranch className="h-4 w-4" />
                      GitHub
                    </a>
                  )}
                  {project.production_url && (
                    <a href={project.production_url} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
                      <ExternalLink className="h-4 w-4" />
                      Production
                    </a>
                  )}
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Link href={`/dashboard/projects/${project.id}`} className={buttonStyles({ variant: 'primary', size: 'sm', className: 'w-full' })}>
                    Open
                  </Link>
                  <Link href={`/dashboard/projects/${project.id}#edit-project`} className={buttonStyles({ variant: 'outline', size: 'sm', className: 'w-full' })}>
                    Edit
                  </Link>
                  <Link href={`/dashboard/create-task?project=${project.id}&title=${encodeURIComponent(`Project task: ${project.name}`)}&description=${encodeURIComponent(`Project: ${project.name}\n\nContext:\n${project.description ?? 'Add project context and desired outcome.'}`)}`} className={buttonStyles({ variant: 'outline', size: 'sm', className: 'w-full' })}>
                    Add Task
                  </Link>
                  <Link href={`/dashboard/projects/${project.id}#project-notes`} className={buttonStyles({ variant: 'outline', size: 'sm', className: 'w-full' })}>
                    View Notes
                  </Link>
                </div>
              </article>
            );
          })}
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPrev={prevPage}
            onNext={nextPage}
            onGoToPage={goToPage}
          />
        </div>
      )}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={cn('flex min-w-0 items-start justify-between gap-3 rounded-lg border border-black/7 bg-[#F1F7F7]/60 px-3 py-2', !value && 'text-black/42')}>
      <span className="shrink-0 text-xs font-black uppercase tracking-[0.1em] text-black/42">{label}</span>
      <span className="min-w-0 break-words text-right font-semibold text-black/66">{value || 'Not added'}</span>
    </div>
  );
}
