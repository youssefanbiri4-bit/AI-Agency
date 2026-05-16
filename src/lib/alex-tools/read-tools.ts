import 'server-only';

import { templates, categories } from '@/lib/agent-library/templates';
import { getWorkflowPresets } from '@/lib/agent-library/workflow-presets';
import { automationBlueprints } from '@/lib/automation-blueprints/blueprints';
import { listContentStudioItemsForWorkspace } from '@/lib/data/content-studio';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { listPromptLibraryForWorkspace } from '@/lib/data/prompt-library';
import { getReportSummary } from '@/lib/data/reports';
import { getSystemHealthSummary } from '@/lib/data/system-health';
import { listTasks } from '@/lib/data/tasks';
import { collectKnowledgeEntries } from '@/lib/knowledge-base/sources';
import { searchKnowledgeBase } from '@/lib/knowledge-base/search';
import type { AlexToolContext, AlexToolResult } from './types';

const SECRET_PATTERN = /(api[_-]?key|secret|token|password|credential|authorization|bearer|service[_-]?role|refresh[_-]?token|webhook[_-]?secret|env)/gi;

export function sanitizeToolText(value: unknown, limit = 500) {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  const cleaned = text
    .replace(SECRET_PATTERN, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item) || 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function result(input: Omit<AlexToolResult, 'category' | 'riskLevel'>): AlexToolResult {
  return {
    ...input,
    category: 'read',
    riskLevel: 'read_only',
  };
}

export async function getTaskSummaryTool(_input: unknown, context: AlexToolContext) {
  const tasks = await listTasks({ workspaceId: context.workspaceId }, context.supabase);
  const data = tasks.data.slice(0, 80);
  const byStatus = countBy(data, (task) => task.status);
  const byPriority = countBy(data, (task) => task.priority);

  return result({
    toolId: 'get_task_summary',
    toolName: 'Get Task Summary',
    sourceLabel: 'Tasks',
    summary: `Tasks: ${data.length}. Status: ${JSON.stringify(byStatus)}. Priority: ${JSON.stringify(byPriority)}.`,
    items: data.slice(0, 6).map((task) => ({
      title: sanitizeToolText(task.title, 120),
      status: task.status,
      priority: task.priority,
      agent_type: task.agent_type,
    })),
    error: tasks.error,
  });
}

export async function getRecentTasksTool(_input: unknown, context: AlexToolContext) {
  const tasks = await listTasks({ workspaceId: context.workspaceId }, context.supabase);
  const recent = tasks.data.slice(0, 8);

  return result({
    toolId: 'get_recent_tasks',
    toolName: 'Get Recent Tasks',
    sourceLabel: 'Recent Tasks',
    summary: recent.length ? `Recent safe task summaries loaded: ${recent.length}.` : 'No recent tasks found.',
    items: recent.map((task) => ({
      title: sanitizeToolText(task.title, 120),
      description: sanitizeToolText(task.description, 180),
      status: task.status,
      priority: task.priority,
      agent_type: task.agent_type,
    })),
    error: tasks.error,
  });
}

export async function getContentStudioSummaryTool(_input: unknown, context: AlexToolContext) {
  const items = await listContentStudioItemsForWorkspace(context.workspaceId, context.supabase);
  const data = items.data.slice(0, 80);
  const byStatus = countBy(data, (item) => item.status);
  const byPlatform = countBy(data, (item) => item.platform);

  return result({
    toolId: 'get_content_studio_summary',
    toolName: 'Get Content Studio Summary',
    sourceLabel: 'Content Studio',
    summary: `Content items: ${data.length}. Status: ${JSON.stringify(byStatus)}. Platform: ${JSON.stringify(byPlatform)}.`,
    items: data.slice(0, 6).map((item) => ({
      title: sanitizeToolText(item.title, 120),
      platform: item.platform,
      status: item.status,
      content_type: item.content_type,
      provider_status: sanitizeToolText(item.provider_status, 80),
    })),
    error: items.error,
  });
}

export async function getPromptLibrarySummaryTool(_input: unknown, context: AlexToolContext) {
  const prompts = await listPromptLibraryForWorkspace(context.workspaceId, context.supabase);
  const data = prompts.data.slice(0, 80);
  const byCategory = countBy(data, (prompt) => prompt.category);

  return result({
    toolId: 'get_prompt_library_summary',
    toolName: 'Get Prompt Library Summary',
    sourceLabel: 'Prompt Library',
    summary: `Prompt Library items: ${data.length}. Categories: ${JSON.stringify(byCategory)}.`,
    items: data.slice(0, 8).map((prompt) => ({
      title: sanitizeToolText(prompt.title, 120),
      category: prompt.category,
      target_tool: prompt.target_tool,
      favorite: prompt.is_favorite,
      tags: sanitizeToolText(prompt.tags.join(', '), 120),
    })),
    error: prompts.error,
  });
}

export async function getAgentLibrarySummaryTool() {
  const byCategory = categories.map((category) => ({
    category,
    count: templates.filter((template) => template.category === category).length,
  }));

  return result({
    toolId: 'get_agent_library_summary',
    toolName: 'Get Agent Library Summary',
    sourceLabel: 'Agent Library',
    summary: `Agent templates: ${templates.length}. Categories: ${byCategory.map((item) => `${item.category}: ${item.count}`).join(', ')}.`,
    items: templates.slice(0, 10).map((template) => ({
      name: template.name,
      category: template.category,
      execution_mode: template.execution_mode,
      safety_level: template.safety_level,
    })),
  });
}

export async function getWorkflowPlaybooksSummaryTool(_input: unknown, context: AlexToolContext) {
  const presets = getWorkflowPresets();
  const entries = await collectKnowledgeEntries({
    supabase: context.supabase,
    workspaceId: context.workspaceId,
    userId: context.userId,
    sourceTypes: ['playbooks'],
  }).catch(() => []);
  const savedPlaybooks = entries.filter((entry) => entry.source_type === 'playbooks');

  return result({
    toolId: 'get_workflow_playbooks_summary',
    toolName: 'Get Workflow Playbooks Summary',
    sourceLabel: 'Playbooks',
    summary: `Workflow presets: ${presets.length}. Saved playbook entries: ${savedPlaybooks.length}.`,
    items: [
      ...presets.slice(0, 5).map((preset) => ({
        title: preset.name,
        category: preset.category,
        steps: preset.steps.length,
        mode: preset.execution_mode,
      })),
      ...savedPlaybooks.slice(0, 5).map((entry) => ({
        title: sanitizeToolText(entry.title, 120),
        summary: sanitizeToolText(entry.summary, 180),
        source: entry.source_type,
      })),
    ],
  });
}

export async function getAutomationBlueprintsSummaryTool() {
  const byCategory = countBy(automationBlueprints, (blueprint) => blueprint.category);

  return result({
    toolId: 'get_automation_blueprints_summary',
    toolName: 'Get Automation Blueprints Summary',
    sourceLabel: 'Automation Blueprints',
    summary: `Automation blueprints: ${automationBlueprints.length}. Categories: ${JSON.stringify(byCategory)}. All are planning_only.`,
    items: automationBlueprints.slice(0, 8).map((blueprint) => ({
      name: blueprint.name,
      category: blueprint.category,
      execution_mode: blueprint.execution_mode,
      steps: blueprint.workflow_steps.length,
    })),
  });
}

export async function getQualityReviewSummaryTool(_input: unknown, context: AlexToolContext) {
  const reviews = await collectKnowledgeEntries({
    supabase: context.supabase,
    workspaceId: context.workspaceId,
    userId: context.userId,
    sourceTypes: ['reviews'],
  }).catch(() => []);

  return result({
    toolId: 'get_quality_review_summary',
    toolName: 'Get Quality Review Summary',
    sourceLabel: 'Quality Reviews',
    summary: reviews.length ? `Quality review entries found: ${reviews.length}.` : 'No persisted quality review entries found. The current Quality Review page can still run draft reviews.',
    items: reviews.slice(0, 6).map((entry) => ({
      title: sanitizeToolText(entry.title, 120),
      summary: sanitizeToolText(entry.summary, 180),
      tags: sanitizeToolText(entry.tags.join(', '), 120),
    })),
  });
}

export async function getAiStudioSummaryTool(_input: unknown, context: AlexToolContext) {
  const assets = await listCreativeAssetsForWorkspace(context.workspaceId, context.userId, context.supabase);
  const data = assets.data.slice(0, 60);
  const byKind = countBy(data, (asset) => asset.asset_type);
  const byStatus = countBy(data, (asset) => asset.status);

  return result({
    toolId: 'get_ai_studio_summary',
    toolName: 'Get AI Studio Summary',
    sourceLabel: 'AI Studio / Creative Assets',
    summary: `Creative assets: ${data.length}. Kind: ${JSON.stringify(byKind)}. Status: ${JSON.stringify(byStatus)}.`,
    items: data.slice(0, 6).map((asset) => ({
      title: sanitizeToolText(asset.title, 120),
      kind: asset.asset_type,
      status: asset.status,
      source: sanitizeToolText(asset.source, 80),
    })),
    error: assets.error,
  });
}

export async function getProviderHealthSummaryTool(_input: unknown, context: AlexToolContext) {
  const health = await getSystemHealthSummary({
    supabase: context.supabase,
    workspaceId: context.workspaceId,
    userId: context.userId,
  });

  return result({
    toolId: 'get_provider_health_summary',
    toolName: 'Get Provider Health Summary',
    sourceLabel: 'System Health',
    summary: `System health: ${health.score}% (${health.label}). Top blockers: ${health.topBlockers.slice(0, 4).map((item) => sanitizeToolText(item, 140)).join('; ') || 'none'}.`,
    items: health.providers.slice(0, 8).map((provider) => ({
      name: provider.name,
      status: provider.status,
      details: sanitizeToolText(provider.details.join('; '), 180),
    })),
  });
}

export async function getReportsSummaryTool(_input: unknown, context: AlexToolContext) {
  const report = await getReportSummary(context.workspaceId, context.supabase);
  const summary = report.data;

  return result({
    toolId: 'get_reports_summary',
    toolName: 'Get Reports Summary',
    sourceLabel: 'Reports',
    summary: `Reports summary: ${summary.taskStats.total} tasks, ${summary.taskStats.completed} completed, ${summary.taskStats.pending} pending, ${summary.taskStats.failed} failed, ${summary.reviewCount} reviews, ${summary.eventCount} task events.`,
    items: [
      { label: 'total', value: summary.taskStats.total },
      { label: 'pending', value: summary.taskStats.pending },
      { label: 'needs_review', value: summary.taskStats.needsReview },
      { label: 'completed', value: summary.taskStats.completed },
      { label: 'failed', value: summary.taskStats.failed },
    ],
    error: report.error,
  });
}

export async function searchKnowledgeBaseTool(input: unknown, context: AlexToolContext) {
  const query = typeof input === 'object' && input && 'query' in input
    ? sanitizeToolText((input as { query?: unknown }).query, 240)
    : typeof input === 'string'
      ? sanitizeToolText(input, 240)
      : 'workspace summary';
  const results = await searchKnowledgeBase(query, { maxResults: 5 }, context.workspaceId, context.userId);

  return result({
    toolId: 'search_knowledge_base',
    toolName: 'Search Knowledge Base',
    sourceLabel: 'Knowledge Base',
    summary: results.error
      ? `Knowledge Base search failed safely: ${results.error}`
      : results.data.length
        ? `Knowledge Base results for "${query}": ${results.data.length}.`
        : `No relevant Knowledge Base results found for "${query}".`,
    items: results.data.slice(0, 5).map((entry) => ({
      title: sanitizeToolText(entry.title, 120),
      source: entry.source_type,
      summary: sanitizeToolText(entry.summary || entry.content, 220),
      score: entry.score,
    })),
    error: results.error,
  });
}
