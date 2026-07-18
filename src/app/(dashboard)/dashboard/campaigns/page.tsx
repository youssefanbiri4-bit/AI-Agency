import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import {
  CheckCircle2,
  Clock3,
  Megaphone,
  RadioTower,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import {
  getGoogleAdsCampaignMetricsForWorkspace,
  getGoogleAdsConnectionStatus,
  getMetaConnectionStatus,
  type GoogleAdsCampaignMetricsForWorkspaceData,
  type GoogleAdsConnectionStatusData,
} from '@/lib/data/ad-connections';
import {
  getPinterestConfigReadiness,
  type PinterestConfigReadiness,
} from '@/lib/ads/pinterest';
import {
  getGoogleAdsConfigReadiness,
  type GoogleAdsConfigReadiness,
} from '@/lib/ads/google-ads';
import { listAgentCatalog } from '@/lib/data/agents';
import { listTasks } from '@/features/tasks/data/tasks';
import { extractStructuredOutput } from '@/lib/task-results';
import { cn, formatDateTime } from '@/lib/utils';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Agent, Task } from '@/types';
import {
  CampaignsClient,
  type CampaignBoardItem,
  type CampaignReportItem,
  type PendingCampaignTaskItem,
} from './CampaignsClient';
import { GoogleAdsAccounts } from './GoogleAdsAccounts';
import { MetaAdAccounts } from './MetaAdAccounts';

const campaignPrefixes = [
  '[Campaign Planner]',
  '[Performance Analyzer]',
  '[Manual Campaign Tracker]',
  '[Meta Campaign Analysis]',
  '[Google Ads Campaign Analysis]',
] as const;

function isCampaignTask(task: Task) {
  return campaignPrefixes.some((prefix) => task.title.startsWith(prefix));
}

function truncatePreview(value: string, length = 220) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > length ? `${normalized.slice(0, length).trim()}...` : normalized;
}

function getAgentName(task: Task, agents: Agent[]) {
  return agents.find((agent) => agent.id === task.agent_type)?.name ?? task.agent_type;
}

function getSingleSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildCampaignReports(tasks: Task[], agents: Agent[]): CampaignReportItem[] {
  return tasks
    .flatMap((task): CampaignReportItem[] => {
      if (!isCampaignTask(task) || !task.result) {
        return [];
      }

      if (task.status !== 'completed' && task.status !== 'needs_review') {
        return [];
      }

      const structuredOutput = extractStructuredOutput(task.result);

      if (!structuredOutput) {
        return [];
      }

      return [
        {
          taskId: task.id,
          title: task.title,
          status: task.status,
          agentName: getAgentName(task, agents),
          updatedAt: task.updated_at,
          updatedLabel: formatDateTime(task.updated_at),
          summaryPreview: truncatePreview(structuredOutput.summary || task.description),
          href: `/dashboard/tasks/${task.id}`,
        },
      ];
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 6);
}

function buildPendingCampaignTasks(tasks: Task[], agents: Agent[]): PendingCampaignTaskItem[] {
  return tasks
    .filter((task) => isCampaignTask(task) && task.status === 'pending')
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, 4)
    .map((task) => ({
      taskId: task.id,
      title: task.title,
      status: 'pending' as const,
      agentName: getAgentName(task, agents),
      updatedLabel: formatDateTime(task.updated_at),
      href: `/dashboard/tasks/${task.id}`,
    }));
}

function formatMissingPinterestEnv(readiness: PinterestConfigReadiness) {
  return readiness.missingEnvironmentVariables.length > 0
    ? readiness.missingEnvironmentVariables.join(', ')
    : 'PINTEREST_APP_SECRET';
}

function formatMissingGoogleAdsEnv(readiness: GoogleAdsConfigReadiness) {
  return readiness.missingEnvironmentVariables.length > 0
    ? readiness.missingEnvironmentVariables.join(', ')
    : 'GOOGLE_ADS_CLIENT_SECRET';
}

const notConnectedGoogleAdsConnection: GoogleAdsConnectionStatusData = {
  provider: 'google_ads',
  status: 'not_connected',
  scopes: [],
  connectedAt: null,
  updatedAt: null,
  tokenExpiresAt: null,
};

const notConnectedGoogleAdsCampaignMetrics: GoogleAdsCampaignMetricsForWorkspaceData = {
  state: 'not_connected',
  customers: [],
};

const campaignButtonClassName =
  'border-[#F7CBCA] bg-gradient-to-r from-[#F7CBCA] to-[#F7CBCA] text-white shadow-[0_16px_34px_rgba(202,40,81,0.24)] hover:border-[#5D6B6B] hover:from-[#5D6B6B] hover:to-[#F7CBCA] hover:text-white';

const campaignOutlineButtonClassName =
  'border-[#5D6B6B]/12 bg-[#F1F7F7] text-[#5D6B6B] hover:border-[#F7CBCA]/35 hover:bg-[#D5E5E5]/55 hover:text-[#F7CBCA]';

function getGoogleAdsVisibleCampaignCount(metrics: GoogleAdsCampaignMetricsForWorkspaceData) {
  if (metrics.state !== 'connected') {
    return 0;
  }

  return metrics.customers.reduce((total, customer) => total + customer.campaigns.length, 0);
}

function getGoogleAdsBoardItems(
  metrics: GoogleAdsCampaignMetricsForWorkspaceData
): CampaignBoardItem[] {
  if (metrics.state !== 'connected') {
    return [];
  }

  return metrics.customers.flatMap((customer) =>
    customer.campaigns.slice(0, 8).map((campaign) => ({
      id: `google-${customer.customerId}-${campaign.campaignId}`,
      title: campaign.campaignName?.trim() || 'Google Ads campaign',
      platform: 'google_ads' as const,
      status:
        campaign.status?.toLowerCase() === 'enabled'
          ? 'ready'
          : campaign.status?.toLowerCase() === 'paused'
            ? 'draft'
            : 'approval_pending',
      providerReadiness: 'Ready',
      updatedLabel: campaign.endDate || campaign.startDate || 'Last 30 days',
      linkedCount: 1,
      href: '/dashboard/campaigns',
      actionLabel: 'Review Metrics',
    }))
  );
}

function buildCampaignBoardItems({
  campaignReports,
  pendingCampaignTasks,
  googleAdsCampaignMetrics,
  metaIsConnected,
  pinterestReadiness,
}: {
  campaignReports: CampaignReportItem[];
  pendingCampaignTasks: PendingCampaignTaskItem[];
  googleAdsCampaignMetrics: GoogleAdsCampaignMetricsForWorkspaceData;
  metaIsConnected: boolean;
  pinterestReadiness: PinterestConfigReadiness;
}): CampaignBoardItem[] {
  const reportItems: CampaignBoardItem[] = campaignReports.map((report) => ({
    id: `report-${report.taskId}`,
    title: report.title,
    platform: 'manual' as const,
    status: report.status === 'completed' ? 'published' : 'ready',
    providerReadiness: 'Manual-only',
    updatedLabel: report.updatedLabel,
    linkedCount: 1,
    href: report.href,
    actionLabel: 'Open Report',
  }));
  const draftItems: CampaignBoardItem[] = pendingCampaignTasks.map((task) => ({
    id: `pending-${task.taskId}`,
    title: task.title,
    platform: 'manual' as const,
    status: 'draft' as const,
    providerReadiness: 'Manual-only',
    updatedLabel: task.updatedLabel,
    linkedCount: 1,
    href: task.href,
    actionLabel: 'Open Draft',
  }));
  const providerItems: CampaignBoardItem[] = [
    {
      id: 'provider-meta',
      title: 'Meta Ads / Instagram & Facebook',
      platform: 'instagram',
      status: metaIsConnected ? 'ready' : 'setup_required',
      providerReadiness: metaIsConnected ? 'Ready' : 'Meta setup required',
      updatedLabel: 'Provider readiness',
      href: '/dashboard/campaigns',
      actionLabel: metaIsConnected ? 'View Accounts' : 'Connect Meta',
    },
    {
      id: 'provider-pinterest',
      title: 'Pinterest Ads',
      platform: 'pinterest',
      status: pinterestReadiness.isConfigured ? 'approval_pending' : 'setup_required',
      providerReadiness: pinterestReadiness.isConfigured
        ? 'Approval pending'
        : 'Pinterest setup required',
      updatedLabel: 'Provider readiness',
      href: '/dashboard/campaigns',
      actionLabel: pinterestReadiness.isConfigured ? 'Connect Pinterest' : 'Setup Required',
    },
  ];

  return [
    ...getGoogleAdsBoardItems(googleAdsCampaignMetrics),
    ...reportItems,
    ...draftItems,
    ...providerItems,
  ].slice(0, 16);
}

function CampaignHero({
  activeCount,
  draftCount,
  scheduledCount,
  setupRequiredCount,
}: {
  activeCount: number;
  draftCount: number;
  scheduledCount: number;
  setupRequiredCount: number;
}) {
  const chips = [
    { label: 'Active', value: activeCount },
    { label: 'Drafts', value: draftCount },
    { label: 'Scheduled', value: scheduledCount },
    { label: 'Setup Required', value: setupRequiredCount },
  ];

  return (
    <section className="relative overflow-hidden rounded-lg bg-[#5D6B6B] p-6 text-white shadow-[0_24px_58px_rgba(93,107,107,0.22)] sm:p-8">
      <div className="absolute inset-0 bg-gradient-to-br from-[#F7CBCA] via-[#F7CBCA] to-[#E7F5DC] opacity-95" />
      <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.6fr)] lg:items-end">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white/82 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Ads & Growth
          </div>
          <h1 className="mt-5 break-words text-4xl font-black tracking-normal sm:text-5xl">
            Campaigns
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/86">
            Track ad performance, provider readiness, and campaign status across channels.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {chips.map((chip) => (
            <div
              key={chip.label}
              className="rounded-lg border border-white/16 bg-[#5D6B6B]/28 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur"
            >
              <p className="text-2xl font-black">{chip.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-white/72">
                {chip.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CampaignMetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'berry',
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  tone?: 'berry' | 'coral' | 'peach' | 'dark' | 'cream';
}) {
  const toneClassNames = {
    berry: 'from-[#F7CBCA] to-[#F7CBCA] text-white',
    coral: 'from-[#F7CBCA] to-[#E7F5DC] text-white',
    peach: 'from-[#E7F5DC] to-[#D5E5E5] text-[#5D6B6B]',
    dark: 'from-[#5D6B6B] to-[#3A2028] text-white',
    cream: 'from-[#D5E5E5] to-[#F1F7F7] text-[#5D6B6B]',
  };

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-lg border border-[#5D6B6B]/8 bg-[#F1F7F7] p-5 shadow-[0_18px_50px_rgba(93,107,107,0.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(202,40,81,0.16)]">
      <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', toneClassNames[tone])} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#5D6B6B]/56">{title}</p>
          <p className="mt-2 break-words text-3xl font-black tracking-normal text-[#5D6B6B]">
            {value}
          </p>
        </div>
        <div className={cn('rounded-lg bg-gradient-to-br p-3 shadow-sm', toneClassNames[tone])}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#5D6B6B]/58">{subtitle}</p>
    </article>
  );
}

function PinterestAdsConnectionCard({
  readiness,
}: {
  readiness: PinterestConfigReadiness;
}) {
  const isConfigured = readiness.isConfigured;

  return (
    <div className="mt-4 flex min-w-0 flex-col gap-5 rounded-lg border border-[#5D6B6B]/8 bg-[#F1F7F7] p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-base font-bold text-black">
            Pinterest Ads
          </h3>
          <StatusBadge
            status={isConfigured ? 'Not Connected' : 'Setup Required'}
            type="system"
            size="sm"
          />
        </div>
        <p className="mt-2 text-sm leading-6 text-black/58">
          Read-only Pinterest Ads provider foundation. Actual connection stays disabled until the server environment is complete.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-black/42">
            <span className="rounded-full border border-[#5D6B6B]/10 bg-white px-2.5 py-1">
              Scopes: {readiness.scopes.join(', ')}
            </span>
          {!isConfigured && (
            <span className="rounded-full border border-[#F7CBCA]/18 bg-[#D5E5E5]/42 px-2.5 py-1 text-[#F7CBCA]">
              Missing environment variables: {formatMissingPinterestEnv(readiness)}
            </span>
          )}
        </div>
      </div>

      {isConfigured ? (
        <Link
          href="/api/ads/pinterest/connect"
          className={buttonStyles({ variant: 'primary', className: campaignButtonClassName })}
        >
          Connect Pinterest Ads
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className={buttonStyles({ variant: 'outline', className: campaignOutlineButtonClassName })}
        >
          Setup in Vercel first
        </button>
      )}
    </div>
  );
}

function GoogleAdsConnectionCard({
  readiness,
  connection,
  campaignMetrics,
}: {
  readiness: GoogleAdsConfigReadiness;
  connection: GoogleAdsConnectionStatusData;
  campaignMetrics: GoogleAdsCampaignMetricsForWorkspaceData;
}) {
  const isConfigured = readiness.isConfigured;
  const needsReconnect =
    connection.status === 'expired' ||
    connection.status === 'revoked' ||
    connection.status === 'error' ||
    campaignMetrics.state === 'token_invalid';
  const isConnected =
    isConfigured && connection.status === 'connected' && !needsReconnect;
  const badgeStatus = !isConfigured
    ? 'Setup Required'
    : isConnected
      ? 'Ready'
      : connection.status === 'not_connected'
        ? 'Not Connected'
        : 'Setup Required';
  const actionLabel = needsReconnect
    ? 'Reconnect Google Ads'
    : connection.status === 'not_connected'
      ? 'Connect Google Ads'
      : null;

  return (
    <div className="mt-4 min-w-0 rounded-lg border border-[#5D6B6B]/8 bg-[#F1F7F7] p-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-bold text-black">
              Google Ads
            </h3>
            <StatusBadge
              status={badgeStatus}
              type="system"
              size="sm"
            />
          </div>
          <p className="mt-2 text-sm leading-6 text-black/58">
            Read-only Google Ads connection for accessible customer accounts, campaigns, and last 30 days metrics. Publishing stays disabled.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-black/42">
            <span className="rounded-full border border-[#5D6B6B]/10 bg-white px-2.5 py-1">
              Scope: {readiness.scopes.join(', ')}
            </span>
            {!isConfigured && (
              <span className="rounded-full border border-[#F7CBCA]/18 bg-[#D5E5E5]/42 px-2.5 py-1 text-[#F7CBCA]">
                Missing environment variables: {formatMissingGoogleAdsEnv(readiness)}
              </span>
            )}
            {connection.connectedAt && (
              <span className="rounded-full border border-[#5D6B6B]/10 bg-white px-2.5 py-1">
                Connected {formatDateTime(connection.connectedAt)}
              </span>
            )}
          </div>
        </div>

        {isConfigured && actionLabel ? (
          <Link
            href="/api/ads/google/connect"
            className={buttonStyles({
              variant: actionLabel.startsWith('Reconnect') ? 'outline' : 'primary',
              className: actionLabel.startsWith('Reconnect')
                ? campaignOutlineButtonClassName
                : campaignButtonClassName,
            })}
          >
            {actionLabel}
          </Link>
        ) : !isConfigured ? (
          <button
          type="button"
          disabled
          className={buttonStyles({ variant: 'outline', className: campaignOutlineButtonClassName })}
        >
            Setup in Vercel first
          </button>
        ) : null}
      </div>

      {isConnected && <GoogleAdsAccounts data={campaignMetrics} />}

      {needsReconnect && (
        <p className="mt-4 text-sm leading-6 text-black/58">
          Reconnect Google Ads before campaign metrics can be displayed.
        </p>
      )}
    </div>
  );
}

interface CampaignsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const params = await searchParams;
  const metaParam = getSingleSearchParam(params, 'meta');
  const pinterestParam = getSingleSearchParam(params, 'pinterest');
  const googleAdsParam = getSingleSearchParam(params, 'google_ads');
  const pinterestReadiness = getPinterestConfigReadiness();
  const googleAdsReadiness = getGoogleAdsConfigReadiness();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;
  const [
    catalogResult,
    tasksResult,
    metaConnectionResult,
    googleAdsConnectionResult,
    googleAdsCampaignMetricsResult,
  ] = await Promise.all([
    listAgentCatalog(supabase),
    workspaceId
      ? listTasks({ workspaceId, limit: 500 }, supabase)
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
    workspaceId && user?.id
      ? getMetaConnectionStatus(workspaceId, user.id)
      : Promise.resolve({
          data: {
            provider: 'meta' as const,
            status: 'not_connected' as const,
            scopes: [] as string[],
            connectedAt: null,
            updatedAt: null,
            tokenExpiresAt: null,
            adAccountId: null,
            adAccountName: null,
            metadata: {},
          },
          error: null,
          isConfigured: true,
        }),
    workspaceId && user?.id
      ? getGoogleAdsConnectionStatus(workspaceId, user.id)
      : Promise.resolve({
          data: notConnectedGoogleAdsConnection,
          error: null,
          isConfigured: true,
        }),
    workspaceId && user?.id && googleAdsReadiness.isConfigured
      ? getGoogleAdsCampaignMetricsForWorkspace(workspaceId, user.id)
      : Promise.resolve({
          data: notConnectedGoogleAdsCampaignMetrics,
          error: null,
          isConfigured: true,
        }),
  ]);
  const tasks = tasksResult.data;
  const campaignTasks = tasks.filter(isCampaignTask);
  const campaignReports = buildCampaignReports(tasks, catalogResult.data.agents);
  const pendingCampaignTasks = buildPendingCampaignTasks(tasks, catalogResult.data.agents);
  const metaConnection = metaConnectionResult.data;
  const googleAdsConnection = googleAdsConnectionResult.data;
  const googleAdsCampaignMetrics = googleAdsCampaignMetricsResult.data;
  const metaIsConnected = metaConnection.status === 'connected';
  const metaActionLabel =
    metaConnection.status === 'not_connected' ? 'Connect Meta Ads' : 'Reconnect Meta Ads';
  const preferredAgent =
    catalogResult.data.agents.find((agent) => agent.id === 'social_media_content') ??
    catalogResult.data.agents.find((agent) => agent.department === 'Content & Growth') ??
    null;
  const googleAdsVisibleCampaigns = getGoogleAdsVisibleCampaignCount(googleAdsCampaignMetrics);
  const activeCampaigns = googleAdsVisibleCampaigns + (metaIsConnected ? 1 : 0);
  const scheduledCampaigns = campaignTasks.filter((task) => task.status === 'pending').length;
  const publishedCampaigns = campaignReports.filter((report) => report.status === 'completed').length;
  const setupRequiredCount = [
    !metaIsConnected,
    !pinterestReadiness.isConfigured,
    !googleAdsReadiness.isConfigured ||
      googleAdsConnection.status === 'expired' ||
      googleAdsConnection.status === 'revoked' ||
      googleAdsConnection.status === 'error' ||
      googleAdsCampaignMetrics.state === 'token_invalid',
  ].filter(Boolean).length;
  const totalCampaigns = campaignTasks.length + googleAdsVisibleCampaigns;
  const campaignBoardItems = buildCampaignBoardItems({
    campaignReports,
    pendingCampaignTasks,
    googleAdsCampaignMetrics,
    metaIsConnected,
    pinterestReadiness,
  });

  return (
    <div className="space-y-8">
      {(workspaceResult.error || catalogResult.error || tasksResult.error) && (
        <Notice tone="warning" title="Campaign data notice">
          {workspaceResult.error ?? catalogResult.error ?? tasksResult.error}
        </Notice>
      )}

      {metaParam === 'connected' && (
        <Notice tone="success" title="Meta Ads connected">
          Meta Ads is connected with read-only access. Ad accounts, campaigns, and last 30 days insights can now be displayed.
        </Notice>
      )}

      {metaParam === 'error' && (
        <Notice tone="warning" title="Meta Ads connection was not completed">
          The Meta Ads connection could not be completed. Check the Meta app setup and try again.
        </Notice>
      )}

      {metaConnectionResult.error && (
        <Notice tone="warning" title="Meta Ads connection notice">
          {metaConnectionResult.error}
        </Notice>
      )}

      {pinterestParam === 'setup_required' && (
        <Notice tone="warning" title="Pinterest Ads setup required">
          Add the missing Pinterest Ads server environment variables before connecting.
        </Notice>
      )}

      {pinterestParam === 'storage_not_ready' && (
        <Notice tone="warning" title="Pinterest Ads storage is not enabled yet">
          Pinterest OAuth reached the callback, but storing Pinterest tokens needs a future provider migration first.
        </Notice>
      )}

      {pinterestParam === 'error' && (
        <Notice tone="warning" title="Pinterest Ads connection was not completed">
          The Pinterest Ads connection could not be completed. Check the Pinterest app setup and try again.
        </Notice>
      )}

      {googleAdsParam === 'setup_required' && (
        <Notice tone="warning" title="Google Ads setup required">
          Add the missing Google Ads server environment variables before connecting.
        </Notice>
      )}

      {googleAdsParam === 'connected' && (
        <Notice tone="success" title="Google Ads connected">
          Google Ads is connected for read-only campaigns and last 30 days metrics.
        </Notice>
      )}

      {googleAdsParam === 'error' && (
        <Notice tone="warning" title="Google Ads connection was not completed">
          The Google Ads connection could not be completed. Check the Google Ads OAuth setup and try again.
        </Notice>
      )}

      {(googleAdsConnectionResult.error || googleAdsCampaignMetricsResult.error) && (
        <Notice tone="warning" title="Google Ads connection notice">
          {googleAdsConnectionResult.error ?? googleAdsCampaignMetricsResult.error}
        </Notice>
      )}

      <CampaignHero
        activeCount={activeCampaigns}
        draftCount={pendingCampaignTasks.length}
        scheduledCount={scheduledCampaigns}
        setupRequiredCount={setupRequiredCount}
      />

      <div className="dashboard-stat-grid">
        <CampaignMetricCard
          title="Total Campaigns"
          value={totalCampaigns}
          icon={<Megaphone className="h-5 w-5" />}
          tone="berry"
          subtitle="Tasks plus visible provider campaigns"
        />
        <CampaignMetricCard
          title="Active"
          value={activeCampaigns}
          icon={<RadioTower className="h-5 w-5" />}
          tone="coral"
          subtitle="Connected or metrics-ready channels"
        />
        <CampaignMetricCard
          title="Scheduled"
          value={scheduledCampaigns}
          icon={<Clock3 className="h-5 w-5" />}
          tone="peach"
          subtitle="Pending campaign task queue"
        />
        <CampaignMetricCard
          title="Published"
          value={publishedCampaigns}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="dark"
          subtitle="Completed campaign reports"
        />
        <CampaignMetricCard
          title="Failed / Setup Required"
          value={setupRequiredCount}
          icon={<ShieldAlert className="h-5 w-5" />}
          tone="cream"
          subtitle="Provider setup or reconnect items"
        />
      </div>

      <Card className="rounded-lg border-[#5D6B6B]/8 bg-white shadow-[0_20px_58px_rgba(93,107,107,0.08)]">
        <CardHeader
          title="Ad Platform Connections"
          description="Connect read-only ad platform access before importing campaign performance."
          action={
            <StatusBadge
              status={metaIsConnected ? 'Ready' : 'Not Connected'}
              type="system"
              size="sm"
            />
          }
        />

        <div className="flex min-w-0 flex-col gap-5 rounded-lg border border-[#5D6B6B]/8 bg-[#F1F7F7] p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-bold text-black">
                Meta Ads / Instagram & Facebook
              </h3>
              <StatusBadge
                status={metaIsConnected ? 'Ready' : 'Not Connected'}
                type="system"
                size="sm"
              />
            </div>
            <p className="mt-2 text-sm leading-6 text-black/58">
              Read-only Meta Ads tracking for ad accounts, campaigns, last 30 days insights, and local performance diagnosis.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-black/42">
              <span className="rounded-full border border-[#5D6B6B]/10 bg-white px-2.5 py-1">
                Scope: {metaConnection.scopes.includes('ads_read') ? 'ads_read' : 'ads_read required'}
              </span>
              {metaConnection.connectedAt && (
                <span className="rounded-full border border-[#5D6B6B]/10 bg-white px-2.5 py-1">
                  Connected {formatDateTime(metaConnection.connectedAt)}
                </span>
              )}
            </div>
          </div>

          <Link
            href="/api/ads/meta/connect"
            className={buttonStyles({
              variant: metaIsConnected ? 'outline' : 'primary',
              className: metaIsConnected ? campaignOutlineButtonClassName : campaignButtonClassName,
            })}
          >
            {metaActionLabel}
          </Link>
        </div>

        <MetaAdAccounts workspaceId={workspaceId} userId={user?.id} />

        <PinterestAdsConnectionCard readiness={pinterestReadiness} />

        <GoogleAdsConnectionCard
          readiness={googleAdsReadiness}
          connection={googleAdsConnection}
          campaignMetrics={googleAdsCampaignMetrics}
        />
      </Card>

      <Suspense fallback={<div className="animate-pulse rounded-2xl border border-black/7 bg-white p-6 h-48" />}>
        <CampaignsClient
          campaignBoardItems={campaignBoardItems}
          campaignReports={campaignReports}
          pendingCampaignTasks={pendingCampaignTasks}
          preferredAgentName={preferredAgent?.name ?? 'Social Media Content Agent'}
        />
      </Suspense>
    </div>
  );
}
