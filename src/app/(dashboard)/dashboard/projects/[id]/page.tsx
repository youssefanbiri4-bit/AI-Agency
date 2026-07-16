import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bug,
  CheckSquare,
  ClipboardList,
  Code,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Image as ImageIcon,
  CircleDot,
  Megaphone,
  Rocket,
  Sparkles,
  Star,
  TestTube,
  PanelsTopLeft,
  ShieldCheck,
  SearchCode,
  Workflow,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import {
  formatProjectType,
  getProjectById,
  normalizeProjectMetadata,
} from '@/lib/data/projects';
import {
  getGitHubReadiness,
  getGitHubRepositorySnapshot,
  listGitHubIssues,
  listGitHubPullRequests,
  type GitHubRepoSnapshot,
} from '@/lib/github';
import { listTasks } from '@/features/tasks/data/tasks';
import { listSafePatchPlansForWorkspace } from '@/lib/data/safe-patch-plans';
import { listGitHubIssueTaskLinksForProject } from '@/lib/data/github-issue-task-links';
import { listPullRequestReviewsForProject } from '@/lib/data/pull-request-reviews';
import { buttonStyles } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn, formatDateTime } from '@/lib/utils';
import { ProjectPriorityBadge, ProjectStatusBadge, ProjectTypeBadge } from '../ProjectBadge';

const ProjectForm = dynamic(
  () => import('../ProjectForm').then((mod) => mod.ProjectForm),
  { loading: () => <div className="animate-pulse rounded-2xl border border-black/7 bg-white p-6 h-64" /> }
);

const CodebaseAnalyzer = dynamic(
  () => import('../CodebaseAnalyzer').then((mod) => mod.CodebaseAnalyzer),
  {
    loading: () => (
      <LoadingState
        title="Loading code analysis"
        description="Preparing repository analysis tools."
      />
    ),
  }
);

const GitHubIssuesPanel = dynamic(
  () => import('../GitHubIssuesPanel').then((mod) => mod.GitHubIssuesPanel),
  {
    loading: () => (
      <LoadingState
        title="Loading issues"
        description="Fetching GitHub issues."
      />
    ),
  }
);

const PullRequestAssistantPanel = dynamic(
  () => import('../PullRequestAssistantPanel').then((mod) => mod.PullRequestAssistantPanel),
  {
    loading: () => (
      <LoadingState
        title="Loading PR assistant"
        description="Preparing pull request tools."
      />
    ),
  }
);

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    notFound();
  }

  const projectResult = await getProjectById(id, workspaceResult.data.id, supabase);

  if (!projectResult.data) {
    notFound();
  }

  const project = projectResult.data;
  const metadata = normalizeProjectMetadata(project.metadata);
  const githubOwner = metadata.github.owner;
  const githubRepo = metadata.github.repo;
  const [
    tasksResult,
    githubSnapshot,
    safePatchPlansResult,
    githubIssuesResult,
    githubIssueLinksResult,
    githubPullRequestsResult,
    pullRequestReviewsResult,
  ] = await Promise.all([
    listTasks({ workspaceId: workspaceResult.data.id, limit: 500 }, supabase),
    githubOwner && githubRepo
      ? getGitHubRepositorySnapshot({
          owner: githubOwner,
          repo: githubRepo,
          branch: metadata.github.default_branch,
        })
      : Promise.resolve(null),
    listSafePatchPlansForWorkspace(workspaceResult.data.id, supabase, project.id, 6),
    githubOwner && githubRepo
      ? listGitHubIssues({
          owner: githubOwner,
          repo: githubRepo,
          state: 'all',
          perPage: 30,
        })
      : Promise.resolve(null),
    listGitHubIssueTaskLinksForProject(workspaceResult.data.id, project.id, supabase),
    githubOwner && githubRepo
      ? listGitHubPullRequests({
          owner: githubOwner,
          repo: githubRepo,
          state: 'all',
          perPage: 30,
        })
      : Promise.resolve(null),
    listPullRequestReviewsForProject(workspaceResult.data.id, project.id, supabase),
  ]);
  const githubReadiness = getGitHubReadiness();
  const relatedTasks = tasksResult.data.filter((task) => metadata.related_task_ids.includes(task.id));
  const createTaskHref = `/dashboard/create-task?project=${project.id}&title=${encodeURIComponent(`Project task: ${project.name}`)}&description=${encodeURIComponent(`Project: ${project.name}\n\nContext:\n${project.description ?? 'Add project context and desired outcome.'}`)}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Project workspace"
        title={project.name}
        description={project.description ?? 'Project overview, delivery links, notes, and deployment readiness.'}
        actions={
          <>
            <Link href="/dashboard/projects" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Link>
            <Link href={createTaskHref} className={buttonStyles()}>
              <CheckSquare className="h-4 w-4" />
              Create Task for this Project
            </Link>
            <Link href="/dashboard/prompt-library" className={buttonStyles({ variant: 'outline' })}>
              <ClipboardList className="h-4 w-4" />
              Open Prompt Library
            </Link>
            <Link href={`/dashboard/releases?project=${project.id}`} className={buttonStyles({ variant: 'outline' })}>
              <Rocket className="h-4 w-4" />
              Project Releases
            </Link>
            <Link href={`/dashboard/software-planner?project=${project.id}`} className={buttonStyles({ variant: 'outline' })}>
              <Sparkles className="h-4 w-4" />
              Generate Project Plan
            </Link>
            <Link href={`/dashboard/safe-patch-planner?project=${project.id}`} className={buttonStyles({ variant: 'outline' })}>
              <SearchCode className="h-4 w-4" />
              Plan Patch for this Project
            </Link>
          </>
        }
      />

      {projectResult.error && (
        <Notice tone="warning" title="Project data notice">
          {projectResult.error}
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader
            title="Project Overview"
            description="Core internal context for this project workspace."
            action={
              <div className="flex flex-wrap gap-2">
                <ProjectTypeBadge type={project.project_type} />
                <ProjectStatusBadge status={project.status} />
                <ProjectPriorityBadge priority={project.priority} />
              </div>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailLine label="Type" value={formatProjectType(project.project_type)} />
            <DetailLine label="Tech stack" value={project.tech_stack} />
            <DetailLine label="Created" value={formatDateTime(project.created_at)} />
            <DetailLine label="Updated" value={formatDateTime(project.updated_at)} />
            <DetailLine label="Local path note" value={project.local_path_note} wide />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {project.github_url && (
              <a href={project.github_url} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'outline' })}>
                <GitBranch className="h-4 w-4" />
                GitHub
              </a>
            )}
            {project.production_url && (
              <a href={project.production_url} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'outline' })}>
                <ExternalLink className="h-4 w-4" />
                Production
              </a>
            )}
            {project.staging_url && (
              <a href={project.staging_url} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'outline' })}>
                <ExternalLink className="h-4 w-4" />
                Staging
              </a>
            )}
            {project.documentation_url && (
              <a href={project.documentation_url} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'outline' })}>
                <FileText className="h-4 w-4" />
                Docs
              </a>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Next Actions" description="Manual checklist stored in project metadata." />
          {metadata.next_actions.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="No next actions yet"
              description="Add one action per line in the edit form below."
            />
          ) : (
            <ol className="space-y-3">
              {metadata.next_actions.map((action, index) => (
                <li key={`${action}-${index}`} className="flex gap-3 rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-3 text-sm leading-6 text-black/66">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#D5E5E5] text-xs font-black text-[#F7CBCA]">
                    {index + 1}
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <GitHubRepositoryPanel
        projectName={project.name}
        savedUrl={project.github_url ?? metadata.github.repo_url}
        owner={githubOwner}
        repo={githubRepo}
        defaultBranch={metadata.github.default_branch}
        snapshot={githubSnapshot}
        tokenPresent={githubReadiness.tokenPresent}
      />

      <Suspense fallback={<div className="animate-pulse rounded-2xl border border-black/7 bg-white p-6 h-48" />}>
        <GitHubIssuesPanel
          projectId={project.id}
          owner={githubOwner}
          repo={githubRepo}
          savedUrl={project.github_url ?? metadata.github.repo_url}
          issuesResult={githubIssuesResult}
          links={githubIssueLinksResult.data}
          linksError={githubIssueLinksResult.error}
        />
      </Suspense>

      <Suspense fallback={<div className="animate-pulse rounded-2xl border border-black/7 bg-white p-6 h-48" />}>
        <PullRequestAssistantPanel
          projectId={project.id}
          owner={githubOwner}
          repo={githubRepo}
          savedUrl={project.github_url ?? metadata.github.repo_url}
          pullRequestsResult={githubPullRequestsResult}
          reviews={pullRequestReviewsResult.data}
          reviewsError={pullRequestReviewsResult.error}
        />
      </Suspense>

      <CodebaseAnalyzer
        projectId={project.id}
        projectName={project.name}
        githubLinked={Boolean(githubOwner && githubRepo)}
        githubLabel={githubOwner && githubRepo ? `${githubOwner}/${githubRepo}` : null}
        savedAnalysis={metadata.codebase_analysis}
      />

      <Card>
        <CardHeader
          title="Safe Patch Plans"
          description="Planning-only code change plans linked to this project. No repository changes are made here."
          action={
            <Link href={`/dashboard/safe-patch-planner?project=${project.id}`} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              <SearchCode className="h-4 w-4" />
              Plan New Patch
            </Link>
          }
        />
        {safePatchPlansResult.error ? (
          <Notice tone="warning" title="Patch plans unavailable">
            {safePatchPlansResult.error}
          </Notice>
        ) : safePatchPlansResult.data.length === 0 ? (
          <EmptyState
            icon={SearchCode}
            title="No patch plans yet"
            description="Create a safe implementation plan before asking Codex to modify files."
            action={
              <Link href={`/dashboard/safe-patch-planner?project=${project.id}`} className={buttonStyles({ variant: 'secondary' })}>
                Plan Patch for this Project
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {safePatchPlansResult.data.map((plan) => (
              <Link
                key={plan.id}
                href={`/dashboard/safe-patch-planner?project=${project.id}`}
                className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4 hover:bg-white"
              >
                <p className="font-black text-[#5D6B6B]">{plan.title}</p>
                <p className="mt-1 text-sm leading-6 text-black/58">
                  {plan.change_type.replace(/_/g, ' ')} / {plan.risk_level} risk
                </p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-black/42">
                  {plan.status.replace(/_/g, ' ')} / {formatDateTime(plan.created_at)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Related Tasks" description="Linked task IDs stored in project metadata." />
          {relatedTasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="No linked tasks"
              description="Use the project task shortcut to open the existing task creation flow with project context."
              action={
                <Link href={createTaskHref} className={buttonStyles({ variant: 'secondary' })}>
                  Create Task for this Project
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {relatedTasks.map((task) => (
                <Link key={task.id} href={`/dashboard/tasks/${task.id}`} className="block rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4 hover:bg-white">
                  <p className="font-black text-black">{task.title}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-black/42">{task.status}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Related Content & Campaigns" description="Content relationships can be added later without changing provider logic." />
          <EmptyState
            icon={Megaphone}
            title="Open Content Studio"
            description="Create or review related campaign and content records from the existing studio."
            action={
              <Link href="/dashboard/content-studio" className={buttonStyles({ variant: 'secondary' })}>
                Open Content Studio
              </Link>
            }
          />
        </Card>

        <Card>
          <CardHeader title="Related Creative Assets" description="Creative asset relationships can be added later without changing storage records." />
          <EmptyState
            icon={ImageIcon}
            title="Open Creative Assets"
            description="Manage prompts, images, videos, and reusable campaign visuals."
            action={
              <Link href="/dashboard/creative-assets" className={buttonStyles({ variant: 'secondary' })}>
                Open Creative Assets
              </Link>
            }
          />
        </Card>
      </div>

      <DeveloperAgentShortcuts projectId={project.id} projectName={project.name} description={project.description} techStack={project.tech_stack} />

      <div id="project-notes" className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Project Notes" description="Editable from the project form below." />
          <TextBlock value={project.notes} empty="No project notes yet." />
        </Card>

        <Card>
          <CardHeader title="Release / Deployment Notes" description="Deployment notes, known issues, rollback notes, and testing checklist." />
          <div className="space-y-4">
            <TextSection title="Release notes" value={metadata.release_notes} />
            <TextSection title="Last deploy notes" value={metadata.last_deploy_notes} />
            <TextSection title="Known issues" value={metadata.known_issues} />
            <TextSection title="Rollback notes" value={metadata.rollback_notes} />
            <TextSection title="Testing checklist" value={metadata.testing_checklist} />
          </div>
        </Card>
      </div>

      <div id="edit-project">
        <ProjectForm mode="edit" project={project} />
      </div>
    </div>
  );
}

function DeveloperAgentShortcuts({
  projectId,
  projectName,
  description,
  techStack,
}: {
  projectId: string;
  projectName: string;
  description: string | null;
  techStack: string | null;
}) {
  const baseDescription = `Project: ${projectName}\nTech stack: ${techStack ?? 'Not added'}\n\nContext:\n${description ?? 'Add project context before running this planning task.'}\n\nReturn a structured report, plan, or checklist only. Do not edit code, push commits, create pull requests, deploy, expose secrets, or run tasks automatically.`;
  const shortcuts = [
    ['Ask Code Review Agent', 'code-review-agent', 'Review project/codebase quality, risks, maintainability, and testing needs.', Code],
    ['Ask Bug Fix Agent', 'bug-fix-agent', 'Analyze a bug, error, or failing behavior and propose a safe fix plan.', Bug],
    ['Ask Architecture Agent', 'architecture-agent', 'Plan architecture, data flow, modules, API/server actions, and tradeoffs.', Workflow],
    ['Ask Testing Agent', 'testing-agent', 'Create a QA, smoke test, and acceptance checklist for this project.', TestTube],
    ['Ask Documentation Agent', 'documentation-agent', 'Create internal docs, release notes, setup guide, or project report.', BookOpen],
    ['Ask Deployment Agent', 'deployment-agent', 'Prepare deploy checklist, migration checks, smoke tests, and rollback notes.', Rocket],
    ['Ask Security Review Agent', 'security-review-agent', 'Review secret exposure, auth, RLS, uploads, and token handling risks.', ShieldCheck],
    ['Ask Database Agent', 'database-agent', 'Plan or review schema, migrations, RLS, indexes, and Supabase policies.', Database],
    ['Ask UI/UX Review Agent', 'ui-ux-review-agent', 'Review layout, readability, forms, accessibility, and mobile responsiveness.', PanelsTopLeft],
  ] as const;

  return (
    <Card>
      <CardHeader
        title="Developer Agent Shortcuts"
        description="Open the existing task creation flow with project context. Tasks stay pending until you run them manually."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map(([label, agentId, taskGoal, Icon]) => (
          <Link
            key={agentId}
            href={`/dashboard/create-task?project=${projectId}&agent=${agentId}&title=${encodeURIComponent(`${label.replace('Ask ', '')}: ${projectName}`)}&description=${encodeURIComponent(`${baseDescription}\n\nTask goal:\n${taskGoal}`)}`}
            className={buttonStyles({ variant: 'outline', className: 'justify-start whitespace-normal text-left' })}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function GitHubRepositoryPanel({
  projectName,
  savedUrl,
  owner,
  repo,
  defaultBranch,
  snapshot,
  tokenPresent,
}: {
  projectName: string;
  savedUrl: string | null;
  owner: string | null;
  repo: string | null;
  defaultBranch: string | null;
  snapshot: GitHubRepoSnapshot | null;
  tokenPresent: boolean;
}) {
  const repoUrl = snapshot?.repo?.htmlUrl ?? savedUrl;

  return (
    <Card>
      <CardHeader
        title="GitHub Repository"
        description="Read-only repository visibility for project tracking, release notes, issues, and pull requests."
        action={
          repoUrl ? (
            <a href={repoUrl} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              <ExternalLink className="h-4 w-4" />
              Open GitHub
            </a>
          ) : null
        }
      />

      {!owner || !repo ? (
        <EmptyState
          icon={GitBranch}
          title="No GitHub repository linked"
          description="Add a GitHub URL, owner, repository name, and optional default branch in the project form below."
        />
      ) : !tokenPresent ? (
        <div className="space-y-4">
          <Notice tone="warning" title="GitHub setup required">
            Saved repository metadata is available, but live GitHub data needs a server-side GITHUB_TOKEN. Use a fine-grained read-only token where possible.
          </Notice>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailLine label="Owner" value={owner} />
            <DetailLine label="Repository" value={repo} />
            <DetailLine label="Default branch" value={defaultBranch} />
            <DetailLine label="Saved URL" value={savedUrl} />
          </div>
        </div>
      ) : snapshot?.repo ? (
        <div className="space-y-6">
          {snapshot.status !== 'ready' ? (
            <Notice tone="warning" title="GitHub data notice">
              {snapshot.message}
            </Notice>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailLine label="Repository" value={snapshot.repo.fullName} />
            <DetailLine label="Visibility" value={snapshot.repo.visibility ?? (snapshot.repo.private ? 'private' : 'public')} />
            <DetailLine label="Default branch" value={snapshot.repo.defaultBranch} />
            <DetailLine label="Language" value={snapshot.repo.language} />
            <DetailLine label="Stars" value={String(snapshot.repo.stars ?? 0)} />
            <DetailLine label="Forks" value={String(snapshot.repo.forks ?? 0)} />
            <DetailLine label="Open issues" value={String(snapshot.issues.length || (snapshot.repo.openIssuesCount ?? 0))} />
            <DetailLine label="Open pull requests" value={String(snapshot.pullRequests.length)} />
            <DetailLine label="Last pushed" value={snapshot.repo.pushedAt ? formatDateTime(snapshot.repo.pushedAt) : null} wide />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <RepositoryList
              title="Latest Commits"
              empty="No commits returned by GitHub."
              items={snapshot.commits.map((commit) => ({
                key: commit.sha,
                title: commit.message,
                detail: `${commit.author} · ${commit.date ? formatDateTime(commit.date) : 'Date unavailable'} · ${commit.shortSha}`,
                href: commit.htmlUrl,
                icon: GitCommit,
              }))}
            />
            <RepositoryList
              title="Branches"
              empty="No branches returned by GitHub."
              items={snapshot.branches.map((branch) => ({
                key: branch.name,
                title: branch.name,
                detail: branch.protected ? 'Protected branch' : 'Branch',
                href: branch.htmlUrl,
                icon: GitBranch,
              }))}
            />
            <RepositoryList
              title="Open Issues"
              empty="No open issues returned by GitHub."
              items={snapshot.issues.map((issue) => ({
                key: String(issue.number),
                title: `#${issue.number} ${issue.title}`,
                detail: `${issue.state} · updated ${formatDateTime(issue.updatedAt)}${issue.labels.length ? ` · ${issue.labels.join(', ')}` : ''}`,
                href: issue.htmlUrl,
                icon: CircleDot,
                taskHref: `/dashboard/create-task?project=${encodeURIComponent(projectName)}&title=${encodeURIComponent(`GitHub issue #${issue.number}: ${issue.title}`)}&description=${encodeURIComponent(`Project: ${projectName}\nGitHub issue: #${issue.number}\n${issue.htmlUrl}\n\nCreate a safe analysis or fix plan. Do not modify code automatically.`)}`,
              }))}
            />
            <RepositoryList
              title="Open Pull Requests"
              empty="No open pull requests returned by GitHub."
              items={snapshot.pullRequests.map((pull) => ({
                key: String(pull.number),
                title: `#${pull.number} ${pull.title}`,
                detail: `${pull.state} · ${pull.branch} · updated ${formatDateTime(pull.updatedAt)}`,
                href: pull.htmlUrl,
                icon: GitPullRequest,
              }))}
            />
          </div>
        </div>
      ) : (
        <Notice tone="warning" title="Could not load repository data">
          {snapshot?.message ?? 'Repository not found or access denied.'}
        </Notice>
      )}
    </Card>
  );
}

function RepositoryList({
  title,
  items,
  empty,
}: {
  title: string;
  empty: string;
  items: Array<{
    key: string;
    title: string;
    detail: string;
    href: string;
    taskHref?: string;
    icon: typeof Star;
  }>;
}) {
  return (
    <section>
      <h3 className="mb-3 font-black text-[#5D6B6B]">{title}</h3>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/10 bg-[#F1F7F7]/70 p-4 text-sm text-black/55">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.key} className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4">
                <div className="flex min-w-0 gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#F7CBCA]" />
                  <div className="min-w-0 flex-1">
                    <a href={item.href} target="_blank" rel="noreferrer" className="break-words font-black text-[#5D6B6B] hover:text-[#F7CBCA]">
                      {item.title}
                    </a>
                    <p className="mt-1 text-sm leading-6 text-black/58">{item.detail}</p>
                    {item.taskHref ? (
                      <Link href={item.taskHref} className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'mt-2' })}>
                        Create Task from Issue
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DetailLine({ label, value, wide = false }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-3', wide && 'sm:col-span-2')}>
      <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold leading-6 text-black/68">{value || 'Not added'}</p>
    </div>
  );
}

function TextBlock({ value, empty }: { value: string | null; empty: string }) {
  return (
    <p className="whitespace-pre-wrap rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4 text-sm leading-6 text-black/66">
      {value || empty}
    </p>
  );
}

function TextSection({ title, value }: { title: string; value: string | null }) {
  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">{title}</p>
      <TextBlock value={value} empty="Not added." />
    </section>
  );
}
