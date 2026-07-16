import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { agentCatalog } from '@/data/agents';
import { automationBlueprints, formatAutomationBlueprintMarkdown } from '@/lib/automation-blueprints/blueprints';
import { templates } from '@/lib/agent-library/templates';
import { listPromptLibraryForWorkspace } from '@/lib/data/prompt-library';
import { listContentStudioItemsForWorkspace } from '@/features/content-studio/data/content-studio';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { listTasks } from '@/features/tasks/data/tasks';
import { buildGeneratedReportItems } from '@/features/reports/data/reports';
import { getSystemHealthSummary } from '@/lib/data/system-health';
import { compactKnowledgeText, sanitizeKnowledgeText } from './format';
import type { KnowledgeEntry, KnowledgeSourceType } from './types';
import type { Database } from '@/types/database';

interface CollectKnowledgeSourcesInput {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  userId: string;
  sourceTypes?: KnowledgeSourceType[];
}

function includeSource(sourceTypes: KnowledgeSourceType[] | undefined, source: KnowledgeSourceType) {
  return !sourceTypes || sourceTypes.length === 0 || sourceTypes.includes(source);
}

function entry(input: Omit<KnowledgeEntry, 'content' | 'summary' | 'tags'> & {
  summary?: string | null;
  content: Array<unknown>;
  tags?: string[];
}): KnowledgeEntry {
  const content = compactKnowledgeText(input.content, 2200);
  const summary = sanitizeKnowledgeText(input.summary || content, 420);

  return {
    ...input,
    summary,
    content,
    tags: (input.tags ?? []).map((tag) => sanitizeKnowledgeText(tag, 60)).filter(Boolean),
  };
}

function resultSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return compactKnowledgeText([
    record.summary,
    Array.isArray(record.recommendations) ? record.recommendations.slice(0, 3).join('; ') : null,
    Array.isArray(record.nextActions) ? record.nextActions.slice(0, 3).join('; ') : null,
  ], 700);
}

async function collectPlaybooks(input: CollectKnowledgeSourcesInput) {
  const { data, error } = await input.supabase
    .from('agent_workflow_playbooks')
    .select('*')
    .eq('workspace_id', input.workspaceId)
    .order('updated_at', { ascending: false })
    .limit(60);

  if (error) return [];

  return (data ?? []).map((playbook) => entry({
    id: `playbook:${playbook.id}`,
    workspace_id: input.workspaceId,
    user_id: playbook.user_id,
    source_type: 'playbooks',
    source_id: playbook.id,
    title: playbook.name,
    summary: playbook.description || playbook.goal,
    content: [
      playbook.name,
      playbook.description,
      playbook.goal,
      playbook.notes,
      JSON.stringify(playbook.readiness_summary ?? {}),
    ],
    tags: ['playbook', playbook.status],
    metadata: { status: playbook.status, favorite: playbook.is_favorite },
    href: `/dashboard/agent-library/workflows?playbook=${playbook.id}`,
    updated_at: playbook.updated_at,
  }));
}

export async function collectKnowledgeEntries(input: CollectKnowledgeSourcesInput): Promise<KnowledgeEntry[]> {
  const now = new Date().toISOString();
  const entries: KnowledgeEntry[] = [];

  const [promptsResult, contentResult, assetsResult, tasksResult, healthSummary] = await Promise.all([
    includeSource(input.sourceTypes, 'prompts') ? listPromptLibraryForWorkspace(input.workspaceId, input.supabase) : Promise.resolve({ data: [] }),
    includeSource(input.sourceTypes, 'content') ? listContentStudioItemsForWorkspace(input.workspaceId, input.supabase) : Promise.resolve({ data: [] }),
    includeSource(input.sourceTypes, 'ai_studio') ? listCreativeAssetsForWorkspace(input.workspaceId, input.userId, input.supabase) : Promise.resolve({ data: [] }),
    includeSource(input.sourceTypes, 'tasks') || includeSource(input.sourceTypes, 'reports') ? listTasks({ workspaceId: input.workspaceId }, input.supabase) : Promise.resolve({ data: [] }),
    includeSource(input.sourceTypes, 'system_health') ? getSystemHealthSummary({ supabase: input.supabase, workspaceId: input.workspaceId, userId: input.userId }).catch(() => null) : Promise.resolve(null),
  ]);

  if (includeSource(input.sourceTypes, 'reviews')) {
    const { data: reviews } = await input.supabase
      .from('task_reviews')
      .select('id, task_id, reviewer_id, rating, feedback, created_at, updated_at')
      .eq('workspace_id', input.workspaceId)
      .order('updated_at', { ascending: false })
      .limit(80);

    for (const review of reviews ?? []) {
      entries.push(entry({
        id: `review:${review.id}`,
        workspace_id: input.workspaceId,
        user_id: review.reviewer_id,
        source_type: 'reviews',
        source_id: review.id,
        title: `Task Review ${review.rating}/5`,
        summary: review.feedback || `Review rating ${review.rating}/5`,
        content: [`Rating: ${review.rating}/5`, review.feedback],
        tags: ['review', `rating-${review.rating}`],
        metadata: { rating: review.rating, task_id: review.task_id },
        href: `/dashboard/tasks/${review.task_id}`,
        updated_at: review.updated_at,
      }));
    }
  }

  if (includeSource(input.sourceTypes, 'prompts')) {
    for (const prompt of promptsResult.data ?? []) {
      entries.push(entry({
        id: `prompt:${prompt.id}`,
        workspace_id: input.workspaceId,
        user_id: prompt.created_by,
        source_type: 'prompts',
        source_id: prompt.id,
        title: prompt.title,
        summary: prompt.description,
        content: [prompt.title, prompt.description, prompt.category, prompt.subcategory, prompt.target_tool, prompt.prompt_text],
        tags: ['prompt', prompt.category, prompt.target_tool ?? '', ...prompt.tags],
        metadata: { category: prompt.category, favorite: prompt.is_favorite, usage_count: prompt.usage_count },
        href: `/dashboard/prompt-library/${prompt.id}`,
        updated_at: prompt.updated_at,
      }));
    }
  }

  if (includeSource(input.sourceTypes, 'agents')) {
    for (const template of templates) {
      entries.push(entry({
        id: `agent-template:${template.id}`,
        workspace_id: input.workspaceId,
        source_type: 'agents',
        source_id: template.id,
        title: template.name,
        summary: template.description,
        content: [template.name, template.category, template.description, template.recommended_for.join(', '), template.inputs.join(', '), template.outputs.join(', '), template.review_checklist.join(', ')],
        tags: ['agent-template', template.category, template.safety_level, template.execution_mode],
        metadata: { safety_level: template.safety_level, execution_mode: template.execution_mode },
        href: `/dashboard/agent-library?template=${template.id}`,
        updated_at: now,
      }));
    }

    for (const agent of agentCatalog) {
      entries.push(entry({
        id: `agent:${agent.id}`,
        workspace_id: input.workspaceId,
        source_type: 'agents',
        source_id: agent.id,
        title: agent.name,
        summary: agent.description,
        content: [agent.name, agent.department, agent.description, agent.capabilities.join(', ')],
        tags: ['agent', agent.department],
        metadata: { department: agent.department },
        href: `/dashboard/agents/${agent.id}`,
        updated_at: now,
      }));
    }
  }

  if (includeSource(input.sourceTypes, 'playbooks')) {
    entries.push(...await collectPlaybooks(input));
  }

  if (includeSource(input.sourceTypes, 'blueprints')) {
    for (const blueprint of automationBlueprints) {
      entries.push(entry({
        id: `blueprint:${blueprint.id}`,
        workspace_id: input.workspaceId,
        source_type: 'blueprints',
        source_id: blueprint.id,
        title: blueprint.name,
        summary: blueprint.description,
        content: [formatAutomationBlueprintMarkdown(blueprint)],
        tags: ['automation-blueprint', blueprint.category, blueprint.execution_mode],
        metadata: { category: blueprint.category, execution_mode: blueprint.execution_mode },
        href: '/dashboard/automation-blueprints',
        updated_at: now,
      }));
    }
  }

  if (includeSource(input.sourceTypes, 'content')) {
    for (const item of contentResult.data ?? []) {
      entries.push(entry({
        id: `content:${item.id}`,
        workspace_id: input.workspaceId,
        user_id: item.created_by,
        source_type: 'content',
        source_id: item.id,
        title: item.title,
        summary: item.objective || item.caption || item.ad_copy || item.creative_brief,
        content: [item.title, item.platform, item.content_type, item.status, item.objective, item.prompt, item.caption, item.ad_copy, item.creative_brief, item.script, item.provider_status, item.provider_error],
        tags: ['content', item.platform, item.content_type, item.status],
        metadata: { status: item.status, platform: item.platform, content_type: item.content_type },
        href: `/dashboard/content-studio?item=${item.id}`,
        updated_at: item.updated_at,
      }));
    }
  }

  if (includeSource(input.sourceTypes, 'ai_studio')) {
    for (const asset of assetsResult.data ?? []) {
      entries.push(entry({
        id: `ai-studio:${asset.id}`,
        workspace_id: input.workspaceId,
        user_id: asset.user_id,
        source_type: 'ai_studio',
        source_id: asset.id,
        title: asset.title,
        summary: asset.goal || asset.visual_direction || asset.prompt,
        content: [asset.title, asset.asset_type, asset.platform, asset.status, asset.goal, asset.offer, asset.target_audience, asset.tone, asset.style, asset.visual_direction, asset.prompt, asset.negative_prompt, asset.model, asset.size, asset.error_message],
        tags: ['ai-studio', asset.asset_type, asset.platform, asset.status, asset.source],
        metadata: { status: asset.status, asset_type: asset.asset_type, platform: asset.platform },
        href: `/dashboard/creative-assets/${asset.id}`,
        updated_at: asset.updated_at,
      }));
    }
  }

  if (includeSource(input.sourceTypes, 'tasks')) {
    for (const task of tasksResult.data ?? []) {
      entries.push(entry({
        id: `task:${task.id}`,
        workspace_id: input.workspaceId,
        user_id: task.user_id,
        source_type: 'tasks',
        source_id: task.id,
        title: task.title,
        summary: task.description || resultSummary(task.result),
        content: [task.title, task.description, task.agent_type, task.status, task.priority, resultSummary(task.result)],
        tags: ['task', task.agent_type, task.status, task.priority],
        metadata: { status: task.status, priority: task.priority, agent_type: task.agent_type },
        href: `/dashboard/tasks/${task.id}`,
        updated_at: task.updated_at,
      }));
    }
  }

  if (includeSource(input.sourceTypes, 'reports')) {
    for (const report of buildGeneratedReportItems(tasksResult.data ?? [], agentCatalog)) {
      entries.push(entry({
        id: `report:${report.taskId}`,
        workspace_id: input.workspaceId,
        source_type: 'reports',
        source_id: report.taskId,
        title: report.title,
        summary: report.summaryPreview,
        content: [report.title, report.description, report.agentName, report.departmentLabel, report.summaryPreview],
        tags: ['report', report.agentType, report.departmentLabel],
        metadata: { status: report.status, recommendations: report.recommendationsCount, next_actions: report.nextActionsCount },
        href: report.href,
        updated_at: report.updatedAt,
      }));
    }
  }

  if (healthSummary && includeSource(input.sourceTypes, 'system_health')) {
    entries.push(entry({
      id: 'system-health:summary',
      workspace_id: input.workspaceId,
      source_type: 'system_health',
      source_id: 'summary',
      title: 'System Health Summary',
      summary: `${healthSummary.score}% ${healthSummary.label}. ${healthSummary.topBlockers.slice(0, 3).join('; ')}`,
      content: [
        healthSummary.reportText,
        healthSummary.providers.map((provider: { name: string; status: string; details: string[] }) => `${provider.name}: ${provider.status} ${provider.details.join('; ')}`).join('\n'),
        healthSummary.actions.map((action: { priority: string; title: string; reason: string }) => `${action.priority}: ${action.title} ${action.reason}`).join('\n'),
      ],
      tags: ['system-health', healthSummary.label],
      metadata: { score: healthSummary.score, label: healthSummary.label },
      href: '/dashboard/system-health',
      updated_at: now,
    }));
  }

  return entries;
}
