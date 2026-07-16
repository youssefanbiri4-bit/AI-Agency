import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { JsonObject } from '@/types';
import type { Database, PromptLibraryRecord } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';
import {
  createPromptLibraryItem,
  listPromptLibraryForWorkspace,
} from './prompt-library';

type AgentBuilderClient = SupabaseClient<Database>;

export type AgentBuilderSafetyLevel = 'safe' | 'requires_review' | 'readonly';
export type AgentBuilderExecutionMode = 'autonomous' | 'supervised' | 'manual' | 'draft_only';
export type AgentBuilderVisibility = 'workspace' | 'marketplace';

export interface AgentBuilderAgentInput {
  name: string;
  role: string;
  description: string | null;
  category: string;
  icon: string;
  accentColor: string;
  instructions: string;
  inputs: string[];
  outputs: string[];
  safetyLevel: AgentBuilderSafetyLevel;
  executionMode: AgentBuilderExecutionMode;
  reviewChecklist: string[];
  tags: string[];
  promptLibraryId: string | null;
}

export interface CreateAgentBuilderInput extends AgentBuilderAgentInput {
  workspaceId: string;
  userId: string;
  visibility?: AgentBuilderVisibility;
  isTemplate?: boolean;
  shareSlug?: string | null;
  metadata?: JsonObject;
}

export interface UpdateAgentBuilderInput extends AgentBuilderAgentInput {
  id: string;
  workspaceId: string;
  visibility?: AgentBuilderVisibility;
  isTemplate?: boolean;
  shareSlug?: string | null;
  metadata?: JsonObject;
}

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48)
    .replace(/-$/, '');

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'agent'}-${suffix}`;
}

export async function generateUniqueShareSlug(
  name: string,
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = slugify(name);
    const { data } = await client
      .from('agent_builder_agents')
      .select('id')
      .eq('share_slug', candidate)
      .maybeSingle();

    if (!data) return candidate;
  }

  return `${slugify(name)}-${Date.now().toString(36)}`;
}

export async function listAgentBuilderAgents(
  workspaceId: string,
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<Database['public']['Tables']['agent_builder_agents']['Row'][]>> {
  if (!isSupabaseConfigured) return emptyDataResult([], false);

  const { data, error } = await client
    .from('agent_builder_agents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (error) return errorDataResult([], error.message);
  return emptyDataResult(data ?? [], true);
}

export async function listMarketplaceAgents(
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<Database['public']['Tables']['agent_builder_agents']['Row'][]>> {
  if (!isSupabaseConfigured) return emptyDataResult([], false);

  const { data, error } = await client
    .from('agent_builder_agents')
    .select('*')
    .eq('visibility', 'marketplace')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) return errorDataResult([], error.message);
  return emptyDataResult(data ?? [], true);
}

export async function getAgentBuilderAgent(
  id: string,
  workspaceId: string,
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<Database['public']['Tables']['agent_builder_agents']['Row'] | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const { data, error } = await client
    .from('agent_builder_agents')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data ?? null, true);
}

export async function getAgentBuilderAgentBySlug(
  slug: string,
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<Database['public']['Tables']['agent_builder_agents']['Row'] | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const { data, error } = await client
    .from('agent_builder_agents')
    .select('*')
    .eq('share_slug', slug)
    .eq('visibility', 'marketplace')
    .maybeSingle();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data ?? null, true);
}

export async function createAgentBuilderAgent(
  input: CreateAgentBuilderInput,
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<Database['public']['Tables']['agent_builder_agents']['Row'] | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const { data, error } = await client
    .from('agent_builder_agents')
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      name: input.name,
      role: input.role,
      description: input.description,
      category: input.category,
      icon: input.icon,
      accent_color: input.accentColor,
      instructions: input.instructions,
      inputs: input.inputs,
      outputs: input.outputs,
      safety_level: input.safetyLevel,
      execution_mode: input.executionMode,
      review_checklist: input.reviewChecklist,
      tags: input.tags,
      prompt_library_id: input.promptLibraryId,
      is_template: input.isTemplate ?? false,
      visibility: input.visibility ?? 'workspace',
      share_slug: input.shareSlug ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}

export async function updateAgentBuilderAgent(
  input: UpdateAgentBuilderInput,
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<Database['public']['Tables']['agent_builder_agents']['Row'] | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const { data, error } = await client
    .from('agent_builder_agents')
    .update({
      name: input.name,
      role: input.role,
      description: input.description,
      category: input.category,
      icon: input.icon,
      accent_color: input.accentColor,
      instructions: input.instructions,
      inputs: input.inputs,
      outputs: input.outputs,
      safety_level: input.safetyLevel,
      execution_mode: input.executionMode,
      review_checklist: input.reviewChecklist,
      tags: input.tags,
      prompt_library_id: input.promptLibraryId,
      is_template: input.isTemplate ?? false,
      visibility: input.visibility ?? 'workspace',
      share_slug: input.shareSlug ?? null,
      metadata: input.metadata ?? {},
    })
    .eq('id', input.id)
    .eq('workspace_id', input.workspaceId)
    .select('*')
    .single();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}

export async function deleteAgentBuilderAgent(
  id: string,
  workspaceId: string,
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const { error } = await client
    .from('agent_builder_agents')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(null, true);
}

export async function publishAgentBuilderAgent(
  id: string,
  workspaceId: string,
  visibility: AgentBuilderVisibility,
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<Database['public']['Tables']['agent_builder_agents']['Row'] | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const existing = await getAgentBuilderAgent(id, workspaceId, client);
  if (existing.error || !existing.data) {
    return errorDataResult(null, existing.error ?? 'Agent not found.');
  }

  const shareSlug =
    visibility === 'marketplace'
      ? existing.data.share_slug ?? (await generateUniqueShareSlug(existing.data.name, client))
      : existing.data.share_slug;

  const { data, error } = await client
    .from('agent_builder_agents')
    .update({
      is_template: true,
      visibility,
      share_slug: shareSlug,
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}

export async function markAgentBuilderUsed(
  id: string,
  workspaceId: string,
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<Database['public']['Tables']['agent_builder_agents']['Row'] | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const existing = await getAgentBuilderAgent(id, workspaceId, client);
  if (existing.error || !existing.data) {
    return errorDataResult(null, existing.error ?? 'Agent not found.');
  }

  const { data, error } = await client
    .from('agent_builder_agents')
    .update({
      usage_count: existing.data.usage_count + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}

export async function cloneMarketplaceAgent(
  source: Database['public']['Tables']['agent_builder_agents']['Row'],
  workspaceId: string,
  userId: string,
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<Database['public']['Tables']['agent_builder_agents']['Row'] | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const { data, error } = await client
    .from('agent_builder_agents')
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      name: source.name,
      role: source.role,
      description: source.description,
      category: source.category,
      icon: source.icon,
      accent_color: source.accent_color,
      instructions: source.instructions,
      inputs: source.inputs,
      outputs: source.outputs,
      safety_level: source.safety_level,
      execution_mode: source.execution_mode,
      review_checklist: source.review_checklist,
      tags: source.tags,
      prompt_library_id: null,
      is_template: false,
      visibility: 'workspace',
      share_slug: null,
      metadata: { cloned_from: source.id },
    })
    .select('*')
    .single();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}

export async function saveAgentToPromptLibrary(
  input: {
    workspaceId: string;
    userId: string;
    name: string;
    instructions: string;
    description: string | null;
    tags: string[];
  },
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<PromptLibraryRecord | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  return createPromptLibraryItem(
    {
      workspaceId: input.workspaceId,
      userId: input.userId,
      title: input.name,
      description: input.description,
      category: 'agents',
      subcategory: 'Agent Builder',
      targetTool: 'general_ai_tool',
      promptText: input.instructions,
      tags: Array.from(new Set([...input.tags, 'agent-builder'])),
      isFavorite: false,
      metadata: { source: 'agent_builder' },
    },
    client
  );
}

export async function listPromptLibraryForAgentBuilder(
  workspaceId: string,
  client: AgentBuilderClient = supabase as AgentBuilderClient
): Promise<DataResult<PromptLibraryRecord[]>> {
  return listPromptLibraryForWorkspace(workspaceId, client);
}
