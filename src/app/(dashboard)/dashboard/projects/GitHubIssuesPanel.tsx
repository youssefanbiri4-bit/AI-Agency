'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bug,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  FileText,
  GitPullRequest,
  RefreshCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { GitHubIssueItem, GitHubIssuesResult, GitHubIntegrationStatus } from '@/lib/github';
import type { GitHubIssueTaskLink } from '@/lib/data/github-issue-task-links';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useActionToast } from '@/hooks/useActionToast';
import { cn, formatDateTime } from '@/lib/utils';
import {
  createTaskFromGitHubIssueAction,
  type GitHubIssueTaskState,
} from './github-issues-actions';

interface GitHubIssuesPanelProps {
  projectId: string;
  owner: string | null;
  repo: string | null;
  savedUrl: string | null;
  issuesResult: GitHubIssuesResult | null;
  links: GitHubIssueTaskLink[];
  linksError: string | null;
}

type ConversionFilter = 'all' | 'converted' | 'unconverted';
type StateFilter = 'open' | 'closed' | 'all';

const initialState: GitHubIssueTaskState = {
  error: null,
  message: null,
  taskId: null,
  link: null,
};

function statusForGitHub(status: GitHubIntegrationStatus): Parameters<typeof StatusBadge>[0]['status'] {
  if (status === 'ready') return 'ready';
  if (status === 'setup_required') return 'setup_required';
  if (status === 'rate_limited') return 'quota_limit';
  return 'error';
}

function labelText(labels: string[]) {
  return labels.length ? labels.join(', ') : 'none';
}

function suggestPriority(issue: GitHubIssueItem) {
  const haystack = [...issue.labels, issue.title, issue.body].join(' ').toLowerCase();
  if (/critical|urgent|security|vulnerability|incident|p0|p1/.test(haystack)) return 'High';
  if (/bug|broken|error|crash|failing|regression/.test(haystack)) return 'High';
  return 'Normal';
}

function suggestAgent(issue: GitHubIssueItem) {
  const haystack = [...issue.labels, issue.title, issue.body].join(' ').toLowerCase();
  if (/security|vulnerability|auth|rls|token|secret/.test(haystack)) return 'Security Review Agent';
  if (/doc|documentation|readme|guide/.test(haystack)) return 'Documentation Agent';
  if (/database|supabase|sql|migration|schema/.test(haystack)) return 'Database Agent';
  if (/ui|ux|design|frontend|layout|responsive|css/.test(haystack)) return 'UI/UX Review Agent';
  if (/test|testing|qa|coverage/.test(haystack)) return 'Testing Agent';
  if (/deploy|vercel|build|ci|release/.test(haystack)) return 'Deployment Agent';
  if (/refactor|architecture|structure/.test(haystack)) return 'Architecture Agent';
  if (/bug|error|crash|broken|fix/.test(haystack)) return 'Bug Fix Agent';
  return 'Code Review Agent';
}

export function GitHubIssuesPanel({
  projectId,
  owner,
  repo,
  savedUrl,
  issuesResult,
  links,
  linksError,
}: GitHubIssuesPanelProps) {
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('open');
  const [conversionFilter, setConversionFilter] = useState<ConversionFilter>('all');
  const [selectedIssueNumber, setSelectedIssueNumber] = useState<number | null>(issuesResult?.issues[0]?.number ?? null);
  const [actionState, formAction, isCreating] = useActionState(createTaskFromGitHubIssueAction, initialState);
  const linkByIssue = useMemo(() => new Map(links.map((link) => [link.github_issue_number, link])), [links]);
  const issues = useMemo(() => issuesResult?.issues ?? [], [issuesResult?.issues]);
  const selectedIssue = issues.find((issue) => issue.number === selectedIssueNumber) ?? issues[0] ?? null;
  const selectedLink = selectedIssue ? linkByIssue.get(selectedIssue.number) ?? null : null;
  const filteredIssues = useMemo(
    () =>
      issues.filter((issue) => {
        if (stateFilter !== 'all' && issue.state !== stateFilter) return false;
        const converted = linkByIssue.has(issue.number);
        if (conversionFilter === 'converted' && !converted) return false;
        if (conversionFilter === 'unconverted' && converted) return false;
        if (query.trim()) {
          const haystack = [issue.title, issue.body, issue.author, ...issue.labels].join(' ').toLowerCase();
          if (!haystack.includes(query.trim().toLowerCase())) return false;
        }
        return true;
      }),
    [conversionFilter, issues, linkByIssue, query, stateFilter]
  );

  useActionToast({
    isPending: isCreating,
    state: actionState,
    loadingMessage: 'Creating pending task from GitHub issue...',
    successMessage: (state) => state.message ?? 'Task created from GitHub issue.',
    errorMessage: (state) => state.error ?? 'Could not create task from issue.',
  });

  if (!owner || !repo) {
    return (
      <Card>
        <CardHeader title="GitHub Issues" description="Convert repository issues into pending AgentFlow AI tasks." />
        <EmptyState
          icon={<GitPullRequest className="h-6 w-6" />}
          title="No GitHub repository linked to this project"
          description="Add a GitHub repository URL in the project form to load issues safely."
          action={
            <Link href="#edit-project" className={buttonStyles({ variant: 'secondary' })}>
              Add GitHub Repository
            </Link>
          }
        />
      </Card>
    );
  }

  const status = issuesResult?.status ?? 'setup_required';

  return (
    <Card>
      <CardHeader
        title="GitHub Issues"
        description="Read-only issue import. Creating a task does not modify GitHub and does not run the task."
        action={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={statusForGitHub(status)} type="system" size="sm" />
            {savedUrl ? (
              <a href={savedUrl} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                <ExternalLink className="h-4 w-4" />
                Open Repo
              </a>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <Metric label="Repository" value={`${owner}/${repo}`} />
        <Metric label="Open issues" value={String(issuesResult?.repo?.openIssuesCount ?? issues.filter((issue) => issue.state === 'open').length)} />
        <Metric label="Converted" value={String(links.length)} />
        <Metric label="Unconverted loaded" value={String(Math.max(0, issues.filter((issue) => !linkByIssue.has(issue.number)).length))} />
      </div>

      {linksError ? (
        <Notice tone="warning" title="Issue link history unavailable">
          {linksError}
        </Notice>
      ) : null}

      {status !== 'ready' ? (
        <Notice tone={status === 'setup_required' ? 'warning' : 'danger'} title={issuesResult?.message ?? 'GitHub setup required'}>
          {issuesResult?.message ?? 'GitHub setup required. Add a read-only server-side token to load issues.'}
        </Notice>
      ) : null}

      <Notice tone="info" title="Review before task creation">
        Review issue content before creating a task. Issue text is sanitized, but do not store secrets in tasks.
      </Notice>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)]">
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_190px]">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, body, labels" className="ps-9" />
            </div>
            <Select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as StateFilter)}>
              <option value="open">Open issues</option>
              <option value="closed">Closed issues</option>
              <option value="all">All loaded</option>
            </Select>
            <Select value={conversionFilter} onChange={(event) => setConversionFilter(event.target.value as ConversionFilter)}>
              <option value="all">All conversion states</option>
              <option value="unconverted">Not converted</option>
              <option value="converted">Already converted</option>
            </Select>
          </div>

          {filteredIssues.length === 0 ? (
            <EmptyState
              icon={<CircleDot className="h-6 w-6" />}
              title="No GitHub issues match"
              description={issues.length ? 'Adjust filters or refresh issue data.' : 'No issues were returned by GitHub for this repository.'}
            />
          ) : (
            <div className="space-y-3">
              {filteredIssues.map((issue) => {
                const linkedTask = linkByIssue.get(issue.number);
                const active = selectedIssue?.number === issue.number;

                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => setSelectedIssueNumber(issue.number)}
                    className={cn(
                      'w-full rounded-lg border p-4 text-left transition-colors',
                      active ? 'border-[#F7CBCA]/32 bg-[#D5E5E5]/45' : 'border-black/7 bg-[#F1F7F7]/70 hover:bg-white'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-black text-[#5D6B6B]">#{issue.number} {issue.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-black/58">{issue.bodyPreview}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-black/46">
                          <span>{issue.state}</span>
                          <span>{issue.author}</span>
                          <span>{formatDateTime(issue.updatedAt)}</span>
                          <span>{issue.commentsCount} comments</span>
                        </div>
                      </div>
                      {linkedTask ? (
                        <span className="shrink-0 rounded-full border border-[#F7CBCA]/18 bg-[#D5E5E5] px-2.5 py-1 text-xs font-black text-[#F7CBCA]">
                          converted
                        </span>
                      ) : null}
                    </div>
                    {issue.labels.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {issue.labels.slice(0, 6).map((label) => (
                          <span key={label} className="rounded-full border border-black/8 bg-white px-2 py-0.5 text-xs font-bold text-black/52">
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-black/7 bg-white/88 p-5">
          {!selectedIssue ? (
            <EmptyState icon={<Bug className="h-6 w-6" />} title="Select an issue" description="Open an issue to review details and create a pending task." />
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-black/10 bg-[#F1F7F7] px-2.5 py-1 text-xs font-black uppercase text-black/55">
                    {selectedIssue.state}
                  </span>
                  {selectedLink ? (
                    <span className="rounded-full border border-[#F7CBCA]/18 bg-[#D5E5E5] px-2.5 py-1 text-xs font-black uppercase text-[#F7CBCA]">
                      linked to task
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-xl font-black leading-snug text-[#5D6B6B]">
                  #{selectedIssue.number} {selectedIssue.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-black/58">
                  Opened by {selectedIssue.author} on {formatDateTime(selectedIssue.createdAt)}. Updated {formatDateTime(selectedIssue.updatedAt)}.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Labels" value={labelText(selectedIssue.labels)} />
                <Metric label="Comments" value={`${selectedIssue.commentsCount} comment(s). Comment bodies are not imported in this phase.`} />
                <Metric label="Suggested priority" value={suggestPriority(selectedIssue)} />
                <Metric label="Suggested agent" value={suggestAgent(selectedIssue)} />
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-black/42">Issue body</p>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-black/7 bg-[#F1F7F7]/72 p-4 text-sm leading-6 text-black/66">
                  {selectedIssue.body || 'No issue body provided.'}
                </pre>
              </div>

              <div className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4">
                <p className="font-black text-[#5D6B6B]">Recommended task title</p>
                <p className="mt-1 text-sm leading-6 text-black/62">[GitHub #{selectedIssue.number}] {selectedIssue.title}</p>
                <p className="mt-3 font-black text-[#5D6B6B]">Recommended task description</p>
                <p className="mt-1 text-sm leading-6 text-black/62">
                  Includes issue URL, labels, body, project name, expected analysis/fix goal, safety constraints, tests, and rollback request.
                </p>
              </div>

              {selectedLink ? (
                <Notice tone="success" title="This GitHub issue is already linked to an AgentFlow task.">
                  <Link href={`/dashboard/tasks/${selectedLink.task_id}`} className="font-black text-[#F7CBCA] underline">
                    Open linked task
                  </Link>
                </Notice>
              ) : actionState.taskId && actionState.link?.github_issue_number === selectedIssue.number ? (
                <Notice tone="success" title="Task created">
                  <Link href={`/dashboard/tasks/${actionState.taskId}`} className="font-black text-[#F7CBCA] underline">
                    Open linked task
                  </Link>
                </Notice>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <a href={selectedIssue.htmlUrl} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  <ExternalLink className="h-4 w-4" />
                  Open Issue
                </a>
                <Link
                  href={`/dashboard/safe-patch-planner?project=${projectId}&finding=${encodeURIComponent(`GitHub issue #${selectedIssue.number}: ${selectedIssue.title}\n${selectedIssue.htmlUrl}\nLabels: ${labelText(selectedIssue.labels)}\n\n${selectedIssue.body}`)}`}
                  className={buttonStyles({ variant: 'outline', size: 'sm' })}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Plan Safe Patch from Issue
                </Link>
                <Link
                  href={`/dashboard/prompt-library?query=${encodeURIComponent('GitHub issue')}`}
                  className={buttonStyles({ variant: 'ghost', size: 'sm' })}
                >
                  <FileText className="h-4 w-4" />
                  Prompt Library
                </Link>
              </div>

              <form
                action={formAction}
                onSubmit={(event) => {
                  if (
                    selectedLink ||
                    !window.confirm(
                      'This will create a pending AgentFlow task from this GitHub issue. It will not modify GitHub and will not run the task automatically.'
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="owner" value={owner} />
                <input type="hidden" name="repo" value={repo} />
                <input type="hidden" name="issueNumber" value={selectedIssue.number} />
                <input type="hidden" name="issueTitle" value={selectedIssue.title} />
                <input type="hidden" name="issueState" value={selectedIssue.state} />
                <input type="hidden" name="issueUrl" value={selectedIssue.htmlUrl} />
                <input type="hidden" name="issueBody" value={selectedIssue.body} />
                <input type="hidden" name="author" value={selectedIssue.author} />
                <input type="hidden" name="labels" value={selectedIssue.labels.join(',')} />
                <Button type="submit" disabled={isCreating || Boolean(selectedLink)}>
                  <CheckCircle2 className="h-4 w-4" />
                  {isCreating ? 'Creating Task...' : selectedLink ? 'Issue Already Linked' : 'Create Task from Issue'}
                </Button>
              </form>

              <p className="text-sm leading-6 text-black/54">
                This import is read-only. It does not close, comment on, edit, label, assign, or otherwise modify GitHub issues.
              </p>
            </div>
          )}
        </section>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-3">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold leading-6 text-black/68">{value || 'Not available'}</p>
    </div>
  );
}
