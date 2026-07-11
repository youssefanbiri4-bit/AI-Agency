import 'server-only';

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
  getSupabaseAdmin,
} from '@/lib/supabase-server';
import {
  getCurrentUserWorkspace,
  getCurrentWorkspaceMembership,
} from '@/lib/data/workspaces';
import { getDashboardData, type DashboardData } from '@/lib/data/dashboard';
import { listContentStudioItemsForWorkspace, type ContentStudioItemWithAssets } from '@/lib/data/content-studio';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { departmentScope } from '@/lib/data/department-scope';
import type { Department } from '@/types/auth';
import { listProjectsForWorkspace } from '@/lib/data/projects';
import { listReleasesForWorkspace } from '@/lib/data/releases';
import { getMetaConnectionStatus, getGoogleAdsConnectionStatus } from '@/lib/data/ad-connections';
import { emptyDataResult, errorDataResult, type DataResult } from '@/lib/data/types';
import { taskService } from '@/lib/tasks/task-service';
import { normalizeWorkspaceRole, type StrictWorkspaceRole } from '@/lib/workspace-permissions';
import { getAgentStats, getTaskStats } from '@/lib/stats';
import { logger } from '@/lib/logger';
import type { Database, ContentStudioPublishAttemptRecord, CreativeAssetRecord, ProjectRecord, ReleaseRecord } from '@/types/database';
import type { Task } from '@/types';

const dashboardDataLog = logger.child('dashboard:get-data');

export const DASHBOARD_SECTION_TIMEOUT_MS = 3500;
export const DASHBOARD_PROVIDER_TIMEOUT_MS = 2500;

import type {
  DashboardActivityItem,
  DashboardTaskPreview,
  DashboardViewMode,
  PersonalizedDeptStats,
} from '@/lib/dashboard/dashboard-types';

export type {
  DashboardActivityItem,
  DashboardTaskPreview,
  DashboardViewMode,
  PersonalizedDeptStats,
} from '@/lib/dashboard/dashboard-types';

export interface PersonalizedDashboardPayload {
  welcomeName: string;
  myTasks: DashboardTaskPreview[];
  deptStats: PersonalizedDeptStats;
  recentActivity: DashboardActivityItem[];
  errors: string[];
}

export interface DashboardPageContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  userEmail: string | null;
  welcomeName: string;
  workspaceId: string | null;
  role: StrictWorkspaceRole;
  viewMode: DashboardViewMode;
}

function resolveWelcomeName(metadata: Record<string, unknown> | undefined, email: string | null) {
  const fullName = metadata?.full_name;
  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim().split(' ')[0] ?? fullName.trim();
  }

  const emailPrefix = email?.split('@')[0]?.trim();
  return emailPrefix || 'there';
}

export function resolveDashboardViewMode(role: StrictWorkspaceRole): DashboardViewMode {
  if (role === 'owner' || role === 'admin' || role === 'operator') {
    return 'command_center';
  }

  return 'personalized';
}

function timeoutMessage(sectionName: string) {
  return `${sectionName} did not respond quickly enough. Showing a safe fallback.`;
}

async function withDashboardTimeout<T>(
  sectionName: string,
  promise: Promise<T>,
  timeoutMs = DASHBOARD_SECTION_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const guardedPromise = promise.catch((error: unknown) => {
    dashboardDataLog.warn(`failed ${sectionName}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage(sectionName)));
    }, timeoutMs);
  });

  try {
    return await Promise.race([guardedPromise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function settledDataResult<T>(
  result: PromiseSettledResult<DataResult<T>>,
  fallbackData: T,
  sectionName: string
): DataResult<T> {
  if (result.status === 'fulfilled') {
    return result.value;
  }

  return errorDataResult(fallbackData, timeoutMessage(sectionName));
}

async function listRecentPublishAttempts(workspaceId: string) {
  const { client, error } = getSupabaseAdmin(DASHBOARD_PROVIDER_TIMEOUT_MS);

  if (!client) {
    return errorDataResult(
      [] as ContentStudioPublishAttemptRecord[],
      error ?? 'Supabase admin client is not configured.'
    );
  }

  const { data, error: selectError } = await client
    .from('content_studio_publish_attempts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(6);

  if (selectError) {
    return errorDataResult([], selectError.message);
  }

  return emptyDataResult((data ?? []) as ContentStudioPublishAttemptRecord[], true);
}

function toTaskPreview(task: Task): DashboardTaskPreview {
  return {
    id: task.id,
    title: task.title || task.description || 'Untitled task',
    status: task.status || 'pending',
    href: `/dashboard/tasks/${task.id}`,
    updatedAt: task.updated_at,
  };
}

function buildRecentActivity(tasks: Task[], contentItems: ContentStudioItemWithAssets[]): DashboardActivityItem[] {
  const taskActivity = tasks.map((task) => ({
    id: `task-${task.id}`,
    title: task.title || 'Untitled task',
    kind: 'task' as const,
    status: task.status,
    href: `/dashboard/tasks/${task.id}`,
    at: task.updated_at,
  }));

  const contentActivity = contentItems.map((item) => ({
    id: `content-${item.id}`,
    title: item.title,
    kind: 'content' as const,
    status: item.status,
    href: `/dashboard/content-studio?item=${item.id}`,
    at: item.updated_at,
  }));

  return [...taskActivity, ...contentActivity]
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, 6);
}

async function countReadyContent(
  workspaceId: string,
  client: SupabaseClient<Database>,
  scope: Department[] | null
) {
  const result = await listContentStudioItemsForWorkspace(workspaceId, client, {
    departmentScope: scope,
    limit: 200,
  });

  if (result.error) {
    dashboardDataLog.warn('ready content count failed', {
      workspaceId,
      error: result.error,
    });
    return 0;
  }

  return (result.data ?? []).filter((item) => item.status === 'ready').length;
}

async function countUserTasks(workspaceId: string, userId: string, client: SupabaseClient<Database>) {
  const { count, error } = await client
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) {
    dashboardDataLog.warn('user task count failed', { workspaceId, userId, error: error.message });
    return 0;
  }

  return count ?? 0;
}

export const getDashboardPageContext = cache(async (): Promise<DashboardPageContext | null> => {
  const supabase = await createSupabaseServerClient({
    fetchTimeoutMs: DASHBOARD_PROVIDER_TIMEOUT_MS,
  });

  const authResult = await withDashboardTimeout(
    'dashboard auth',
    supabase.auth.getUser(),
    DASHBOARD_PROVIDER_TIMEOUT_MS
  ).catch(() => ({ data: { user: null } }));

  const user = authResult.data.user;
  if (!user) {
    return null;
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await withDashboardTimeout(
    'workspace context',
    getCurrentUserWorkspace(supabase, activeWorkspaceId)
  ).catch(() => errorDataResult(null, timeoutMessage('workspace context')));

  const workspaceId = workspaceResult.data?.id ?? null;
  let role: StrictWorkspaceRole = 'viewer';

  if (workspaceId) {
    const membershipResult = await withDashboardTimeout(
      'membership',
      getCurrentWorkspaceMembership(supabase, workspaceId, user.id)
    ).catch(() => errorDataResult(null, timeoutMessage('membership')));

    role = normalizeWorkspaceRole(
      membershipResult.data?.role,
      workspaceResult.data,
      user.id
    );
  }

  return {
    supabase,
    userId: user.id,
    userEmail: user.email ?? null,
    welcomeName: resolveWelcomeName(user.user_metadata as Record<string, unknown>, user.email ?? null),
    workspaceId,
    role,
    viewMode: resolveDashboardViewMode(role),
  };
});

export async function fetchPersonalizedDashboardData(
  ctx: DashboardPageContext
): Promise<PersonalizedDashboardPayload> {
  const errors: string[] = [];

  if (!ctx.workspaceId) {
    return {
      welcomeName: ctx.welcomeName,
      myTasks: [],
      deptStats: { yourTasks: 0, readyInDept: 0, needsReview: 0 },
      recentActivity: [],
      errors: ['Workspace is required to load dashboard data.'],
    };
  }

  const scope = await departmentScope();
  const settled = await Promise.allSettled([
    withDashboardTimeout('my tasks', taskService.listMyTasks({ limit: 8 })),
    withDashboardTimeout('dept scoped tasks', taskService.listTasksForCurrentUser({ limit: 50 })),
    withDashboardTimeout(
      'recent content',
      listContentStudioItemsForWorkspace(ctx.workspaceId, ctx.supabase, {
        limit: 6,
        departmentScope: scope,
      })
    ),
    withDashboardTimeout(
      'user task count',
      countUserTasks(ctx.workspaceId, ctx.userId, ctx.supabase)
    ).catch(() => 0),
    withDashboardTimeout(
      'ready content count',
      countReadyContent(ctx.workspaceId, ctx.supabase, scope)
    ).catch(() => 0),
  ]);

  const myTasksResult =
    settled[0].status === 'fulfilled'
      ? settled[0].value
      : errorDataResult([] as Task[], timeoutMessage('my tasks'));
  const scopedTasksResult =
    settled[1].status === 'fulfilled'
      ? settled[1].value
      : errorDataResult([] as Task[], timeoutMessage('dept scoped tasks'));
  const contentResult =
    settled[2].status === 'fulfilled'
      ? settled[2].value
      : errorDataResult([] as ContentStudioItemWithAssets[], timeoutMessage('recent content'));
  const yourTasksCount = settled[3].status === 'fulfilled' ? settled[3].value : 0;
  const readyCount = settled[4].status === 'fulfilled' ? settled[4].value : 0;

  for (const [label, result] of [
    ['my tasks', myTasksResult],
    ['dept scoped tasks', scopedTasksResult],
    ['recent content', contentResult],
  ] as const) {
    if (result.error) {
      errors.push(result.error);
    }
  }

  const myTasks = (myTasksResult.data ?? []).map(toTaskPreview);
  const scopedTasks = scopedTasksResult.data ?? [];
  const contentItems = contentResult.data ?? [];

  return {
    welcomeName: ctx.welcomeName,
    myTasks,
    deptStats: {
      yourTasks: typeof yourTasksCount === 'number' ? yourTasksCount : myTasks.length,
      readyInDept: typeof readyCount === 'number' ? readyCount : 0,
      needsReview: scopedTasks.filter((task) => task.status === 'needs_review').length,
    },
    recentActivity: buildRecentActivity(myTasksResult.data ?? [], contentItems),
    errors,
  };
}

export interface CommandCenterBundle {
  dashboard: DataResult<DashboardData>;
  contentItems: DataResult<ContentStudioItemWithAssets[]>;
  creativeAssets: DataResult<CreativeAssetRecord[]>;
  publishAttempts: DataResult<ContentStudioPublishAttemptRecord[]>;
  projects: DataResult<ProjectRecord[]>;
  releases: DataResult<ReleaseRecord[]>;
  membership: DataResult<Awaited<ReturnType<typeof getCurrentWorkspaceMembership>>['data']>;
  metaConnection: DataResult<Awaited<ReturnType<typeof getMetaConnectionStatus>>['data'] | null>;
  googleAdsConnection: DataResult<Awaited<ReturnType<typeof getGoogleAdsConnectionStatus>>['data'] | null>;
  scopedTasks: DataResult<Task[]>;
}

function buildEmptyDashboardData(): DashboardData {
  const agents: DashboardData['agents'] = [];
  const tasks: DashboardData['tasks'] = [];

  return {
    agents,
    departments: [],
    tasks,
    events: [],
    agentStats: getAgentStats(agents),
    taskStats: getTaskStats(tasks),
  };
}

export async function fetchCommandCenterBundle(ctx: DashboardPageContext): Promise<CommandCenterBundle> {
  const workspaceId = ctx.workspaceId;
  const emptyDashboard = buildEmptyDashboardData();

  if (!workspaceId) {
    const workspaceRequired = 'Workspace is required.';
    const empty = errorDataResult(null, workspaceRequired);
    return {
      dashboard: errorDataResult(emptyDashboard, workspaceRequired),
      contentItems: errorDataResult([], workspaceRequired),
      creativeAssets: errorDataResult([], workspaceRequired),
      publishAttempts: errorDataResult([], workspaceRequired),
      projects: errorDataResult([], workspaceRequired),
      releases: errorDataResult([], workspaceRequired),
      membership: empty,
      metaConnection: errorDataResult(null, workspaceRequired),
      googleAdsConnection: errorDataResult(null, workspaceRequired),
      scopedTasks: errorDataResult([], workspaceRequired),
    };
  }

  const scope = await departmentScope();
  const sections = await Promise.allSettled([
    withDashboardTimeout('dashboard data', getDashboardData(workspaceId, ctx.supabase, { departmentScope: scope })),
    withDashboardTimeout(
      'content catalog',
      listContentStudioItemsForWorkspace(workspaceId, ctx.supabase, {
        limit: 24,
        departmentScope: scope,
      })
    ),
    withDashboardTimeout(
      'creative assets',
      listCreativeAssetsForWorkspace(workspaceId, undefined, ctx.supabase, {
        limit: 24,
        includeSignedUrls: false,
        departmentScope: scope,
      })
    ),
    withDashboardTimeout('publish attempts', listRecentPublishAttempts(workspaceId)),
    withDashboardTimeout('projects', listProjectsForWorkspace(workspaceId, ctx.supabase, { limit: 12 })),
    withDashboardTimeout('releases', listReleasesForWorkspace(workspaceId, ctx.supabase, { limit: 12 })),
    withDashboardTimeout(
      'membership',
      getCurrentWorkspaceMembership(ctx.supabase, workspaceId, ctx.userId)
    ),
    withDashboardTimeout('meta connection status', getMetaConnectionStatus(workspaceId, ctx.userId)),
    withDashboardTimeout('google ads connection status', getGoogleAdsConnectionStatus(workspaceId, ctx.userId)),
    withDashboardTimeout('scoped tasks', taskService.listTasksForCurrentUser({ limit: 12 })),
  ]);

  return {
    dashboard: settledDataResult(
      sections[0] as PromiseSettledResult<DataResult<DashboardData>>,
      emptyDashboard,
      'dashboard data'
    ),
    contentItems: settledDataResult(
      sections[1] as PromiseSettledResult<DataResult<ContentStudioItemWithAssets[]>>,
      [],
      'content catalog'
    ),
    creativeAssets: settledDataResult(
      sections[2] as PromiseSettledResult<DataResult<CreativeAssetRecord[]>>,
      [],
      'creative assets'
    ),
    publishAttempts: settledDataResult(
      sections[3] as PromiseSettledResult<DataResult<ContentStudioPublishAttemptRecord[]>>,
      [],
      'publish attempts'
    ),
    projects: settledDataResult(
      sections[4] as PromiseSettledResult<DataResult<ProjectRecord[]>>,
      [],
      'projects'
    ),
    releases: settledDataResult(
      sections[5] as PromiseSettledResult<DataResult<ReleaseRecord[]>>,
      [],
      'releases'
    ),
    membership: settledDataResult(
      sections[6] as PromiseSettledResult<DataResult<Awaited<ReturnType<typeof getCurrentWorkspaceMembership>>['data']>>,
      null,
      'membership'
    ),
    metaConnection: settledDataResult(
      sections[7] as PromiseSettledResult<DataResult<Awaited<ReturnType<typeof getMetaConnectionStatus>>['data'] | null>>,
      null,
      'meta connection status'
    ),
    googleAdsConnection: settledDataResult(
      sections[8] as PromiseSettledResult<DataResult<Awaited<ReturnType<typeof getGoogleAdsConnectionStatus>>['data'] | null>>,
      null,
      'google ads connection status'
    ),
    scopedTasks: settledDataResult(
      sections[9] as PromiseSettledResult<DataResult<Task[]>>,
      [],
      'scoped tasks'
    ),
  };
}

export function collectCommandCenterErrors(bundle: CommandCenterBundle, workspaceError?: string | null) {
  return [
    workspaceError,
    bundle.dashboard.error,
    bundle.contentItems.error,
    bundle.creativeAssets.error,
    bundle.publishAttempts.error,
    bundle.projects.error,
    bundle.releases.error,
    bundle.membership.error,
    bundle.metaConnection.error,
    bundle.googleAdsConnection.error,
    bundle.scopedTasks.error,
  ].filter((value): value is string => Boolean(value));
}