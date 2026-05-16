'use server';

import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import {
  categories,
  getAgentTemplateById,
  templates,
  type TemplateCategory,
} from '@/lib/agent-library/templates';
import type {
  AgentTemplateUsageActionType,
  AgentTemplateUsageEventRecord,
  AgentTemplateUsageSourcePage,
} from '@/types/database';
import type { JsonObject, JsonValue } from '@/types';
import {
  templateUsageActionTypes,
  templateUsageSourcePages,
  type TemplateUsageSummary,
  type TemplateUsageSummaryItem,
  type TemplateUsageSummaryResult,
} from './usage-types';

export interface TrackTemplateUsageInput {
  templateId: string;
  actionType: AgentTemplateUsageActionType;
  sourcePage: AgentTemplateUsageSourcePage;
  metadata?: JsonObject;
}

const emptyActionCounts = Object.fromEntries(
  templateUsageActionTypes.map((actionType) => [actionType, 0])
) as Record<AgentTemplateUsageActionType, number>;

function emptySummary(): TemplateUsageSummary {
  return {
    total_events: 0,
    most_used_templates: [],
    recently_used_templates: [],
    top_categories: [],
    action_counts: { ...emptyActionCounts },
    per_template_summary: [],
    recommended_next_templates: starterRecommendations(),
  };
}

function cleanText(value: unknown, limit: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function isAllowedAction(value: unknown): value is AgentTemplateUsageActionType {
  return typeof value === 'string' && templateUsageActionTypes.includes(value as AgentTemplateUsageActionType);
}

function isAllowedSource(value: unknown): value is AgentTemplateUsageSourcePage {
  return typeof value === 'string' && templateUsageSourcePages.includes(value as AgentTemplateUsageSourcePage);
}

function sanitizeMetadataValue(value: unknown, depth = 0): JsonValue | undefined {
  if (depth > 2) return undefined;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return cleanText(value, 180);

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => sanitizeMetadataValue(item, depth + 1) ?? null);
  }

  if (typeof value === 'object') {
    const output: JsonObject = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>).slice(0, 12)) {
      const cleanKey = cleanText(key, 40).replace(/[^a-zA-Z0-9_.-]/g, '_');
      if (!cleanKey) continue;
      const sanitized = sanitizeMetadataValue(nestedValue, depth + 1);
      if (typeof sanitized !== 'undefined') {
        output[cleanKey] = sanitized;
      }
    }
    return output;
  }

  return undefined;
}

function sanitizeMetadata(value: unknown): JsonObject {
  const sanitized = sanitizeMetadataValue(value);
  if (!sanitized || Array.isArray(sanitized) || typeof sanitized !== 'object') {
    return {};
  }

  return sanitized;
}

async function getUsageContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/agent-library');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  return { supabase, user, workspace: workspaceResult.data };
}

export async function trackTemplateUsageAction(input: TrackTemplateUsageInput): Promise<{ ok: boolean }> {
  try {
    const templateId = cleanText(input.templateId, 120);
    const template = getAgentTemplateById(templateId);

    if (!template || !isAllowedAction(input.actionType) || !isAllowedSource(input.sourcePage)) {
      return { ok: false };
    }

    const { supabase, user, workspace } = await getUsageContext();

    await supabase.from('agent_template_usage_events').insert({
      workspace_id: workspace.id,
      user_id: user.id,
      template_id: template.id,
      template_name: template.name,
      template_category: template.category,
      action_type: input.actionType,
      source_page: input.sourcePage,
      metadata: sanitizeMetadata(input.metadata),
    });

    return { ok: true };
  } catch {
    // Usage analytics are best-effort and must never block the primary user action.
    return { ok: false };
  }
}

export async function getTemplateUsageSummaryAction(): Promise<TemplateUsageSummaryResult> {
  try {
    const { supabase, workspace } = await getUsageContext();
    const { data, error } = await supabase
      .from('agent_template_usage_events')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return {
        data: emptySummary(),
        error: 'Usage analytics are not available yet. Apply the analytics migration to start tracking template actions.',
      };
    }

    return { data: buildSummary(data ?? []), error: null };
  } catch {
    return {
      data: emptySummary(),
      error: 'Usage analytics could not be loaded right now.',
    };
  }
}

function buildSummary(rows: AgentTemplateUsageEventRecord[]): TemplateUsageSummary {
  const perTemplate = new Map<string, TemplateUsageSummaryItem>();
  const categoryCounts = new Map<string, number>();
  const actionCounts = { ...emptyActionCounts };

  for (const row of rows) {
    actionCounts[row.action_type] += 1;
    categoryCounts.set(row.template_category, (categoryCounts.get(row.template_category) ?? 0) + 1);

    const existing = perTemplate.get(row.template_id);
    if (!existing) {
      perTemplate.set(row.template_id, {
        template_id: row.template_id,
        template_name: row.template_name,
        template_category: row.template_category,
        count: 1,
        last_used_at: row.created_at,
      });
      continue;
    }

    existing.count += 1;
    if (!existing.last_used_at || row.created_at > existing.last_used_at) {
      existing.last_used_at = row.created_at;
    }
  }

  const perTemplateSummary = [...perTemplate.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (b.last_used_at ?? '').localeCompare(a.last_used_at ?? '');
  });

  return {
    total_events: rows.length,
    most_used_templates: perTemplateSummary.slice(0, 5),
    recently_used_templates: [...perTemplateSummary]
      .sort((a, b) => (b.last_used_at ?? '').localeCompare(a.last_used_at ?? ''))
      .slice(0, 5),
    top_categories: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    action_counts: actionCounts,
    per_template_summary: perTemplateSummary,
    recommended_next_templates: buildRecommendations(perTemplateSummary, actionCounts),
  };
}

function starterRecommendations(): TemplateUsageSummaryItem[] {
  return [
    'competitive-landscape-analysis',
    'seo-content-cluster-planner',
    'social-media-content-calendar',
  ]
    .map((id) => getAgentTemplateById(id))
    .filter((template): template is NonNullable<ReturnType<typeof getAgentTemplateById>> => Boolean(template))
    .map((template) => ({
      template_id: template.id,
      template_name: template.name,
      template_category: template.category,
      count: 0,
      last_used_at: null,
    }));
}

function findByCategory(category: TemplateCategory, usedIds: Set<string>) {
  return templates.find((template) => template.category === category && !usedIds.has(template.id));
}

function buildRecommendations(
  perTemplateSummary: TemplateUsageSummaryItem[],
  actionCounts: Record<AgentTemplateUsageActionType, number>
) {
  const usedIds = new Set(perTemplateSummary.map((item) => item.template_id));
  const topCategory = perTemplateSummary[0]?.template_category as TemplateCategory | undefined;
  const recommended = new Map<string, TemplateUsageSummaryItem>();

  function add(id: string) {
    const template = getAgentTemplateById(id);
    if (!template || usedIds.has(template.id) || recommended.has(template.id)) return;
    recommended.set(template.id, {
      template_id: template.id,
      template_name: template.name,
      template_category: template.category,
      count: 0,
      last_used_at: null,
    });
  }

  if (topCategory === 'Content & Growth') {
    add('social-media-content-calendar');
    add('viral-content-hook-generator');
    add('newsletter-campaign-builder');
  } else if (topCategory === 'Research & Strategy') {
    add('market-research-agent');
    add('competitor-analysis-agent');
    add('competitive-landscape-analysis');
    add('market-trend-intelligence');
    add('swot-analysis-generator');
  } else if (topCategory === 'Alex Assistant Skills') {
    add('workflow-review-agent');
    add('daily-planning-agent');
    add('daily-briefing-generator');
    add('context-aware-task-delegation');
  } else if (actionCounts.export_n8n_plan > 0 || topCategory === 'n8n Workflow Ideas') {
    add('n8n-workflow-planner-agent');
    add('lead-capture-enrichment-workflow');
    add('content-publishing-pipeline-workflow');
    add('monitoring-alerting-workflow');
  } else if (topCategory === 'Developer/Code Agents') {
    add('code-review-agent');
    add('pr-review-checklist-generator');
    add('database-migration-planner');
  }

  for (const category of categories) {
    const fallback = findByCategory(category, usedIds);
    if (fallback) add(fallback.id);
    if (recommended.size >= 3) break;
  }

  return [...recommended.values()].slice(0, 3);
}
