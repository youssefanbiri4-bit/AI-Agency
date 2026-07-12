'use server';

import { revalidatePath } from 'next/cache';
import { hasPermission } from '@/lib/auth/rbac';
import { getContentStudioItemById } from '@/lib/data/content-studio';
import { createTask } from '@/lib/data/tasks';
import {
  formatContentStudioPlatformLabel,
  formatContentStudioTypeLabel,
  type ContentStudioTaskKind,
} from '../shared';
import type { AgentType } from '@/types';
import type { ContentStudioItemRecord } from '@/types/database';
import {
  type ContentStudioActionState,
  initialState,
  readField,
  getWorkspaceContext,
} from './shared';

const scriptAgentPreferences: AgentType[] = ['social_media_content', 'content_creator', 'copywriting'];
const captionAgentPreferences: AgentType[] = ['social_media_content', 'copywriting', 'content_creator'];
const adCopyAgentPreferences: AgentType[] = ['copywriting', 'ads_script', 'social_media_content'];
const creativeBriefAgentPreferences: AgentType[] = ['visual_brief', 'social_media_content', 'copywriting'];

function getTaskAgentPreferences(kind: ContentStudioTaskKind) {
  switch (kind) {
    case 'script':
      return scriptAgentPreferences;
    case 'caption':
      return captionAgentPreferences;
    case 'ad_copy':
      return adCopyAgentPreferences;
    case 'creative_brief':
      return creativeBriefAgentPreferences;
    default:
      return scriptAgentPreferences;
  }
}

async function getTaskAgentId(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase-server').createSupabaseServerClient>>,
  kind: ContentStudioTaskKind
) {
  const preferredIds = getTaskAgentPreferences(kind);
  const { data, error } = await supabase
    .from('agents')
    .select('id')
    .eq('department_id', 'content_growth')
    .eq('is_active', true)
    .in('id', preferredIds)
    .order('sort_order', { ascending: true });

  if (error) {
    return { agentType: null, error: error.message };
  }

  const sorted = preferredIds
    .map((id) => data?.find((agent) => agent.id === id)?.id)
    .find(Boolean);

  if (!sorted) {
    return { agentType: null, error: 'No active Content & Growth agent is available.' };
  }

  return { agentType: sorted as AgentType, error: null };
}

function buildTaskTitle(item: ContentStudioItemRecord, kind: ContentStudioTaskKind) {
  switch (kind) {
    case 'script':
      return `[Content Studio Script] ${item.title}`;
    case 'caption':
      return `[Content Studio Caption] ${item.title}`;
    case 'ad_copy':
      return `[Content Studio Ad Copy] ${item.title}`;
    case 'creative_brief':
      return `[Content Studio Creative Brief] ${item.title}`;
    default:
      return `[Content Studio Task] ${item.title}`;
  }
}

function buildTaskDescription(item: ContentStudioItemRecord, kind: ContentStudioTaskKind) {
  const typeLabel = formatContentStudioTypeLabel(item.content_type);
  const platformLabel = formatContentStudioPlatformLabel(item.platform);
  const metadataAssetCount =
    typeof item.metadata?.linked_asset_count === 'number' ? item.metadata.linked_asset_count : 0;

  const common = `
Content Studio item: "${item.title}"
Platform: ${platformLabel}
Format: ${typeLabel}
Objective: ${item.objective || 'Not specified'}
Prompt / direction: ${item.prompt || 'Not specified'}
Linked creative assets: ${metadataAssetCount}
Current script: ${item.script || 'Not specified'}
Current caption: ${item.caption || 'Not specified'}
Current ad copy: ${item.ad_copy || 'Not specified'}
Current creative brief: ${item.creative_brief || 'Not specified'}
`.trim();

  switch (kind) {
    case 'script':
      return `${common}

Task:
Create a polished platform-ready script or structured talking points for this content item.

Required output:
- Hook
- Main script
- CTA
- Optional on-screen text ideas`;
    case 'caption':
      return `${common}

Task:
Write caption options tailored to this content item.

Required output:
- 3 caption variants
- CTA
- Optional hashtags
- Short posting note`;
    case 'ad_copy':
      return `${common}

Task:
Write ad copy for this campaign draft or social placement.

Required output:
- Primary copy
- Headline ideas
- CTA ideas
- Short testing notes`;
    case 'creative_brief':
      return `${common}

Task:
Create a creative brief that can guide design or production.

Required output:
- Core concept
- Audience insight
- Visual direction
- Messaging pillars
- Production notes`;
    default:
      return common;
  }
}

export async function createContentStudioTaskAction(
  itemId: string,
  _state: ContentStudioActionState,
  formData: FormData
): Promise<ContentStudioActionState> {
  try {
    const kind = readField(formData, 'task_kind') as ContentStudioTaskKind;
    const { supabase, user, workspace, role } = await getWorkspaceContext();

    if (!hasPermission(role, 'editor')) {
      return {
        ...initialState,
        error: 'ما عندكش صلاحية لإنشاء مهام من Content Studio. Task creation is restricted for your workspace role.',
      };
    }

    const itemResult = await getContentStudioItemById(workspace.id, itemId, supabase);

    if (itemResult.error || !itemResult.data) {
      return {
        ...initialState,
        error: itemResult.error ?? 'Content item not found.',
      };
    }

    const agentResult = await getTaskAgentId(supabase, kind);

    if (agentResult.error || !agentResult.agentType) {
      return {
        ...initialState,
        error: agentResult.error ?? 'No task agent is available.',
      };
    }

    const taskResult = await createTask(
      {
        workspaceId: workspace.id,
        userId: user.id,
        agentType: agentResult.agentType,
        title: buildTaskTitle(itemResult.data, kind),
        description: buildTaskDescription(itemResult.data, kind),
        priority: 'Normal',
        inputData: {
          source: 'content_studio',
          content_studio_item_id: itemResult.data.id,
          content_type: itemResult.data.content_type,
          task_kind: kind,
          linked_asset_ids: itemResult.data.asset_ids,
        },
      },
      supabase
    );

    if (taskResult.error || !taskResult.data) {
      return {
        ...initialState,
        error: taskResult.error ?? 'Task could not be created.',
      };
    }

    revalidatePath('/dashboard/content-studio');
    revalidatePath('/dashboard/tasks');
    revalidatePath(`/dashboard/tasks/${taskResult.data.id}`);

    return {
      error: null,
      message: `${kind.replace('_', ' ')} task created.`,
      itemId: itemResult.data.id,
      taskId: taskResult.data.id,
    };
  } catch (error) {
    return {
      ...initialState,
      error: error instanceof Error ? error.message : 'Task could not be created.',
    };
  }
}
