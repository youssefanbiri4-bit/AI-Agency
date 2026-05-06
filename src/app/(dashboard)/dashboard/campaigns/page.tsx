import { Megaphone, Plus, TrendingUp } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listAgentCatalog } from '@/lib/data/agents';
import { listTasks } from '@/lib/data/tasks';
import { extractStructuredOutput } from '@/lib/task-results';
import { formatDateTime } from '@/lib/utils';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import type { Agent, Task } from '@/types';
import { CampaignsClient, type CampaignReportItem, type PendingCampaignTaskItem } from './CampaignsClient';

const campaignPrefixes = ['[Campaign Planner]', '[Performance Analyzer]'] as const;

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

export default async function CampaignsPage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;
  const [catalogResult, tasksResult] = await Promise.all([
    listAgentCatalog(supabase),
    workspaceId
      ? listTasks({ workspaceId }, supabase)
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
  ]);
  const tasks = tasksResult.data;
  const campaignTasks = tasks.filter(isCampaignTask);
  const campaignReports = buildCampaignReports(tasks, catalogResult.data.agents);
  const pendingCampaignTasks = buildPendingCampaignTasks(tasks, catalogResult.data.agents);
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

      <PageHeader
        eyebrow="Ads & Growth"
        title="Campaigns"
        description="Plan campaigns and turn performance issues into normal AgentFlow AI tasks."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Campaign Tasks"
          value={campaignTasks.length}
          icon={Megaphone}
          tone="brand"
          subtitle="Planner and analyzer briefs"
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

      <CampaignsClient
        campaignReports={campaignReports}
        pendingCampaignTasks={pendingCampaignTasks}
        preferredAgentName={preferredAgent?.name ?? 'Social Media Content Agent'}
      />
    </div>
  );
}
