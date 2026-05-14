import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, FolderKanban, GitCommit } from 'lucide-react';
import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getProjectById, listProjectsForWorkspace, normalizeProjectMetadata } from '@/lib/data/projects';
import { buildReleaseReport, getReleaseById, getReleaseNextAction } from '@/lib/data/releases';
import { getGitHubRepositorySnapshot } from '@/lib/github';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTime } from '@/lib/utils';
import { ReleaseStatusBadge, ReleaseTypeBadge } from '../ReleaseBadge';
import { ReleaseForm } from '../ReleaseForm';
import { ReleaseReportButton } from '../ReleaseReportButton';
import { GitHubReleaseNotesButton } from '../GitHubReleaseNotesButton';

export default async function ReleaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  if (!workspaceResult.data) notFound();
  const [releaseResult, projectsResult] = await Promise.all([
    getReleaseById(id, workspaceResult.data.id, supabase),
    listProjectsForWorkspace(workspaceResult.data.id, supabase),
  ]);
  if (!releaseResult.data) notFound();
  const release = releaseResult.data;
  const projectResult = release.project_id ? await getProjectById(release.project_id, workspaceResult.data.id, supabase) : null;
  const project = projectResult?.data ?? null;
  const projectMetadata = normalizeProjectMetadata(project?.metadata);
  const githubSnapshot =
    projectMetadata.github.owner && projectMetadata.github.repo
      ? await getGitHubRepositorySnapshot({
          owner: projectMetadata.github.owner,
          repo: projectMetadata.github.repo,
          branch: projectMetadata.github.default_branch,
        })
      : null;
  const report = buildReleaseReport(release, project?.name);
  const githubReleaseDraft = buildGitHubReleaseNotesDraft(release.title, project?.name ?? null, githubSnapshot?.commits ?? []);
  const codebaseReleaseDraft = buildCodebaseReleaseNotesDraft(release.title, project?.name ?? null, projectMetadata.codebase_analysis);
  const metadata = release.metadata ?? {};

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Release Manager"
        title={release.title}
        description={release.summary ?? 'Release overview, verification, deployment notes, and rollback plan.'}
        actions={
          <>
            <Link href="/dashboard/releases" className={buttonStyles({ variant: 'outline' })}><ArrowLeft className="h-4 w-4" />Back to Releases</Link>
            {project && <Link href={`/dashboard/projects/${project.id}`} className={buttonStyles({ variant: 'outline' })}><FolderKanban className="h-4 w-4" />Project Releases</Link>}
            <ReleaseReportButton report={report} />
          </>
        }
      />
      {releaseResult.error && <Notice tone="warning" title="Release data notice">{releaseResult.error}</Notice>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="Release Overview" description="Core release identity and links." action={<div className="flex flex-wrap gap-2"><ReleaseStatusBadge status={release.status} /><ReleaseTypeBadge type={release.release_type} /></div>} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Line label="Version" value={release.version} />
            <Line label="Phase" value={release.phase_name} />
            <Line label="Project" value={project?.name ?? null} />
            <Line label="Deployed at" value={release.deployed_at ? formatDateTime(release.deployed_at) : null} />
            <Line label="Updated" value={formatDateTime(release.updated_at)} />
            <Line label="Next action" value={getReleaseNextAction(release)} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {release.deploy_url && <a href={release.deploy_url} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'outline' })}><ExternalLink className="h-4 w-4" />Deploy URL</a>}
            {release.main_production_url && <a href={release.main_production_url} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'outline' })}><ExternalLink className="h-4 w-4" />Production URL</a>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Verification" description="Real statuses entered by the manager." />
          <div className="space-y-3">
            <Line label="Lint" value={release.lint_status} />
            <Line label="Typecheck" value={release.typecheck_status} />
            <Line label="Build" value={release.build_status} />
            <Line label="Deploy" value={release.deploy_status} />
            <Line label="Tested routes" value={String(metadata.tested_routes ?? '') || null} />
          </div>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Implementation Summary" items={[['Summary', release.summary], ['Files changed', release.files_changed], ['Features added', release.features_added], ['Fixes', release.fixes]]} />
        <Section title="Known Issues" items={[['Known issues', release.known_issues], ['Warnings', String(metadata.warnings ?? '') || null], ['Blockers', String(metadata.blockers ?? '') || null]]} />
        <Section title="Rollback Plan" items={[['Rollback notes', release.rollback_notes], ['Previous deploy URL', String(metadata.previous_deploy_url ?? '') || null], ['Safe recovery steps', String(metadata.safe_recovery_steps ?? '') || null]]} />
        <Card><CardHeader title="Final Report" description="Copy-ready release report with safety confirmations." /><pre className="max-h-[460px] overflow-auto whitespace-pre-wrap rounded-lg border border-black/8 bg-[#5D6B6B] p-5 font-mono text-xs leading-5 text-[#F1F7F7]">{report}</pre></Card>
      </div>
      {project ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="GitHub Release Notes Draft"
              description="Read-only helper from the linked project repository. No GitHub releases are created in this phase."
              action={githubSnapshot?.commits.length ? <GitHubReleaseNotesButton draft={githubReleaseDraft} /> : null}
            />
            {!projectMetadata.github.owner || !projectMetadata.github.repo ? (
              <Line label="GitHub repository" value="Not linked on this project." />
            ) : githubSnapshot?.status !== 'ready' ? (
              <Line label="GitHub status" value={githubSnapshot?.message ?? 'Could not load GitHub commits.'} />
            ) : (
              <div className="space-y-3">
                {githubSnapshot.commits.map((commit) => (
                  <a key={commit.sha} href={commit.htmlUrl} target="_blank" rel="noreferrer" className="flex min-w-0 gap-3 rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4 hover:bg-white">
                    <GitCommit className="mt-0.5 h-4 w-4 shrink-0 text-[#F7CBCA]" />
                    <span className="min-w-0">
                      <span className="block break-words font-black text-[#5D6B6B]">{commit.message}</span>
                      <span className="mt-1 block text-sm text-black/58">{commit.author} · {commit.shortSha}</span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <CardHeader
              title="Codebase Analysis Release Draft"
              description="Copy-ready notes from the latest saved project analysis. No release is created automatically."
              action={projectMetadata.codebase_analysis.summary ? <GitHubReleaseNotesButton draft={codebaseReleaseDraft} /> : null}
            />
            {projectMetadata.codebase_analysis.summary ? (
              <div className="space-y-3">
                <Line label="Analysis source" value={projectMetadata.codebase_analysis.source_label} />
                <Line label="Summary" value={projectMetadata.codebase_analysis.summary} />
                <Line label="Generated" value={projectMetadata.codebase_analysis.generated_at ? formatDateTime(projectMetadata.codebase_analysis.generated_at) : null} />
              </div>
            ) : (
              <Line label="Codebase analysis" value="No saved codebase analysis for this project yet." />
            )}
          </Card>
        </div>
      ) : null}
      <div id="edit-release"><ReleaseForm mode="edit" release={release} projects={projectsResult.data} /></div>
    </div>
  );
}

function buildCodebaseReleaseNotesDraft(
  releaseTitle: string,
  projectName: string | null,
  analysis: {
    summary: string | null;
    generated_at: string | null;
    source_label: string | null;
    tech_stack: string[];
    key_findings: string[];
    next_actions: string[];
  }
) {
  return [
    `# ${releaseTitle}`,
    projectName ? `Project: ${projectName}` : null,
    analysis.source_label ? `Analysis source: ${analysis.source_label}` : null,
    analysis.generated_at ? `Analysis date: ${analysis.generated_at}` : null,
    '',
    '## Codebase Analysis Summary',
    analysis.summary ?? 'No saved codebase analysis summary is available.',
    '',
    '## Tech Stack',
    ...(analysis.tech_stack.length ? analysis.tech_stack.map((item) => `- ${item}`) : ['- Needs review']),
    '',
    '## Findings to Mention',
    ...(analysis.key_findings.length ? analysis.key_findings.map((item) => `- ${item}`) : ['- No saved findings.']),
    '',
    '## Recommended Follow-ups',
    ...(analysis.next_actions.length ? analysis.next_actions.map((item) => `- ${item}`) : ['- Review the project manually before release.']),
    '',
    'Safety notes:',
    '- This is a copy-ready draft only.',
    '- No GitHub release was created.',
    '- No repository files were modified.',
  ].filter((line): line is string => line !== null).join('\n');
}

function buildGitHubReleaseNotesDraft(
  releaseTitle: string,
  projectName: string | null,
  commits: Array<{ shortSha: string; message: string; author: string; htmlUrl: string }>
) {
  return [
    `# ${releaseTitle}`,
    projectName ? `Project: ${projectName}` : null,
    '',
    '## GitHub Commit Summary',
    ...(commits.length > 0
      ? commits.map((commit) => `- ${commit.message} (${commit.shortSha}, ${commit.author}) - ${commit.htmlUrl}`)
      : ['- No GitHub commits available from the linked repository.']),
    '',
    'Safety notes:',
    '- This is a draft only.',
    '- No GitHub release was created.',
    '- No commits, branches, pull requests, or repository files were modified.',
  ].filter((line): line is string => line !== null).join('\n');
}

function Line({ label, value }: { label: string; value: string | null }) {
  return <div className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-3"><p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">{label}</p><p className="mt-2 break-words text-sm font-semibold leading-6 text-black/68">{value || 'Not added'}</p></div>;
}

function Section({ title, items }: { title: string; items: Array<[string, string | null]> }) {
  return <Card><CardHeader title={title} /><div className="space-y-4">{items.map(([label, value]) => <Line key={label} label={label} value={value} />)}</div></Card>;
}
