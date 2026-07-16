import Link from 'next/link';
import { ArrowLeft, BarChart3, FileText, FolderKanban, Rocket, ShieldCheck } from 'lucide-react';
import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listProjectsForWorkspace } from '@/lib/data/projects';
import { listReleasesForWorkspace } from '@/lib/data/releases';
import { buttonStyles } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReleasesClient } from './ReleasesClient';

export default async function ReleasesPage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const [releasesResult, projectsResult] = workspaceResult.data
    ? await Promise.all([
        listReleasesForWorkspace(workspaceResult.data.id, supabase, { limit: 200 }),
        listProjectsForWorkspace(workspaceResult.data.id, supabase, { limit: 200 }),
      ])
    : [
        { data: [], error: workspaceResult.error ?? 'Workspace not found.', isConfigured: true },
        { data: [], error: null, isConfigured: true },
      ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Release operations"
        title="Releases"
        description="Track phases, deployments, build results, testing checklists, and rollback notes for AgentFlow AI."
        actions={
          <>
            <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}><ArrowLeft className="h-4 w-4" />Dashboard</Link>
            <Link href="/dashboard/projects" className={buttonStyles({ variant: 'outline' })}><FolderKanban className="h-4 w-4" />Open Projects</Link>
            <Link href="/dashboard/reports" className={buttonStyles({ variant: 'outline' })}><BarChart3 className="h-4 w-4" />Open Reports</Link>
            <Link href="/dashboard/alex?template=release-notes-agent" className={buttonStyles({ variant: 'outline' })}><FileText className="h-4 w-4" />Release Notes Agent</Link>
            <Link href="/dashboard/alex?template=deployment-review-agent" className={buttonStyles({ variant: 'outline' })}><ShieldCheck className="h-4 w-4" />Deployment Review Agent</Link>
            <a href="#new-release" className={buttonStyles()}><Rocket className="h-4 w-4" />New Release</a>
          </>
        }
      />
      {(releasesResult.error || projectsResult.error) && <Notice tone="warning" title="Release data notice">{releasesResult.error ?? projectsResult.error}</Notice>}
      <div id="new-release"><ReleasesClient releases={releasesResult.data} projects={projectsResult.data} /></div>
    </div>
  );
}
