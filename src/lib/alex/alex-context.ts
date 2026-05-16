import 'server-only';

import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listTasks } from '@/lib/data/tasks';
import { listContentStudioItemsForWorkspace } from '@/lib/data/content-studio';
import { listProjectsForWorkspace } from '@/lib/data/projects';
import { listReleasesForWorkspace } from '@/lib/data/releases';
import { listBackupRecordsForWorkspace } from '@/lib/data/backup-records';
import { checkOpenAITextProviderReadiness } from '@/lib/ai/text-provider';

export interface AlexWorkspaceContext {
  workspaceName: string;
  tasksSummary: string;
  tasksNeedingReview: number;
  providerBlockers: string[];
  contentSummary: string;
  projectsSummary: string;
  securitySummary: string;
  backupSummary: string;
  recoveryIssues: string[];
  latestReleases: string;
  openAIStatus: 'ready' | 'setup_required' | 'error';
  openAIModel: string;
  dataNotice: string | null;
}

function trimText(value: unknown, limit = 300, fallback = '') {
  const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= limit) return cleaned;
  return cleaned.slice(0, Math.max(0, limit - 1)).trim() + '…';
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function safeJsonCounts(counts: Record<string, number>) {
  return JSON.stringify(Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))));
}

export async function getAlexWorkspaceContext(): Promise<AlexWorkspaceContext> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return buildEmptyContext('Authentication required.');
    }
    const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
    const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
    if (!workspaceResult.data) {
      return buildEmptyContext('No active workspace found.');
    }
    const workspaceId = workspaceResult.data.id;
    const openAIReadiness = checkOpenAITextProviderReadiness();
    const [tasksResult, contentResult, projectsResult, releasesResult, backupsResult] = await Promise.all([
      listTasks({ workspaceId }, supabase).catch(() => ({ data: [], error: null, isConfigured: true })),
      listContentStudioItemsForWorkspace(workspaceId, supabase).catch(() => ({ data: [], error: null, isConfigured: true })),
      listProjectsForWorkspace(workspaceId, supabase).catch(() => ({ data: [], error: null, isConfigured: true })),
      listReleasesForWorkspace(workspaceId, supabase).catch(() => ({ data: [], error: null, isConfigured: true })),
      listBackupRecordsForWorkspace(workspaceId, supabase, 3).catch(() => ({ data: [], error: null, isConfigured: true })),
    ]);
    const tasks = tasksResult.data ?? [];
    const contentItems = contentResult.data ?? [];
    const projects = projectsResult.data ?? [];
    const releases = releasesResult.data ?? [];
    const backups = backupsResult.data ?? [];
    const taskByStatus = countBy(tasks.map((t) => t.status));
    const contentByStatus = countBy(contentItems.map((c) => c.status));
    const projectByStatus = countBy(projects.map((p) => p.status));
    const releaseByStatus = countBy(releases.map((r) => r.status));
    const tasksNeedingReview = tasks.filter((t) => t.status === 'needs_review').length;
    const recoveryIssues: string[] = [];
    const providerBlockers: string[] = [];
    const errors = [
      tasksResult.error,
      contentResult.error,
      projectsResult.error,
      releasesResult.error,
      backupsResult.error,
    ].filter(Boolean).map((e) => trimText(e, 160));
    const dataNotice = errors.length > 0 ? errors.join('; ') : null;
    return {
      workspaceName: workspaceResult.data.name,
      tasksSummary: `Tasks by status: ${safeJsonCounts(taskByStatus)}. Total: ${tasks.length}.`,
      tasksNeedingReview,
      providerBlockers,
      contentSummary: `Content by status: ${safeJsonCounts(contentByStatus)}. Total: ${contentItems.length}.`,
      projectsSummary: `Projects by status: ${safeJsonCounts(projectByStatus)}. Total: ${projects.length}.`,
      securitySummary: 'Security Center and Production Operations are available from the dashboard for current launch-gate status.',
      backupSummary: backups.length > 0 ? `Latest backup: ${backups[0]?.status} at ${backups[0]?.created_at ?? 'unknown'}. Total records: ${backups.length}.` : 'No backup records found.',
      recoveryIssues,
      latestReleases: `Releases by status: ${safeJsonCounts(releaseByStatus)}. Latest: ${releases[0] ? trimText(releases[0].title, 120) : 'none'}.`,
      openAIStatus: openAIReadiness.isReady ? 'ready' : 'setup_required',
      openAIModel: openAIReadiness.model,
      dataNotice,
    };
  } catch {
    return buildEmptyContext('Failed to build workspace context.');
  }
}

function buildEmptyContext(reason: string): AlexWorkspaceContext {
  return {
    workspaceName: 'Unknown',
    tasksSummary: 'not available',
    tasksNeedingReview: 0,
    providerBlockers: [],
    contentSummary: 'not available',
    projectsSummary: 'not available',
    securitySummary: 'not available',
    backupSummary: 'not available',
    recoveryIssues: [],
    latestReleases: 'not available',
    openAIStatus: 'error',
    openAIModel: 'unknown',
    dataNotice: reason,
  };
}

export function getAlexOpenAIStatus(): { keyPresent: boolean; model: string; status: 'ready' | 'setup_required' | 'error' } {
  const readiness = checkOpenAITextProviderReadiness();
  return {
    keyPresent: readiness.isReady,
    model: readiness.model,
    status: readiness.isReady ? 'ready' : 'setup_required',
  };
}
