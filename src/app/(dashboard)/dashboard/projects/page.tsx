import Link from 'next/link';
import { ArrowLeft, BarChart3, CheckSquare, FolderKanban, Sparkles } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listProjectsForWorkspace } from '@/lib/data/projects';
import { buttonStyles } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProjectsClient } from './ProjectsClient';

export default async function ProjectsPage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const projectsResult = workspaceResult.data
    ? await listProjectsForWorkspace(workspaceResult.data.id, supabase, { limit: 200 })
    : { data: [], error: workspaceResult.error ?? 'Workspace not found.', isConfigured: true };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Project workspace"
        title="Projects"
        description="Organize your software projects, SaaS products, campaigns, tasks, releases, and next actions from one workspace."
        actions={
          <>
            <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <Link href="/dashboard/reports" className={buttonStyles({ variant: 'outline' })}>
              <BarChart3 className="h-4 w-4" />
              Open Reports
            </Link>
            <Link href="/dashboard/tasks" className={buttonStyles({ variant: 'outline' })}>
              <CheckSquare className="h-4 w-4" />
              Open Tasks
            </Link>
            <Link href="/dashboard/software-planner" className={buttonStyles({ variant: 'outline' })}>
              <Sparkles className="h-4 w-4" />
              Plan New Project
            </Link>
            <a href="#new-project" className={buttonStyles()}>
              <FolderKanban className="h-4 w-4" />
              New Project
            </a>
          </>
        }
      />

      {projectsResult.error && (
        <Notice tone="warning" title="Projects unavailable">
          {projectsResult.error}
        </Notice>
      )}

      <div id="new-project">
        <ProjectsClient projects={projectsResult.data} />
      </div>
    </div>
  );
}
