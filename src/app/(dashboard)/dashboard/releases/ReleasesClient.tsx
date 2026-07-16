'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Clipboard, ExternalLink, FileText, Rocket, Search, ShieldAlert } from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Label, Select } from '@/components/ui/FormControls';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { StatCard } from '@/components/ui/StatCard';
import { usePagination } from '@/hooks/usePagination';
import { toast } from '@/components/ui/toast';
import { buildReleaseReport, formatReleaseType, getReleaseNextAction, releaseTypes } from '@/lib/data/releases';
import { formatDateTime } from '@/lib/utils';
import type { ProjectRecord, ReleaseRecord, ReleaseStatus, ReleaseType } from '@/types/database';
import { ReleaseStatusBadge, ReleaseTypeBadge } from './ReleaseBadge';
import { ReleaseForm } from './ReleaseForm';

interface ReleasesClientProps {
  releases: ReleaseRecord[];
  projects: ProjectRecord[];
}

const statuses: Array<'all' | ReleaseStatus> = ['all', 'draft', 'ready_for_test', 'testing', 'ready_to_deploy', 'deployed', 'failed', 'rolled_back', 'archived'];

export function ReleasesClient({ releases, projects }: ReleasesClientProps) {
  const [showForm, setShowForm] = useState(releases.length === 0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | ReleaseStatus>('all');
  const [type, setType] = useState<'all' | ReleaseType>('all');
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return releases.filter((release) => {
      const text = [release.title, release.version, release.phase_name, release.summary].filter(Boolean).join(' ').toLowerCase();
      return (!query || text.includes(query)) && (status === 'all' || release.status === status) && (type === 'all' || release.release_type === type);
    });
  }, [releases, search, status, type]);

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
  } = usePagination(filtered, 50);

  const copySummary = async (release: ReleaseRecord) => {
    await navigator.clipboard.writeText(buildReleaseReport(release, release.project_id ? projectNames.get(release.project_id) : null));
    toast.success('Release report copied.');
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Releases" value={releases.length} icon={Rocket} subtitle="Current workspace" />
        <StatCard title="Ready to Deploy" value={releases.filter((release) => release.status === 'ready_to_deploy').length} icon={ExternalLink} tone="accent" />
        <StatCard title="Deployed" value={releases.filter((release) => release.status === 'deployed').length} icon={Rocket} tone="dark" />
        <StatCard title="Failed" value={releases.filter((release) => release.status === 'failed').length} icon={ShieldAlert} tone="accent" />
        <StatCard title="With Known Issues" value={releases.filter((release) => Boolean(release.known_issues?.trim())).length} icon={FileText} tone="neutral" />
      </div>

      <Card className="border-[#F7CBCA]/14 bg-[#D5E5E5]/45">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#F7CBCA]">Release documentation</p>
            <p className="mt-2 text-sm leading-6 text-black/62">Do not paste API keys, tokens, or private credentials into release notes.</p>
          </div>
          <Button onClick={() => setShowForm((value) => !value)}>{showForm ? 'Hide Form' : 'New Release'}</Button>
        </div>
      </Card>

      {showForm && <ReleaseForm mode="create" projects={projects} onCancel={() => setShowForm(false)} />}

      <Card>
        <CardHeader title="Release Records" description="Search and filter release documentation from real workspace rows." action={<span className="text-sm font-bold text-black/56">{filtered.length === releases.length ? `${releases.length} release${releases.length === 1 ? '' : 's'}` : `Showing ${filtered.length} of ${releases.length}`}</span>} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="relative"><Label htmlFor="release-search">Search releases</Label><Search className="pointer-events-none absolute bottom-3 end-3.5 h-4 w-4 text-black/34" /><Input id="release-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, phase, version, summary" /></div>
          <div><Label htmlFor="status-filter">Status</Label><Select id="status-filter" value={status} onChange={(event) => setStatus(event.target.value as 'all' | ReleaseStatus)}>{statuses.map((item) => <option key={item} value={item}>{item === 'all' ? 'All Statuses' : item.replace(/_/g, ' ')}</option>)}</Select></div>
          <div><Label htmlFor="type-filter">Type</Label><Select id="type-filter" value={type} onChange={(event) => setType(event.target.value as 'all' | ReleaseType)}><option value="all">All Types</option>{releaseTypes.map((item) => <option key={item} value={item}>{formatReleaseType(item)}</option>)}</Select></div>
        </div>
      </Card>

      {releases.length === 0 ? (
        <EmptyState icon={Rocket} title="No releases yet" description="Create your first release record to track features, build results, deployment URLs, and rollback notes." action={<Button onClick={() => setShowForm(true)}>Create Release</Button>} />
      ) : (
        <div>
        <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {pageItems.map((release) => (
            <article key={release.id} className="card-lift rounded-lg border border-[#F7CBCA]/10 bg-white/90 p-5 shadow-[0_18px_42px_rgba(93,107,107,0.06)]">
              <h2 className="break-words text-lg font-black leading-snug text-[#5D6B6B]">{release.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2"><ReleaseStatusBadge status={release.status} /><ReleaseTypeBadge type={release.release_type} /></div>
              <p className="mt-3 text-sm font-bold text-black/52">{[release.version, release.phase_name, release.project_id ? projectNames.get(release.project_id) : null].filter(Boolean).join(' / ') || 'No version or phase'}</p>
              {release.summary && <p className="mt-4 line-clamp-3 text-sm leading-6 text-black/62">{release.summary}</p>}
              <div className="mt-4 grid gap-2 text-xs font-bold text-black/58">
                <span>Build: {release.build_status || 'Not added'}</span>
                <span>Lint: {release.lint_status || 'Not added'}</span>
                <span>Typecheck: {release.typecheck_status || 'Not added'}</span>
                <span>Deploy: {release.deploy_status || 'Not added'}</span>
              </div>
              <div className="mt-4 rounded-lg border border-[#E7F5DC]/24 bg-[#D5E5E5]/38 p-3 text-sm"><span className="font-black text-black">Next action: </span>{getReleaseNextAction(release)}</div>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-black/42">Updated {formatDateTime(release.updated_at)}</p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Link href={`/dashboard/releases/${release.id}`} className={buttonStyles({ size: 'sm' })}>Open</Link>
                <Link href={`/dashboard/releases/${release.id}#edit-release`} className={buttonStyles({ variant: 'outline', size: 'sm' })}>Edit</Link>
                <Button onClick={() => copySummary(release)} variant="outline" size="sm"><Clipboard className="h-4 w-4" />Copy Release Report</Button>
                {release.deploy_url && <a href={release.deploy_url} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Deploy URL</a>}
              </div>
            </article>
          ))}
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
