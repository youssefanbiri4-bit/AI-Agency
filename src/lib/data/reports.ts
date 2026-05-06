import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { Agent, Task, TaskStatus } from '@/types';
import type { Database } from '@/types/database';
import { getTaskStats } from '@/lib/stats';
import { extractStructuredOutput } from '@/lib/task-results';
import { listTasks } from './tasks';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

const GENERATED_REPORT_STATUSES = new Set<TaskStatus>(['completed', 'needs_review']);
const SUMMARY_PREVIEW_LENGTH = 260;

export interface ReportSummary {
  taskStats: ReturnType<typeof getTaskStats>;
  reviewCount: number;
  eventCount: number;
}

export interface GeneratedReportItem {
  taskId: string;
  title: string;
  description: string;
  status: Extract<TaskStatus, 'completed' | 'needs_review'>;
  agentName: string;
  agentType: string;
  departmentKey: string;
  departmentLabel: string;
  summaryPreview: string;
  recommendationsCount: number;
  nextActionsCount: number;
  qualityNotesCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  href: string;
}

export interface GeneratedReportsData {
  tasks: Task[];
  reports: GeneratedReportItem[];
}

function truncateText(value: string, length = SUMMARY_PREVIEW_LENGTH) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > length ? `${normalized.slice(0, length).trim()}...` : normalized;
}

function getDepartmentKeyFromLabel(label: string | null | undefined) {
  const normalized = label?.toLowerCase() ?? '';

  if (normalized.includes('research')) return 'research_strategy';
  if (normalized.includes('content')) return 'content_growth';
  if (normalized.includes('sales')) return 'sales_operations';

  return 'unassigned';
}

function formatDepartmentKey(key: string) {
  if (key === 'research_strategy') return 'Research & Strategy';
  if (key === 'content_growth') return 'Content & Growth';
  if (key === 'sales_operations') return 'Sales & Operations';

  return key
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Unassigned';
}

function getSortTimestamp(report: GeneratedReportItem) {
  return Date.parse(report.completedAt ?? report.updatedAt ?? report.createdAt) || 0;
}

function isGeneratedReportStatus(
  status: TaskStatus
): status is Extract<TaskStatus, 'completed' | 'needs_review'> {
  return GENERATED_REPORT_STATUSES.has(status);
}

export function buildReportSummary(tasks: Task[], reviewCount = 0, eventCount = 0): ReportSummary {
  return {
    taskStats: getTaskStats(tasks),
    reviewCount,
    eventCount,
  };
}

export function buildGeneratedReportItems(tasks: Task[], agents: Agent[]): GeneratedReportItem[] {
  return tasks
    .flatMap((task): GeneratedReportItem[] => {
      if (!isGeneratedReportStatus(task.status) || !task.result) {
        return [];
      }

      const structuredOutput = extractStructuredOutput(task.result);

      if (!structuredOutput) {
        return [];
      }

      const agent = agents.find((candidate) => candidate.id === task.agent_type);
      const departmentKey =
        structuredOutput.metadata?.departmentKey || getDepartmentKeyFromLabel(agent?.department);
      const departmentLabel = agent?.department || formatDepartmentKey(departmentKey);

      return [
        {
          taskId: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          agentName: agent?.name || structuredOutput.metadata?.agentName || task.agent_type,
          agentType: task.agent_type,
          departmentKey,
          departmentLabel,
          summaryPreview: truncateText(structuredOutput.summary || task.description),
          recommendationsCount: structuredOutput.recommendations.length,
          nextActionsCount: structuredOutput.nextActions.length,
          qualityNotesCount: structuredOutput.qualityNotes.length,
          createdAt: task.created_at,
          updatedAt: task.updated_at,
          completedAt: task.completed_at,
          href: `/dashboard/tasks/${task.id}`,
        },
      ];
    })
    .sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
}

export async function getGeneratedReports(
  workspaceId: string,
  agents: Agent[],
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<GeneratedReportsData>> {
  const emptyReports: GeneratedReportsData = {
    tasks: [],
    reports: [],
  };

  if (!isSupabaseConfigured) {
    return emptyDataResult(emptyReports, false);
  }

  const tasksResult = await listTasks({ workspaceId }, client);

  if (tasksResult.error) {
    return errorDataResult(emptyReports, tasksResult.error);
  }

  return emptyDataResult(
    {
      tasks: tasksResult.data,
      reports: buildGeneratedReportItems(tasksResult.data, agents),
    },
    true
  );
}

export async function getReportSummary(
  workspaceId?: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<ReportSummary>> {
  const emptySummary = buildReportSummary([]);

  if (!isSupabaseConfigured) {
    return emptyDataResult(emptySummary, false);
  }

  const tasksResult = await listTasks({ workspaceId }, client);

  if (tasksResult.error) {
    return errorDataResult(emptySummary, tasksResult.error);
  }

  let reviewQuery = client.from('task_reviews').select('id', { count: 'exact', head: true });
  let eventQuery = client.from('task_events').select('id', { count: 'exact', head: true });

  if (workspaceId) {
    reviewQuery = reviewQuery.eq('workspace_id', workspaceId);
    eventQuery = eventQuery.eq('workspace_id', workspaceId);
  }

  const [reviewResult, eventResult] = await Promise.all([reviewQuery, eventQuery]);

  if (reviewResult.error) {
    return errorDataResult(emptySummary, reviewResult.error.message);
  }

  if (eventResult.error) {
    return errorDataResult(emptySummary, eventResult.error.message);
  }

  return emptyDataResult(
    buildReportSummary(tasksResult.data, reviewResult.count ?? 0, eventResult.count ?? 0),
    true
  );
}
