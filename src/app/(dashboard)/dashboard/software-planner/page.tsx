import Link from 'next/link';
import { ArrowLeft, FolderKanban, Sparkles } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listProjectsForWorkspace } from '@/lib/data/projects';
import { buttonStyles } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { SoftwarePlannerClient } from './SoftwarePlannerClient';

export default async function SoftwarePlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const projectsResult = workspaceResult.data
    ? await listProjectsForWorkspace(workspaceResult.data.id, supabase)
    : { data: [], error: workspaceResult.error ?? 'Workspace not found.', isConfigured: true };
  const selectedProjectId = query.project && projectsResult.data.some((project) => project.id === query.project)
    ? query.project
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="AI Software Project Planner"
        title="Software Planner"
        description="Turn a software idea into an architecture plan, MVP scope, route map, schema draft, testing checklist, deployment checklist, and pending task drafts."
        actions={
          <>
            <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <Link href="/dashboard/projects" className={buttonStyles({ variant: 'outline' })}>
              <FolderKanban className="h-4 w-4" />
              Projects
            </Link>
            <Link href="/dashboard/prompt-library" className={buttonStyles({ variant: 'outline' })}>
              <Sparkles className="h-4 w-4" />
              Prompt Library
            </Link>
          </>
        }
      />

      {projectsResult.error ? (
        <Notice tone="warning" title="Project context unavailable">
          {projectsResult.error}
        </Notice>
      ) : null}

      <Notice tone="info" title="Planning only">
        The planner does not generate repository files, push commits, create pull requests, deploy, publish provider content, or run task execution automatically.
      </Notice>

      <SoftwarePlannerClient projects={projectsResult.data} selectedProjectId={selectedProjectId} />
    </div>
  );
}
