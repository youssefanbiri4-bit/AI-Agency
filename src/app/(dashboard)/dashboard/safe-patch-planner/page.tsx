import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  Code2,
  FolderKanban,
  SearchCode,
  Sparkles,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listProjectsForWorkspace } from '@/lib/data/projects';
import { listSafePatchPlansForWorkspace } from '@/lib/data/safe-patch-plans';
import { buttonStyles } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { SafePatchPlannerClient } from './SafePatchPlannerClient';

export default async function SafePatchPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; finding?: string; context?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const projectsResult = workspaceResult.data
    ? await listProjectsForWorkspace(workspaceResult.data.id, supabase)
    : { data: [], error: workspaceResult.error ?? 'Workspace not found.', isConfigured: true };
  const selectedProjectId =
    query.project && projectsResult.data.some((project) => project.id === query.project)
      ? query.project
      : null;
  const plansResult = workspaceResult.data
    ? await listSafePatchPlansForWorkspace(workspaceResult.data.id, supabase, null, 40)
    : { data: [], error: workspaceResult.error ?? 'Workspace not found.', isConfigured: true };
  const initialContext = [query.finding, query.context]
    .filter((value): value is string => Boolean(value))
    .join('\n')
    .slice(0, 4000);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Planning only"
        title="Safe Patch Planner"
        description="Plan code changes safely before implementation. Review affected files, risks, tests, and rollback steps before sending prompts to Codex."
        actions={
          <>
            <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <Link href="/dashboard/projects" className={buttonStyles({ variant: 'outline' })}>
              <FolderKanban className="h-4 w-4" />
              Open Projects
            </Link>
            <Link href="/dashboard/projects#codebase-analyzer" className={buttonStyles({ variant: 'outline' })}>
              <SearchCode className="h-4 w-4" />
              Open Codebase Analyzer
            </Link>
            <Link href="/dashboard/alex?template=bug-diagnosis-agent" className={buttonStyles({ variant: 'outline' })}>
              <Bot className="h-4 w-4" />
              Bug Diagnosis Agent
            </Link>
            <Link href="/dashboard/alex?template=patch-planner-agent" className={buttonStyles({ variant: 'outline' })}>
              <Code2 className="h-4 w-4" />
              Patch Planner Agent
            </Link>
            <Link href="/dashboard/prompt-library" className={buttonStyles({ variant: 'outline' })}>
              <Sparkles className="h-4 w-4" />
              Open Prompt Library
            </Link>
          </>
        }
      />

      <Notice tone="info" title="Safe planning boundary">
        This planner does not modify repository files, write to GitHub, create pull requests, deploy,
        run task execution, publish provider content, or expose secrets.
      </Notice>

      {projectsResult.error ? (
        <Notice tone="warning" title="Project context unavailable">
          {projectsResult.error}
        </Notice>
      ) : null}

      {plansResult.error ? (
        <Notice tone="warning" title="Patch plans unavailable">
          {plansResult.error}
        </Notice>
      ) : null}

      <SafePatchPlannerClient
        projects={projectsResult.data}
        plans={plansResult.data}
        selectedProjectId={selectedProjectId}
        initialContext={initialContext}
      />

      <div className="rounded-2xl border border-black/7 bg-white/90 p-5 shadow-[0_18px_45px_rgba(93,107,107,0.07)]">
        <div className="flex items-start gap-3">
          <Code2 className="mt-1 h-5 w-5 shrink-0 text-[#F7CBCA]" />
          <div>
            <h2 className="font-black text-[#5D6B6B]">How to use the generated prompt</h2>
            <p className="mt-1 text-sm leading-7 text-black/58">
              Copy the Codex implementation prompt only after the approval checklist is reviewed.
              Keep the implementation scope narrow, verify with lint/typecheck/build, and keep the
              no-touch systems intact.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
