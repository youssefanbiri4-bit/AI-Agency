'use server';

import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import {
  getCurrentUserWorkspace,
  getCurrentWorkspaceMembership,
} from '@/lib/data/workspaces';
import { getBrandKitForWorkspace } from '@/lib/data/brand-kit';
import { listContentStudioItemsForWorkspace } from '@/lib/data/content-studio';
import { listProjectsForWorkspace, normalizeProjectMetadata } from '@/lib/data/projects';
import { listReleasesForWorkspace } from '@/lib/data/releases';
import { listBackupRecordsForWorkspace } from '@/lib/data/backup-records';
import { getSystemHealthSummary } from '@/lib/data/system-health';
import { listTasks } from '@/lib/data/tasks';
import { generateMarketingText } from '@/lib/ai/text-provider';
import { checkRateLimit } from '@/lib/rate-limit';
import { agentCatalog } from '@/data/agents';
import { buildSecurityCenterSummary } from '@/lib/security-center';
import type { ContentStudioItemWithAssets } from '@/lib/data/content-studio';
import type { ProjectRecord, ReleaseRecord } from '@/types/database';
import type { Task } from '@/types';

export interface AssistantLink {
  label: string;
  href: string;
}

export interface AssistantResponse {
  status: 'answered' | 'setup_required' | 'error';
  answer: string;
  links: AssistantLink[];
}

export interface AssistantChatHistoryMessage {
  role: 'assistant' | 'user';
  content: string;
}

const MAX_ASSISTANT_CONTEXT_CHARS = 4000;
const MAX_ASSISTANT_HISTORY_MESSAGES = 2;
const MAX_ARRAY_ITEMS = 3;
const TEXT_FIELD_CHARS = 300;
const PROVIDER_TEMPORARY_FAILURE_MESSAGE =
  'تعذر استعمال مزود الذكاء الاصطناعي حالياً. افتح Provider Setup أو جرّب لاحقاً.';

type AssistantIntent =
  | 'today'
  | 'provider_blockers'
  | 'system_health'
  | 'tasks_review'
  | 'scheduled_content'
  | 'instagram_campaign'
  | 'agents'
  | 'recovery'
  | 'projects'
  | 'reports'
  | 'general';

function sanitizeText(value: unknown, fallback = '') {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(access_token|refresh_token|client_secret|api_key|token|password|authorization)\s*[:=]\s*["']?[^"'\s,}]+/gi, '$1=[redacted]')
    .replace(/("(?:access_token|refresh_token|client_secret|api_key|token|password|authorization)"\s*:\s*)"[^"]+"/gi, '$1"[redacted]"')
    .trim();
}

function trimText(value: unknown, limit = TEXT_FIELD_CHARS, fallback = '') {
  const text = sanitizeText(value, fallback).replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function summarizeList<T>(items: T[], render: (item: T) => string, limit = MAX_ARRAY_ITEMS) {
  return items.slice(0, limit).map((item) => trimText(render(item), TEXT_FIELD_CHARS));
}

function detectAssistantIntent(question: string): AssistantIntent {
  const lower = question.toLowerCase();

  if (/what should i do today|today['’]?s procedures|today procedures|do today|today|next action|next actions|priorit|إجراءات اليوم|اجراءات اليوم|شنو خاصني ندير اليوم|خاصني ندير اليوم|اليوم/i.test(lower)) return 'today';
  if (/show provider blockers|provider blockers|provider setup status|provider setup|provider status|provider|blocker|blocked|setup|openai|meta|google|pinterest|quota|token/i.test(lower)) return 'provider_blockers';
  if (/summarize system health|system health|health|status|diagnostic|diagnose/i.test(lower)) return 'system_health';
  if (/tasks needing review|needs review|need review|مراجعة المهام|مهام.*مراجعة/i.test(lower)) return 'tasks_review';
  if (/scheduled content|ready content|content scheduled|المحتوى.*مجدول|المحتوى.*جاهز/i.test(lower)) return 'scheduled_content';
  if (/plan.*instagram|instagram.*campaign|write caption|generate ad copy|create content package|content plan|weekly content|post idea|reel|safe patch plan|code fix proposal|draft pr review|write documentation|explain strategy|campaign/i.test(lower)) return 'instagram_campaign';
  if (/agent|agents|how to use.*agent|explain.*agent/i.test(lower)) return 'agents';
  if (/recover|recovery|failed|error|broken|fix/i.test(lower)) return 'recovery';
  if (/project|software|release plan|github|deploy/i.test(lower)) return 'projects';
  if (/report|summary|release/i.test(lower)) return 'reports';

  return 'general';
}

function isLocalOperationalIntent(intent: AssistantIntent) {
  return [
    'today',
    'provider_blockers',
    'system_health',
    'tasks_review',
    'scheduled_content',
    'recovery',
  ].includes(intent);
}

function shouldLoadHealth(intent: AssistantIntent) {
  return ['today', 'provider_blockers', 'system_health', 'tasks_review', 'scheduled_content', 'recovery', 'general'].includes(intent);
}

function shouldLoadTasks(intent: AssistantIntent) {
  return ['today', 'provider_blockers', 'system_health', 'tasks_review', 'scheduled_content', 'recovery', 'agents', 'general'].includes(intent);
}

function shouldLoadContent(intent: AssistantIntent) {
  return ['today', 'provider_blockers', 'system_health', 'tasks_review', 'scheduled_content', 'instagram_campaign', 'recovery', 'general'].includes(intent);
}

function shouldLoadProjects(intent: AssistantIntent) {
  return ['projects', 'general'].includes(intent);
}

function shouldLoadReleases(intent: AssistantIntent) {
  return ['projects', 'reports', 'general'].includes(intent);
}

function shouldLoadBrandKit(intent: AssistantIntent) {
  return intent === 'instagram_campaign';
}

function shouldLoadSecurityAndBackups(intent: AssistantIntent) {
  return ['today', 'system_health', 'provider_blockers', 'recovery', 'reports', 'general'].includes(intent);
}

function joinLines(lines: Array<string | null | undefined>) {
  return lines.filter((line): line is string => Boolean(line?.trim())).join('\n');
}

function safeJsonCounts(counts: Record<string, number>) {
  return JSON.stringify(Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))));
}

function taskPriorityScore(task: Task) {
  const priority = String(task.priority).toLowerCase();
  if (priority === 'urgent') return 0;
  if (priority === 'high') return 1;
  if (task.status === 'needs_review') return 2;
  if (task.status === 'failed') return 3;
  return 4;
}

function summarizeTask(task: Task) {
  return `${trimText(task.title)} (${task.agent_type}, ${task.status}, ${task.priority})`;
}

function summarizeContentItem(item: ContentStudioItemWithAssets) {
  const status = item.provider_status ?? item.scheduled_execution_status ?? item.status;
  const blocker = item.provider_error ?? item.scheduled_execution_error;
  return `${trimText(item.title)} (${item.platform}, ${item.status}, provider ${status ?? 'not tracked'}${blocker ? `, ${trimText(blocker, 120)}` : ''})`;
}

function summarizeProject(project: ProjectRecord) {
  const metadata = normalizeProjectMetadata(project.metadata);
  const actions = metadata.next_actions.slice(0, 2).map((item) => trimText(item, 90)).join('; ') || 'no next actions';
  return `${trimText(project.name)} (${project.status}, ${project.priority}) - ${actions}`;
}

function summarizeRelease(release: ReleaseRecord) {
  return `${trimText(release.title)} (${release.status}, build ${release.build_status ?? 'n/a'}, typecheck ${release.typecheck_status ?? 'n/a'})`;
}

function chooseLinks(question: string): AssistantLink[] {
  const lower = question.toLowerCase();
  const links: AssistantLink[] = [];

  const add = (label: string, href: string) => {
    if (!links.some((link) => link.href === href)) links.push({ label, href });
  };

  if (/provider|setup|meta|google|pinterest|openai|ready|blocker/.test(lower)) {
    add('Open Provider Setup', '/dashboard/settings#provider-setup-wizard');
    add('Open System Health', '/dashboard/system-health');
  }

  if (/recover|failed|error|blocked|priority/.test(lower)) add('Open Recovery Center', '/dashboard/recovery');
  if (/content|instagram|facebook|pinterest|linkedin|campaign|weekly/.test(lower)) add('Open Content Studio', '/dashboard/content-studio');
  if (/project|software|plan|github|codebase/.test(lower)) add('Open Projects', '/dashboard/projects');
  if (/prompt|agent|task/.test(lower)) add('Open Prompt Library', '/dashboard/prompt-library');
  if (/report|summary|release/.test(lower)) add('Open Reports', '/dashboard/reports');
  if (/docs|how|explain|agent/.test(lower)) add('Open Docs', '/dashboard/docs');

  if (links.length === 0) {
    add('Open Dashboard', '/dashboard');
    add('Open System Health', '/dashboard/system-health');
    add('Open Projects', '/dashboard/projects');
  }

  return links.slice(0, 4);
}

function assistantFailureMessage(input: {
  status?: string;
  error?: string | null;
  contextError?: string | null;
}) {
  const error = (input.error ?? input.contextError ?? '').toLowerCase();

  if (input.contextError) {
    if (error.includes('unauthorized')) return 'يجب تسجيل الدخول لاستخدام المساعد.';
    if (error.includes('workspace')) return 'تعذر تحميل سياق مساحة العمل.';
    return 'تعذر تحميل سياق مساحة العمل.';
  }

  return PROVIDER_TEMPORARY_FAILURE_MESSAGE;
}

function isProviderContextOrTimeoutError(error?: string | null) {
  const text = (error ?? '').toLowerCase();

  return (
    text.includes('context') ||
    text.includes('token limit') ||
    text.includes('too long') ||
    text.includes('maximum context') ||
    text.includes('too many tokens') ||
    text.includes('request too large') ||
    text.includes('payload too large') ||
    text.includes('timed out') ||
    text.includes('timeout') ||
    text.includes('abort') ||
    text.includes('انتهت مهلة الاتصال')
  );
}

function formatCompactList(items: string[]) {
  return items.length ? items.slice(0, MAX_ARRAY_ITEMS).join(' || ') : 'none';
}

function formatArabicList(items: string[]) {
  return items.length ? items.slice(0, MAX_ARRAY_ITEMS).map((item) => `- ${item}`).join('\n') : '- لا توجد عناصر حالياً.';
}

function buildLocalOperationalAnswer(input: {
  intent: AssistantIntent;
  healthSummary: Awaited<ReturnType<typeof getSystemHealthSummary>> | null;
  taskByStatus: Record<string, number>;
  tasksNeedingReview: Task[];
  providerBlockers: string[];
  recoveryIssues: string[];
  scheduledContent: ContentStudioItemWithAssets[];
  backupStatus: string;
  securityStatus: string;
}) {
  const taskItems = summarizeList(input.tasksNeedingReview, summarizeTask);
  const contentItems = summarizeList(input.scheduledContent, summarizeContentItem);
  const hasActionData =
    taskItems.length > 0 ||
    input.providerBlockers.length > 0 ||
    input.recoveryIssues.length > 0 ||
    contentItems.length > 0;
  const healthLine = input.healthSummary
    ? `صحة النظام: ${input.healthSummary.score}% (${input.healthSummary.label}).`
    : 'صحة النظام: غير متاحة حالياً.';
  const taskCountsLine = `حالة المهام: ${safeJsonCounts(input.taskByStatus)}.`;
  const backupSecurityLine = `النسخ الاحتياطي والأمان: ${input.backupStatus}; ${input.securityStatus}.`;

  if (input.intent === 'provider_blockers') {
    return joinLines([
      'حالة المزودات',
      healthLine,
      'مشاكل المزودات:',
      formatArabicList(input.providerBlockers),
      'الخطوة التالية:',
      input.providerBlockers.length
        ? '- افتح Provider Setup وراجع أول مزود ظاهر في القائمة.'
        : '- لا توجد مشاكل مزودات ظاهرة حالياً.',
    ]);
  }

  if (input.intent === 'system_health') {
    return joinLines([
      'ملخص صحة النظام',
      healthLine,
      taskCountsLine,
      backupSecurityLine,
      'مشاكل الاسترجاع:',
      formatArabicList(input.recoveryIssues),
      'مشاكل المزودات:',
      formatArabicList(input.providerBlockers),
    ]);
  }

  if (input.intent === 'tasks_review') {
    return joinLines([
      'المهام التي تحتاج مراجعة',
      taskCountsLine,
      formatArabicList(taskItems),
      'الخطوة التالية:',
      taskItems.length ? '- افتح صفحة المهام وابدأ بأعلى أولوية.' : '- لا توجد مهام تحتاج مراجعة حالياً.',
    ]);
  }

  if (input.intent === 'scheduled_content') {
    return joinLines([
      'المحتوى الجاهز أو المجدول',
      formatArabicList(contentItems),
      'الخطوة التالية:',
      contentItems.length ? '- راجع المحتوى الجاهز قبل أي نشر يدوي.' : '- لا يوجد محتوى جاهز أو مجدول حالياً.',
    ]);
  }

  if (input.intent === 'recovery') {
    return joinLines([
      'مشاكل الاسترجاع',
      healthLine,
      formatArabicList(input.recoveryIssues),
      'الخطوة التالية:',
      input.recoveryIssues.length ? '- افتح Recovery Center وابدأ بالعنصر الأعلى أولوية.' : '- لا توجد مشاكل استرجاع عاجلة حالياً.',
    ]);
  }

  const nextStep = hasActionData
    ? '- ابدأ بمشكلة مزود أو مهمة مراجعة عالية الأولوية، ثم راجع المحتوى الجاهز.'
    : '- لا توجد إجراءات عاجلة حالياً.';

  return joinLines([
    'إجراءات اليوم المقترحة',
    healthLine,
    backupSecurityLine,
    '',
    '1. الأولوية العالية',
    hasActionData ? formatArabicList([...input.recoveryIssues, ...input.providerBlockers].slice(0, MAX_ARRAY_ITEMS)) : '- لا توجد إجراءات عاجلة حالياً.',
    '',
    '2. المهام التي تحتاج مراجعة',
    formatArabicList(taskItems),
    '',
    '3. مشاكل المزودات',
    formatArabicList(input.providerBlockers),
    '',
    '4. المحتوى الجاهز أو المجدول',
    formatArabicList(contentItems),
    '',
    '5. الخطوة التالية',
    nextStep,
  ]);
}

function buildUltraSmallContext(input: {
  question: string;
  providerBlockersCount: number;
  tasksNeedingReviewCount: number;
  recoveryIssuesCount: number;
}) {
  return joinLines([
    `Question: ${trimText(input.question)}`,
    `Provider blockers count: ${input.providerBlockersCount}`,
    `Tasks needing review count: ${input.tasksNeedingReviewCount}`,
    `Recovery issues count: ${input.recoveryIssuesCount}`,
  ]);
}

function buildSafeHistory(history: AssistantChatHistoryMessage[] = []) {
  return history
    .slice(-MAX_ASSISTANT_HISTORY_MESSAGES)
    .map((message) => `${message.role}: ${trimText(message.content)}`)
    .join('\n');
}

async function buildSafeAssistantContext(question: string) {
  const intent = detectAssistantIntent(question);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized user.', context: null };
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    return { error: 'No active workspace found.', context: null };
  }

  const membershipResult = await getCurrentWorkspaceMembership(
    supabase,
    workspaceResult.data.id,
    user.id
  );

  if (membershipResult.error || !membershipResult.data) {
    return {
      error: membershipResult.error ?? 'Workspace membership is required.',
      context: null,
    };
  }

  const workspaceId = workspaceResult.data.id;
  const [health, brandKitResult, contentResult, tasksResult, projectsResult, releasesResult, backupsResult, securityResult] =
    await Promise.all([
      shouldLoadHealth(intent)
        ? getSystemHealthSummary({ supabase, workspaceId, userId: user.id }).then((data) => ({ data, error: null }))
        : Promise.resolve({ data: null, error: null }),
      shouldLoadBrandKit(intent)
        ? getBrandKitForWorkspace(supabase, workspaceId)
        : Promise.resolve({ data: null, error: null, isConfigured: true }),
      shouldLoadContent(intent)
        ? listContentStudioItemsForWorkspace(workspaceId, supabase)
        : Promise.resolve({ data: [], error: null, isConfigured: true }),
      shouldLoadTasks(intent)
        ? listTasks({ workspaceId }, supabase)
        : Promise.resolve({ data: [], error: null, isConfigured: true }),
      shouldLoadProjects(intent)
        ? listProjectsForWorkspace(workspaceId, supabase)
        : Promise.resolve({ data: [], error: null, isConfigured: true }),
      shouldLoadReleases(intent)
        ? listReleasesForWorkspace(workspaceId, supabase)
        : Promise.resolve({ data: [], error: null, isConfigured: true }),
      shouldLoadSecurityAndBackups(intent)
        ? listBackupRecordsForWorkspace(workspaceId, supabase, 3)
        : Promise.resolve({ data: [], error: null, isConfigured: true }),
      shouldLoadSecurityAndBackups(intent)
        ? buildSecurityCenterSummary({ supabase, workspaceId })
            .then((data) => ({ data, error: null }))
            .catch((error) => ({ data: null, error: error instanceof Error ? error.message : 'Security summary unavailable.' }))
        : Promise.resolve({ data: null, error: null }),
    ]);

  const healthSummary = health.data;
  const content = contentResult.data;
  const tasks = tasksResult.data;
  const projects = projectsResult.data;
  const releases = releasesResult.data;
  const brandKit = brandKitResult.data?.brandKit ?? null;
  const contentByStatus = countBy(content.map((item) => item.status));
  const contentByPlatform = countBy(content.map((item) => item.platform));
  const taskByStatus = countBy(tasks.map((task) => task.status));
  const projectByStatus = countBy(projects.map((project) => project.status));
  const releaseByStatus = countBy(releases.map((release) => release.status));
  const providerBlockers = healthSummary?.providers
    .filter((provider) => provider.status !== 'ready' && provider.status !== 'manual_only')
    .slice(0, MAX_ARRAY_ITEMS)
    .map((provider) => `${provider.name}: ${provider.status} - ${provider.details.slice(0, 2).map((detail) => trimText(detail, 120)).join('; ')}`) ?? [];
  const recoveryIssues = healthSummary?.actions
    .slice(0, MAX_ARRAY_ITEMS)
    .map((action) => `${action.priority}: ${trimText(action.title)} - ${trimText(action.reason, 120)}`) ?? [];
  const tasksNeedingReview = tasks
    .filter((task) => ['needs_review', 'failed', 'pending', 'processing'].includes(task.status))
    .slice()
    .sort((a, b) => taskPriorityScore(a) - taskPriorityScore(b))
    .slice(0, MAX_ARRAY_ITEMS);
  const blockedContent = content
    .filter((item) =>
      ['failed', 'setup_required', 'approval_pending', 'token_missing', 'quota_limit', 'unsupported', 'error'].includes(item.status) ||
      ['failed', 'setup_required', 'approval_pending', 'token_missing', 'quota_limit', 'unsupported', 'error'].includes(item.provider_status ?? '') ||
      item.scheduled_execution_status === 'failed'
    )
    .slice(0, MAX_ARRAY_ITEMS);
  const scheduledContent = content
    .filter((item) => item.status === 'scheduled' || item.status === 'ready' || Boolean(item.schedule_at))
    .slice(0, MAX_ARRAY_ITEMS);
  const projectAttention = projects
    .filter((project) => ['active', 'needs_review', 'paused', 'ready_to_deploy'].includes(project.status))
    .slice(0, MAX_ARRAY_ITEMS);
  const agentDepartments = countBy(agentCatalog.map((agent) => agent.department));
  const dataNotices = [
    brandKitResult.error,
    contentResult.error,
    tasksResult.error,
    projectsResult.error,
    releasesResult.error,
    backupsResult.error,
    securityResult.error,
    healthSummary?.dataNotice,
  ].filter(Boolean).map((item) => trimText(item, 160));

  const commonLines = [
    `Workspace: ${trimText(workspaceResult.data.name, 120)}`,
    `Intent: ${intent}`,
    `Context budget: max ${MAX_ASSISTANT_CONTEXT_CHARS} characters; arrays capped at ${MAX_ARRAY_ITEMS} items; text fields capped at ${TEXT_FIELD_CHARS} characters.`,
  ];

  const todayLines = intent === 'today'
    ? [
        `Tasks by status: ${safeJsonCounts(taskByStatus)}`,
        `Top 3 tasks needing review: ${formatCompactList(summarizeList(tasksNeedingReview, summarizeTask))}`,
        `Top 3 provider blockers: ${formatCompactList(providerBlockers)}`,
        `Top 3 recovery issues: ${formatCompactList(recoveryIssues)}`,
        `Top 3 scheduled/ready content items: ${formatCompactList(summarizeList(scheduledContent, summarizeContentItem))}`,
      ]
    : [];

  const healthLines = healthSummary
    ? [
        `System Health: ${healthSummary.score}% (${healthSummary.label}); blockers ${providerBlockers.length}; critical recovery blockers ${healthSummary.metrics.recovery.criticalBlockers}.`,
        `Provider blockers top 3: ${formatCompactList(providerBlockers)}`,
        `Recovery issues top 3: ${formatCompactList(recoveryIssues)}`,
      ]
    : [];

  const taskLines = tasks.length
    ? [
        `Tasks by status: ${safeJsonCounts(taskByStatus)}`,
        `Top tasks needing review/action: ${formatCompactList(summarizeList(tasksNeedingReview, summarizeTask))}`,
      ]
    : [];

  const contentLines = content.length
    ? [
        `Content counts by status: ${safeJsonCounts(contentByStatus)}`,
        `Content counts by platform: ${safeJsonCounts(contentByPlatform)}`,
        `Top blocked content items: ${formatCompactList(summarizeList(blockedContent, summarizeContentItem))}`,
      ]
    : [];

  const projectLines = projects.length
    ? [
        `Projects by status: ${safeJsonCounts(projectByStatus)}`,
        `Top active/needs-review projects: ${formatCompactList(summarizeList(projectAttention, summarizeProject))}`,
      ]
    : [];

  const releaseLines = releases.length
    ? [
        `Releases by status: ${safeJsonCounts(releaseByStatus)}`,
        `Latest releases top 3: ${formatCompactList(summarizeList(releases, summarizeRelease))}`,
      ]
    : [];

  const brandLines = brandKit
    ? [
        `Brand kit: ${[brandKit.brandName, brandKit.offer, brandKit.targetAudience, brandKit.toneOfVoice, brandKit.defaultCta].map((item) => trimText(item, 120)).filter(Boolean).join(' | ')}`,
        `Campaign defaults: platforms ${brandKit.campaignDefaults.defaultPlatforms.slice(0, MAX_ARRAY_ITEMS).join(', ') || 'not set'}; objective ${trimText(brandKit.campaignDefaults.defaultObjective, 80, 'not set')}; style ${trimText(brandKit.campaignDefaults.defaultPostingStyle, 80, 'not set')}`,
      ]
    : [];

  const agentLines = intent === 'agents'
    ? [
        `Agents summary: ${agentCatalog.length} configured catalog agents across ${Object.keys(agentDepartments).length} departments.`,
        `Agents by department: ${safeJsonCounts(agentDepartments)}`,
        `Agent examples top 3: ${formatCompactList(summarizeList(agentCatalog, (agent) => `${agent.name} (${agent.department}) - ${agent.capabilities.slice(0, 2).join(', ')}`))}`,
      ]
    : [];

  const backupSecurityLines = shouldLoadSecurityAndBackups(intent)
    ? [
        `Backup status: ${backupsResult.data.length ? `latest ${backupsResult.data[0]?.status} at ${backupsResult.data[0]?.created_at}; records loaded ${backupsResult.data.length}` : 'no backup records loaded'}`,
        securityResult.data
          ? `Security summary: score ${securityResult.data.score}%; critical ${securityResult.data.counts.critical}; high ${securityResult.data.counts.high}; next ${trimText(securityResult.data.nextRecommendedAction, 160)}`
          : null,
      ]
    : [];
  const backupStatus = backupsResult.data.length
    ? `آخر نسخة ${trimText(backupsResult.data[0]?.status, 80, 'unknown')} في ${trimText(backupsResult.data[0]?.created_at, 80, 'unknown')}`
    : 'لا توجد سجلات نسخ احتياطي محملة';
  const securityStatus = securityResult.data
    ? `درجة الأمان ${securityResult.data.score}%، التالي ${trimText(securityResult.data.nextRecommendedAction, 120)}`
    : 'ملخص الأمان غير متاح حالياً';

  const context = joinLines([
    ...(intent === 'today' ? todayLines : commonLines),
    ...(intent === 'today' ? [] : healthLines),
    ...(intent === 'today' ? [] : taskLines),
    ...(intent === 'today' ? [] : contentLines),
    ...(intent === 'today' ? [] : projectLines),
    ...(intent === 'today' ? [] : releaseLines),
    ...(intent === 'today' ? [] : brandLines),
    ...(intent === 'today' ? [] : agentLines),
    ...(intent === 'today' ? [] : backupSecurityLines),
    intent === 'today' ? null : dataNotices.length ? `Data notices: ${dataNotices.join(' | ')}` : 'Data notices: none',
  ]);

  const localOperationalAnswer = buildLocalOperationalAnswer({
    intent,
    healthSummary,
    taskByStatus,
    tasksNeedingReview,
    providerBlockers,
    recoveryIssues,
    scheduledContent,
    backupStatus,
    securityStatus,
  });
  const ultraSmallContext = buildUltraSmallContext({
    question,
    providerBlockersCount: providerBlockers.length,
    tasksNeedingReviewCount: tasksNeedingReview.length,
    recoveryIssuesCount: recoveryIssues.length,
  });

  return {
    error: null,
    intent,
    context: context.length <= MAX_ASSISTANT_CONTEXT_CHARS ? context : null,
    contextTooLong: context.length > MAX_ASSISTANT_CONTEXT_CHARS,
    localOperationalAnswer,
    ultraSmallContext,
  };
}

export async function askAgentFlowAssistantAction(
  question: string,
  history: AssistantChatHistoryMessage[] = []
): Promise<AssistantResponse> {
  const cleanQuestion = sanitizeText(question);
  const safeHistory = buildSafeHistory(history);

  if (cleanQuestion.length < 3) {
    return {
      status: 'error',
      answer: 'Please ask a more specific question.',
      links: [{ label: 'Open Docs', href: '/dashboard/docs' }],
    };
  }

  const contextResult = await buildSafeAssistantContext(cleanQuestion);

  if (contextResult.error) {
    return {
      status: 'error',
      answer: assistantFailureMessage({ contextError: contextResult.error }),
      links: [
        { label: 'Open System Health', href: '/dashboard/system-health' },
        { label: 'Open Docs', href: '/dashboard/docs' },
      ],
    };
  }

  const intent = contextResult.intent ?? 'general';

  if (isLocalOperationalIntent(intent)) {
    return {
      status: 'answered',
      answer: contextResult.localOperationalAnswer ?? 'لا توجد إجراءات عاجلة حالياً.',
      links: chooseLinks(cleanQuestion),
    };
  }

  if (!contextResult.context) {
    return {
      status: 'answered',
      answer: contextResult.localOperationalAnswer ?? 'تعذر تلخيص سياق مساحة العمل حالياً.',
      links: chooseLinks(cleanQuestion),
    };
  }

  const limiter = await checkRateLimit({
    key: `assistant:${contextResult.context.slice(0, 120)}`,
    limit: 20,
    windowMs: 60 * 1000,
  });

  if (!limiter.allowed) {
    return {
      status: 'error',
      answer: 'Please slow down and try again in a moment.',
      links: [{ label: 'Open System Health', href: '/dashboard/system-health' }],
    };
  }

  const result = await generateMarketingText({
    kind: 'agentflow_in_app_assistant',
    systemPrompt: [
      'You are AgentFlow Assistant inside a SaaS dashboard for one manager/operator.',
      'Answer briefly and directly. Do not use long reasoning.',
      'Answer operational questions using only the safe workspace context provided.',
      'Be concise, practical, and manager-focused. Use Arabic if the user asks Arabic; English if English; if unsure, Arabic is acceptable.',
      'The context is intentionally compact and intent-scoped. Do not ask for a shorter question when data is missing; answer from the available summary.',
      'Never claim actions were executed. Never publish content, create live ads, run scheduler, run tasks, push to GitHub, edit code, delete data, or expose secrets.',
      'If data is missing, say it needs review. Recommend safe next actions and pages to open.',
      'Never output API keys, tokens, passwords, refresh tokens, client secrets, or raw provider responses.',
    ].join('\n'),
    userPrompt: [
      'Safe workspace context:',
      contextResult.context,
      '',
      safeHistory ? `Recent chat history, last ${MAX_ASSISTANT_HISTORY_MESSAGES} messages only:\n${safeHistory}\n` : '',
      'Manager question:',
      cleanQuestion,
      '',
      'Answer with useful next actions. Mention limitations when relevant.',
    ].join('\n'),
    maxTokens: 360,
    temperature: 0.2,
  });

  if (result.status !== 'generated') {
    if (isProviderContextOrTimeoutError(result.error) && contextResult.ultraSmallContext) {
      const retryResult = await generateMarketingText({
        kind: 'agentflow_in_app_assistant_retry',
        systemPrompt: [
          'You are AgentFlow Assistant. Answer briefly from the ultra-small operational counts only.',
          'Answer briefly and directly. Do not use long reasoning.',
          'Use Arabic if the user asks Arabic; English if English.',
          'Never expose secrets and never claim actions were executed.',
        ].join('\n'),
        userPrompt: [
          'Ultra-small context:',
          contextResult.ultraSmallContext,
          '',
          'Manager question:',
          cleanQuestion,
        ].join('\n'),
        maxTokens: 150,
        temperature: 0.1,
      });

      if (retryResult.status === 'generated') {
        return {
          status: 'answered',
          answer: sanitizeText(retryResult.text, contextResult.localOperationalAnswer),
          links: chooseLinks(cleanQuestion),
        };
      }

      return {
        status: 'answered',
        answer: contextResult.localOperationalAnswer ?? 'تعذر تلخيص سياق مساحة العمل حالياً.',
        links: chooseLinks(cleanQuestion),
      };
    }

    return {
      status: result.status === 'setup_required' ? 'setup_required' : 'error',
      answer: assistantFailureMessage({ status: result.status, error: result.error }),
      links: [
        { label: 'Open Provider Setup', href: '/dashboard/settings#provider-setup-wizard' },
        { label: 'Open System Health', href: '/dashboard/system-health' },
        { label: 'Open Docs', href: '/dashboard/docs' },
      ],
    };
  }

  return {
    status: 'answered',
    answer: sanitizeText(result.text, 'تعذر إنشاء رد واضح الآن. افتح صحة النظام للتحقق من الإعداد.'),
    links: chooseLinks(cleanQuestion),
  };
}
