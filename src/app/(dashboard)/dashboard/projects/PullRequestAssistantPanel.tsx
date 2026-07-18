'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Clipboard,
  ExternalLink,
  FileText,
  GitPullRequest,
  ListChecks,
  RefreshCcw,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  TestTube,
} from 'lucide-react';
import type { GitHubPullRequestsResult, GitHubIntegrationStatus } from '@/lib/github';
import type { PullRequestReviewRecord } from '@/lib/data/pull-request-reviews';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import { useActionToast } from '@/hooks/useActionToast';
import { cn, formatDateTime } from '@/lib/utils';
import {
  createReleaseDraftFromPullRequestReviewAction,
  createTasksFromPullRequestReviewAction,
  generatePullRequestReviewAction,
  type PullRequestAssistantState,
} from './pull-request-actions';

interface PullRequestAssistantPanelProps {
  projectId: string;
  owner: string | null;
  repo: string | null;
  savedUrl: string | null;
  pullRequestsResult: GitHubPullRequestsResult | null;
  reviews: PullRequestReviewRecord[];
  reviewsError: string | null;
}

type StateFilter = 'open' | 'closed' | 'all';
type ReviewFilter = 'all' | 'reviewed' | 'not_reviewed';

const initialState: PullRequestAssistantState = {
  error: null,
  message: null,
  review: null,
  report: null,
  taskIds: [],
  releaseId: null,
};

function statusForGitHub(status: GitHubIntegrationStatus): Parameters<typeof StatusBadge>[0]['status'] {
  if (status === 'ready') return 'ready';
  if (status === 'setup_required') return 'setup_required';
  if (status === 'rate_limited') return 'quota_limit';
  return 'error';
}

function reportFromReview(review: PullRequestReviewRecord | null | undefined): PullRequestReviewReport | null {
  const report = review?.metadata?.report;
  return report && typeof report === 'object' && !Array.isArray(report) ? (report as unknown as PullRequestReviewReport) : null;
}

type PullRequestReviewReport = NonNullable<PullRequestAssistantState['report']>;

function markdownFromReport(report: PullRequestReviewReport) {
  const files = [
    '| File | Change type | Risk | Notes |',
    '| --- | --- | --- | --- |',
    ...report.filesChanged.map((file) =>
      `| ${file.file.replace(/\|/g, '/')} | ${file.changeType} | ${file.risk} | ${file.notes.replace(/\|/g, '/')} |`
    ),
  ];

  return [
    '# Pull Request Review',
    '',
    `Generated: ${report.generatedAt}`,
    `Risk level: ${report.riskLevel}`,
    `Recommendation: ${report.recommendation.replace(/_/g, ' ')}`,
    '',
    '## A. Executive Summary',
    ...report.executiveSummary.map((item) => `- ${item}`),
    '',
    '## B. Files Changed',
    ...files,
    '',
    '## C. Risk Assessment',
    `- UI risk: ${report.riskAssessment.ui}`,
    `- Data risk: ${report.riskAssessment.data}`,
    `- Provider risk: ${report.riskAssessment.provider}`,
    `- Scheduler risk: ${report.riskAssessment.scheduler}`,
    `- Security risk: ${report.riskAssessment.security}`,
    `- Migration risk: ${report.riskAssessment.migration}`,
    `- Deployment risk: ${report.riskAssessment.deployment}`,
    ...report.riskAssessment.notes.map((item) => `- ${item}`),
    '',
    '## D. Potential Issues',
    ...report.potentialIssues.map((item) => `- ${item}`),
    '',
    '## E. Security Review',
    ...report.securityReview.map((item) => `- ${item}`),
    '',
    '## F. Regression Checklist',
    ...report.regressionChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## G. Testing Checklist',
    ...report.testingChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## H. Release Notes Draft',
    report.releaseNotesDraft,
    '',
    '## I. Suggested Follow-up Tasks',
    ...report.followUpTasks.map((item) => `- ${item}`),
    '',
    '## J. Final Recommendation',
    report.finalRecommendation,
  ].join('\n');
}

function markdownFor(review: PullRequestReviewRecord | null, report: PullRequestReviewReport | null) {
  if (report) return markdownFromReport(report);
  if (typeof review?.metadata?.markdown === 'string') return review.metadata.markdown;
  return review?.review_summary ?? '';
}

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}.`);
  }
}

export function PullRequestAssistantPanel({
  projectId,
  owner,
  repo,
  savedUrl,
  pullRequestsResult,
  reviews,
  reviewsError,
}: PullRequestAssistantPanelProps) {
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('open');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const pulls = useMemo(() => pullRequestsResult?.pullRequests ?? [], [pullRequestsResult?.pullRequests]);
  const [selectedPrNumber, setSelectedPrNumber] = useState<number | null>(pulls[0]?.number ?? null);
  const [generateState, generateAction, isGenerating] = useActionState(generatePullRequestReviewAction, initialState);
  const [tasksState, tasksAction, isCreatingTasks] = useActionState(createTasksFromPullRequestReviewAction, initialState);
  const [releaseState, releaseAction, isCreatingRelease] = useActionState(createReleaseDraftFromPullRequestReviewAction, initialState);
  const reviewByPr = useMemo(() => new Map(reviews.map((review) => [review.pr_number, review])), [reviews]);
  const generatedReview = generateState.review;
  const selectedPr = pulls.find((pull) => pull.number === selectedPrNumber) ?? pulls[0] ?? null;
  const selectedReview = (selectedPr ? reviewByPr.get(selectedPr.number) : null) ?? (generatedReview?.pr_number === selectedPr?.number ? generatedReview : null);
  const selectedReport = generateState.report && generatedReview?.pr_number === selectedPr?.number
    ? generateState.report
    : reportFromReview(selectedReview);
  const fullReview = markdownFor(selectedReview, selectedReport);
  const filteredPulls = useMemo(
    () =>
      pulls.filter((pull) => {
        if (stateFilter !== 'all' && pull.state !== stateFilter) return false;
        const reviewed = reviewByPr.has(pull.number) || generatedReview?.pr_number === pull.number;
        if (reviewFilter === 'reviewed' && !reviewed) return false;
        if (reviewFilter === 'not_reviewed' && reviewed) return false;
        if (query.trim()) {
          const haystack = [pull.title, pull.author, pull.sourceBranch, pull.targetBranch, pull.body, ...pull.labels].join(' ').toLowerCase();
          if (!haystack.includes(query.trim().toLowerCase())) return false;
        }
        return true;
      }),
    [generatedReview?.pr_number, pulls, query, reviewByPr, reviewFilter, stateFilter]
  );

  useActionToast({
    isPending: isGenerating,
    state: generateState,
    loadingMessage: 'Generating pull request review...',
    successMessage: (state) => state.message ?? 'PR review generated.',
    errorMessage: (state) => state.error ?? 'Could not generate PR review.',
  });

  useActionToast({
    isPending: isCreatingTasks,
    state: tasksState,
    loadingMessage: 'Creating pending follow-up tasks...',
    successMessage: (state) => state.message ?? 'Follow-up tasks created.',
    errorMessage: (state) => state.error ?? 'Could not create follow-up tasks.',
  });

  useActionToast({
    isPending: isCreatingRelease,
    state: releaseState,
    loadingMessage: 'Creating release draft...',
    successMessage: (state) => state.message ?? 'Release draft created.',
    errorMessage: (state) => state.error ?? 'Could not create release draft.',
  });

  if (!owner || !repo) {
    return (
      <Card>
        <CardHeader title="Pull Request Assistant" description="Review GitHub pull requests safely before merge decisions." />
        <EmptyState
          icon={<GitPullRequest className="h-6 w-6" />}
          title="No GitHub repository linked to this project"
          description="Add a GitHub repository URL in the project form to load pull requests safely."
          action={<Link href="#edit-project" className={buttonStyles({ variant: 'secondary' })}>Add GitHub Repository</Link>}
        />
      </Card>
    );
  }

  const status = pullRequestsResult?.status ?? 'setup_required';

  return (
    <Card>
      <CardHeader
        title="Pull Request Assistant"
        description="Read-only PR review and reporting. No GitHub approvals, merges, comments, commits, deploys, or task execution."
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
        <Metric label="Open PRs" value={String(pullRequestsResult?.repo?.openPullRequestsCount ?? pulls.filter((pull) => pull.state === 'open').length)} />
        <Metric label="Saved reviews" value={String(reviews.length)} />
        <Metric label="Not reviewed loaded" value={String(Math.max(0, pulls.filter((pull) => !reviewByPr.has(pull.number)).length))} />
      </div>

      {reviewsError ? <Notice tone="warning" title="PR review history unavailable">{reviewsError}</Notice> : null}
      {status !== 'ready' ? (
        <Notice tone={status === 'setup_required' ? 'warning' : 'danger'} title={pullRequestsResult?.message ?? 'GitHub setup required'}>
          {pullRequestsResult?.message ?? 'GitHub setup required. Add a read-only server-side token to load pull requests.'}
        </Notice>
      ) : null}
      <Notice tone="info" title="Review before generating">
        Review PR content before generating a review. Do not include secrets in PR descriptions or code.
      </Notice>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_170px]">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, branch, author" className="ps-9" />
            </div>
            <Select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as StateFilter)}>
              <option value="open">Open PRs</option>
              <option value="closed">Closed PRs</option>
              <option value="all">All loaded</option>
            </Select>
            <Select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)}>
              <option value="all">All review states</option>
              <option value="not_reviewed">Not reviewed</option>
              <option value="reviewed">Reviewed</option>
            </Select>
          </div>

          {filteredPulls.length === 0 ? (
            <EmptyState icon={<GitPullRequest className="h-6 w-6" />} title="No pull requests match" description={pulls.length ? 'Adjust filters or refresh PR data.' : 'No pull requests were returned by GitHub.'} />
          ) : (
            <div className="space-y-3">
              {filteredPulls.map((pull) => {
                const review = reviewByPr.get(pull.number);
                const active = selectedPr?.number === pull.number;
                return (
                  <button
                    key={pull.id}
                    type="button"
                    onClick={() => setSelectedPrNumber(pull.number)}
                    className={cn('w-full rounded-lg border p-4 text-left transition-colors', active ? 'border-[#F7CBCA]/32 bg-[#D5E5E5]/45' : 'border-black/7 bg-[#F1F7F7]/70 hover:bg-white')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-black text-[#5D6B6B]">#{pull.number} {pull.title}</p>
                        <p className="mt-1 text-sm leading-6 text-black/58">{pull.sourceBranch} to {pull.targetBranch}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-black/46">
                          <span>{pull.state}</span>
                          {pull.draft ? <span>draft</span> : null}
                          <span>{pull.author}</span>
                          <span>{formatDateTime(pull.updatedAt)}</span>
                          {pull.changedFiles !== null ? <span>{pull.changedFiles} files</span> : null}
                        </div>
                      </div>
                      {review ? (
                        <span className="shrink-0 rounded-full border border-[#F7CBCA]/18 bg-[#D5E5E5] px-2.5 py-1 text-xs font-black text-[#F7CBCA]">
                          {review.risk_level}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-black/7 bg-white/88 p-5">
          {!selectedPr ? (
            <EmptyState icon={<GitPullRequest className="h-6 w-6" />} title="Select a pull request" description="Open a PR to review metadata and generate a saved report." />
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-black/10 bg-[#F1F7F7] px-2.5 py-1 text-xs font-black uppercase text-black/55">{selectedPr.state}</span>
                  {selectedPr.draft ? <span className="rounded-full border border-[#E7F5DC]/35 bg-[#E7F5DC]/20 px-2.5 py-1 text-xs font-black uppercase text-[#8A4300]">draft</span> : null}
                  {selectedReview ? <span className="rounded-full border border-[#F7CBCA]/18 bg-[#D5E5E5] px-2.5 py-1 text-xs font-black uppercase text-[#F7CBCA]">reviewed</span> : null}
                </div>
                <h3 className="mt-3 text-xl font-black leading-snug text-[#5D6B6B]">#{selectedPr.number} {selectedPr.title}</h3>
                <p className="mt-2 text-sm leading-6 text-black/58">
                  {selectedPr.author} / {selectedPr.sourceBranch} to {selectedPr.targetBranch} / updated {formatDateTime(selectedPr.updatedAt)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Changed files" value={selectedPr.changedFiles === null ? 'Unknown' : String(selectedPr.changedFiles)} />
                <Metric label="Additions / deletions" value={`+${selectedPr.additions ?? 0} / -${selectedPr.deletions ?? 0}`} />
                <Metric label="Risk level" value={selectedReview?.risk_level ?? selectedReport?.riskLevel ?? 'Not reviewed'} />
                <Metric label="Recommendation" value={(selectedReview?.recommendation ?? selectedReport?.recommendation ?? 'Not reviewed').replace(/_/g, ' ')} />
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-black/42">PR body</p>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-black/7 bg-[#F1F7F7]/72 p-4 text-sm leading-6 text-black/66">
                  {selectedPr.body || 'No PR body provided.'}
                </pre>
              </div>

              <div className="flex flex-wrap gap-2">
                <a href={selectedPr.htmlUrl} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  <ExternalLink className="h-4 w-4" />
                  Open PR
                </a>
                <Link
                  href={`/dashboard/safe-patch-planner?project=${projectId}&context=${encodeURIComponent(`Pull request #${selectedPr.number}: ${selectedPr.title}\n${selectedPr.htmlUrl}\n${selectedPr.sourceBranch} -> ${selectedPr.targetBranch}\n\n${selectedReview?.review_summary ?? selectedPr.body}`)}`}
                  className={buttonStyles({ variant: 'outline', size: 'sm' })}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Create Safe Patch Plan
                </Link>
              </div>

              <form action={generateAction}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="owner" value={owner} />
                <input type="hidden" name="repo" value={repo} />
                <input type="hidden" name="prNumber" value={selectedPr.number} />
                <Button type="submit" disabled={isGenerating}>
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? 'Generating...' : 'Generate PR Review'}
                </Button>
              </form>

              {selectedReview || selectedReport ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void copyText('Full PR review', fullReview)}>
                      <Clipboard className="h-4 w-4" />
                      Copy Full PR Review
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void copyText('Testing checklist', selectedReview?.testing_checklist ?? selectedReport?.testingChecklist.join('\n') ?? '')}>
                      <TestTube className="h-4 w-4" />
                      Copy Testing Checklist
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void copyText('Release notes draft', selectedReview?.release_notes_draft ?? selectedReport?.releaseNotesDraft ?? '')}>
                      <Rocket className="h-4 w-4" />
                      Copy Release Notes Draft
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void copyText('Security review', selectedReview?.security_notes ?? selectedReport?.securityReview.join('\n') ?? '')}>
                      <ShieldCheck className="h-4 w-4" />
                      Copy Security Review
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void copyText('Follow-up tasks', selectedReport?.followUpTasks.join('\n') ?? 'Create code review, testing, security, and documentation follow-up tasks as needed.')}>
                      <ListChecks className="h-4 w-4" />
                      Copy Follow-up Tasks
                    </Button>
                  </div>

                  <section className="rounded-lg border border-black/7 bg-[#5D6B6B] p-4">
                    <h3 className="font-black text-[#D5E5E5]">Saved PR Review</h3>
                    <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-6 text-[#F1F7F7]">{fullReview}</pre>
                  </section>

                  {selectedReview ? (
                    <div className="flex flex-wrap gap-2">
                      <form
                        action={tasksAction}
                        onSubmit={(event) => {
                          if (!window.confirm('This will create pending AgentFlow tasks from the PR review findings. It will not run tasks automatically and will not modify GitHub.')) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="reviewId" value={selectedReview.id} />
                        <Button type="submit" variant="outline" disabled={isCreatingTasks}>
                          <ListChecks className="h-4 w-4" />
                          {isCreatingTasks ? 'Creating Tasks...' : 'Create Tasks from Review'}
                        </Button>
                      </form>
                      <form
                        action={releaseAction}
                        onSubmit={(event) => {
                          if (!window.confirm('Create a draft release from this PR review? This will not deploy, merge, approve, or modify GitHub.')) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="reviewId" value={selectedReview.id} />
                        <Button type="submit" variant="outline" disabled={isCreatingRelease}>
                          <FileText className="h-4 w-4" />
                          {isCreatingRelease ? 'Creating Release...' : 'Create Release Draft'}
                        </Button>
                      </form>
                      {releaseState.releaseId ? (
                        <Link href={`/dashboard/releases/${releaseState.releaseId}`} className={buttonStyles({ variant: 'secondary' })}>
                          Open Release Draft
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
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
