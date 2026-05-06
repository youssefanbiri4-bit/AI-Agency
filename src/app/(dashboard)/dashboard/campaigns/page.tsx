import Link from 'next/link';
import { Megaphone, Plus, TrendingUp } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getMetaConnectionStatus } from '@/lib/data/ad-connections';
import {
  getPinterestConfigReadiness,
  type PinterestConfigReadiness,
} from '@/lib/ads/pinterest';
import {
  getGoogleAdsConfigReadiness,
  type GoogleAdsConfigReadiness,
} from '@/lib/ads/google-ads';
import { listAgentCatalog } from '@/lib/data/agents';
import { listTasks } from '@/lib/data/tasks';
import { extractStructuredOutput } from '@/lib/task-results';
import { formatDateTime } from '@/lib/utils';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Agent, Task } from '@/types';
import { CampaignsClient, type CampaignReportItem, type PendingCampaignTaskItem } from './CampaignsClient';
import { MetaAdAccounts } from './MetaAdAccounts';

const campaignPrefixes = [
  '[Campaign Planner]',
  '[Performance Analyzer]',
  '[Manual Campaign Tracker]',
  '[Meta Campaign Analysis]',
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

function PinterestAdsConnectionCard({
  readiness,
}: {
  readiness: PinterestConfigReadiness;
}) {
  const isConfigured = readiness.isConfigured;

  return (
    <div className="mt-4 muted-panel flex min-w-0 flex-col gap-5 p-4 lg:flex-row lg:items-center lg:justify-between">
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
          <span className="rounded-full border border-black/10 bg-white px-2.5 py-1">
            Scopes: {readiness.scopes.join(', ')}
          </span>
          {!isConfigured && (
            <span className="rounded-full border border-black/10 bg-white px-2.5 py-1">
              Missing environment variables: {formatMissingPinterestEnv(readiness)}
            </span>
          )}
        </div>
      </div>

      {isConfigured ? (
        <Link
          href="/api/ads/pinterest/connect"
          className={buttonStyles({ variant: 'primary' })}
        >
          Connect Pinterest Ads
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className={buttonStyles({ variant: 'outline' })}
        >
          Setup in Vercel first
        </button>
      )}
    </div>
  );
}

function GoogleAdsConnectionCard({
  readiness,
}: {
  readiness: GoogleAdsConfigReadiness;
}) {
  const isConfigured = readiness.isConfigured;

  return (
    <div className="mt-4 muted-panel flex min-w-0 flex-col gap-5 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-base font-bold text-black">
            Google Ads
          </h3>
          <StatusBadge
            status={isConfigured ? 'Not Connected' : 'Setup Required'}
            type="system"
            size="sm"
          />
        </div>
        <p className="mt-2 text-sm leading-6 text-black/58">
          Read-only Google Ads provider foundation. Actual connection stays disabled until the server environment is complete.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-black/42">
          {!isConfigured && (
            <span className="rounded-full border border-black/10 bg-white px-2.5 py-1">
              Missing environment variables: {formatMissingGoogleAdsEnv(readiness)}
            </span>
          )}
        </div>
      </div>

      {isConfigured ? (
        <Link
          href="/api/ads/google/connect"
          className={buttonStyles({ variant: 'primary' })}
        >
          Connect Google Ads
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className={buttonStyles({ variant: 'outline' })}
        >
          Setup in Vercel first
        </button>
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
  const [catalogResult, tasksResult, metaConnectionResult] = await Promise.all([
    listAgentCatalog(supabase),
    workspaceId
      ? listTasks({ workspaceId }, supabase)
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
    workspaceId && user?.id
      ? getMetaConnectionStatus(workspaceId, user.id)
      : Promise.resolve({
          data: {
            provider: 'meta' as const,
            status: 'not_connected' as const,
            scopes: [],
            connectedAt: null,
            updatedAt: null,
            tokenExpiresAt: null,
            adAccountId: null,
            adAccountName: null,
          },
          error: null,
          isConfigured: true,
        }),
  ]);
  const tasks = tasksResult.data;
  const campaignTasks = tasks.filter(isCampaignTask);
  const campaignReports = buildCampaignReports(tasks, catalogResult.data.agents);
  const pendingCampaignTasks = buildPendingCampaignTasks(tasks, catalogResult.data.agents);
  const metaConnection = metaConnectionResult.data;
  const metaIsConnected = metaConnection.status === 'connected';
  const metaActionLabel =
    metaConnection.status === 'not_connected' ? 'Connect Meta Ads' : 'Reconnect Meta Ads';
  const preferredAgent =
    catalogResult.data.agents.find((agent) => agent.id === 'social_media_content') ??
    catalogResult.data.agents.find((agent) => agent.department === 'Content & Growth') ??
    null;

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

      {googleAdsParam === 'storage_not_ready' && (
        <Notice tone="warning" title="Google Ads storage is not enabled yet">
          Google Ads OAuth reached the callback, but storing Google Ads tokens needs a future provider migration first.
        </Notice>
      )}

      {googleAdsParam === 'error' && (
        <Notice tone="warning" title="Google Ads connection was not completed">
          The Google Ads connection could not be completed. Check the Google Ads OAuth setup and try again.
        </Notice>
      )}

      <PageHeader
        eyebrow="Ads & Growth"
        title="Campaigns"
        description="Plan campaigns, track manual ad performance, and turn read-only Meta campaign metrics into normal AgentFlow AI tasks."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Campaign Tasks"
          value={campaignTasks.length}
          icon={Megaphone}
          tone="brand"
          subtitle="Planner, tracker, and analyzer briefs"
        />
        <StatCard
          title="Generated Reports"
          value={campaignReports.length}
          icon={TrendingUp}
          tone="dark"
          subtitle="Completed or ready for review"
        />
        <StatCard
          title="Default Agent"
          value={preferredAgent?.name ?? 'Content & Growth'}
          icon={Plus}
          tone="accent"
          subtitle="Tasks are created pending"
        />
      </div>

      <Card>
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

        <div className="muted-panel flex min-w-0 flex-col gap-5 p-4 lg:flex-row lg:items-center lg:justify-between">
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
              <span className="rounded-full border border-black/10 bg-white px-2.5 py-1">
                Scope: {metaConnection.scopes.includes('ads_read') ? 'ads_read' : 'ads_read required'}
              </span>
              {metaConnection.connectedAt && (
                <span className="rounded-full border border-black/10 bg-white px-2.5 py-1">
                  Connected {formatDateTime(metaConnection.connectedAt)}
                </span>
              )}
            </div>
          </div>

          <Link
            href="/api/ads/meta/connect"
            className={buttonStyles({ variant: metaIsConnected ? 'outline' : 'primary' })}
          >
            {metaActionLabel}
          </Link>
        </div>

        <MetaAdAccounts workspaceId={workspaceId} userId={user?.id} />

        <PinterestAdsConnectionCard readiness={pinterestReadiness} />

        <GoogleAdsConnectionCard readiness={googleAdsReadiness} />
      </Card>

      <CampaignsClient
        campaignReports={campaignReports}
        pendingCampaignTasks={pendingCampaignTasks}
        preferredAgentName={preferredAgent?.name ?? 'Social Media Content Agent'}
      />
    </div>
  );
}
