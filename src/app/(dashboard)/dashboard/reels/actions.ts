'use server';

import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import {
  createReel,
  getReelById,
  markReelFailed,
  markReelPublished,
  markReelReady,
  markReelScheduled,
  updateReel,
  type CreateReelInput,
  type UpdateReelInput,
} from '@/lib/data/reels';
import { createTask } from '@/lib/data/tasks';
import { createNotification } from '@/lib/data/notifications';
import {
  checkInstagramPublishingReadiness,
  mapMetaErrorToSafeMessage,
  publishInstagramReel,
} from '@/lib/ads/instagram-publishing';
import type { AgentType } from '@/types';
import type { NotificationType, ReelRecord, ReelStatus } from '@/types/database';

const preferredReelAgentIds: AgentType[] = [
  'social_media_content',
  'copywriting',
  'ads_script',
  'content_creator',
];

export interface ReelActionState {
  error: string | null;
  message?: string | null;
  reel?: ReelRecord | null;
  taskId?: string | null;
  published?: boolean;
}

export type CreateReelActionState = ReelActionState;
export type UpdateReelActionState = ReelActionState;
export type MarkReadyActionState = ReelActionState;
export type ScheduleReelActionState = ReelActionState;
export type CreateAITaskActionState = ReelActionState;
export type PublishReelActionState = ReelActionState;

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function emptyToUndefined(value: string) {
  return value.length > 0 ? value : undefined;
}

function emptyToNull(value: string) {
  return value.length > 0 ? value : null;
}

function readIntent(formData: FormData) {
  const intent = readField(formData, 'intent');

  if (
    intent === 'mark_ready' ||
    intent === 'ai_script' ||
    intent === 'ai_caption' ||
    intent === 'open_preview'
  ) {
    return intent;
  }

  return 'save_draft';
}

function readHashtags(formData: FormData) {
  return readField(formData, 'hashtags')
    .split(/[\s,]+/)
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 40);
}

function readDuration(formData: FormData) {
  const value = readField(formData, 'duration_seconds');

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}

function readScheduledFor(formData: FormData) {
  const value = readField(formData, 'scheduled_for');

  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validateReelForm(formData: FormData) {
  const title = readField(formData, 'title');
  const duration = readDuration(formData);

  if (title.length < 3) {
    return { error: 'Reel title must be at least 3 characters.' };
  }

  if (title.length > 200) {
    return { error: 'Reel title must be 200 characters or fewer.' };
  }

  if (Number.isNaN(duration)) {
    return { error: 'Duration must be a positive whole number of seconds.' };
  }

  return { error: null };
}

function buildCreateInput({
  formData,
  workspaceId,
  userId,
  status,
}: {
  formData: FormData;
  workspaceId: string;
  userId: string;
  status: ReelStatus;
}): CreateReelInput {
  return {
    workspaceId,
    userId,
    title: readField(formData, 'title'),
    offer: emptyToUndefined(readField(formData, 'offer')),
    goal: emptyToUndefined(readField(formData, 'goal')),
    target_audience: emptyToUndefined(readField(formData, 'target_audience')),
    market: emptyToUndefined(readField(formData, 'market')),
    tone: emptyToUndefined(readField(formData, 'tone')),
    cta: emptyToUndefined(readField(formData, 'cta')),
    hook: emptyToUndefined(readField(formData, 'hook')),
    main_message: emptyToUndefined(readField(formData, 'main_message')),
    script: emptyToUndefined(readField(formData, 'script')),
    storyboard: emptyToUndefined(readField(formData, 'storyboard')),
    caption: emptyToUndefined(readField(formData, 'caption')),
    hashtags: readHashtags(formData),
    duration_seconds: readDuration(formData),
    creative_type: emptyToUndefined(readField(formData, 'creative_type')),
    video_url: emptyToUndefined(readField(formData, 'video_url')),
    cover_url: emptyToUndefined(readField(formData, 'cover_url')),
    subtitles: emptyToUndefined(readField(formData, 'subtitles')),
    music_note: emptyToUndefined(readField(formData, 'music_note')),
    scheduled_for: readScheduledFor(formData),
    status,
    metadata: {
      notes: readField(formData, 'notes'),
    },
  };
}

function buildUpdateInput({
  formData,
  workspaceId,
  userId,
  reelId,
  status,
  metadata,
}: {
  formData: FormData;
  workspaceId: string;
  userId: string;
  reelId: string;
  status?: ReelStatus;
  metadata?: ReelRecord['metadata'];
}): UpdateReelInput {
  return {
    reelId,
    workspaceId,
    userId,
    title: readField(formData, 'title'),
    offer: emptyToNull(readField(formData, 'offer')),
    goal: emptyToNull(readField(formData, 'goal')),
    target_audience: emptyToNull(readField(formData, 'target_audience')),
    market: emptyToNull(readField(formData, 'market')),
    tone: emptyToNull(readField(formData, 'tone')),
    cta: emptyToNull(readField(formData, 'cta')),
    hook: emptyToNull(readField(formData, 'hook')),
    main_message: emptyToNull(readField(formData, 'main_message')),
    script: emptyToNull(readField(formData, 'script')),
    storyboard: emptyToNull(readField(formData, 'storyboard')),
    caption: emptyToNull(readField(formData, 'caption')),
    hashtags: readHashtags(formData),
    duration_seconds: readDuration(formData),
    creative_type: emptyToNull(readField(formData, 'creative_type')),
    video_url: emptyToNull(readField(formData, 'video_url')),
    cover_url: emptyToNull(readField(formData, 'cover_url')),
    subtitles: emptyToNull(readField(formData, 'subtitles')),
    music_note: emptyToNull(readField(formData, 'music_note')),
    scheduled_for: readScheduledFor(formData),
    status,
    metadata,
  };
}

async function getCurrentWorkspaceContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    throw new Error('Workspace not found');
  }

  return {
    supabase,
    user,
    workspace: workspaceResult.data,
  };
}

async function createReelNotification({
  workspaceId,
  userId,
  type,
  title,
  message,
  reelId,
  taskId,
  supabase,
}: {
  workspaceId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  reelId: string;
  taskId?: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  try {
    await createNotification(
      {
        workspaceId,
        userId,
        type,
        title,
        message,
        metadata: {
          reelId,
          ...(taskId ? { taskId } : {}),
        },
      },
      supabase
    );
  } catch {
    // Notifications are best-effort and must not block reel workflows.
  }
}

async function getReelTaskAgent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const { data: preferredAgent, error: preferredError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', 'social_media_content')
    .eq('is_active', true)
    .maybeSingle();

  if (preferredError) {
    return { agentType: null, error: preferredError.message };
  }

  if (preferredAgent?.id) {
    return { agentType: preferredAgent.id as AgentType, error: null };
  }

  const { data: fallbackAgents, error: fallbackError } = await supabase
    .from('agents')
    .select('id')
    .eq('department_id', 'content_growth')
    .eq('is_active', true)
    .in('id', preferredReelAgentIds)
    .order('sort_order', { ascending: true })
    .limit(1);

  if (fallbackError) {
    return { agentType: null, error: fallbackError.message };
  }

  const fallbackAgent = fallbackAgents?.[0]?.id;

  if (!fallbackAgent) {
    return { agentType: null, error: 'No active Content & Growth agent is available.' };
  }

  return { agentType: fallbackAgent as AgentType, error: null };
}

function buildScriptTaskDescription(reel: ReelRecord) {
  return `
Create a professional Instagram Reel script for: "${reel.title}"

Platform: Instagram Reels
Goal: ${reel.goal || 'Not specified'}
Offer: ${reel.offer || 'Not specified'}
Target audience: ${reel.target_audience || 'Not specified'}
Tone: ${reel.tone || 'Not specified'}
CTA: ${reel.cta || 'Not specified'}
Requested duration: ${
    reel.duration_seconds ? `${reel.duration_seconds} seconds` : 'Not specified'
  }

Required output:
- Hook
- Scene-by-scene script
- Caption
- Hashtags
- CTA
- Cover text ideas
`.trim();
}

function buildCaptionTaskDescription(reel: ReelRecord) {
  return `
Create Instagram Reel caption options for: "${reel.title}"

Reel title: ${reel.title}
Offer: ${reel.offer || 'Not specified'}
Goal: ${reel.goal || 'Not specified'}
Audience: ${reel.target_audience || 'Not specified'}
Hook: ${reel.hook || 'Not specified'}
Script:
${reel.script || 'Not specified'}

Requested output:
- 3 caption variants
- Hashtags
- CTA
- Short description
- Posting note
`.trim();
}

async function createReelTask({
  reel,
  kind,
  workspaceId,
  userId,
  supabase,
}: {
  reel: ReelRecord;
  kind: 'script' | 'caption';
  workspaceId: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const agentResult = await getReelTaskAgent(supabase);

  if (agentResult.error || !agentResult.agentType) {
    return { error: agentResult.error ?? 'Reel task agent could not be selected.' };
  }

  const taskResult = await createTask(
    {
      workspaceId,
      userId,
      agentType: agentResult.agentType,
      title:
        kind === 'script'
          ? `[Instagram Reel Script] ${reel.title}`
          : `[Instagram Reel Caption] ${reel.title}`,
      description:
        kind === 'script'
          ? buildScriptTaskDescription(reel)
          : buildCaptionTaskDescription(reel),
      priority: 'Normal',
    },
    supabase
  );

  if (taskResult.error || !taskResult.data) {
    return { error: taskResult.error || `Failed to create AI ${kind} task.` };
  }

  await createReelNotification({
    workspaceId,
    userId,
    reelId: reel.id,
    taskId: taskResult.data.id,
    type:
      kind === 'script'
        ? 'reel_ai_script_task_created'
        : 'reel_ai_caption_task_created',
    title: kind === 'script' ? 'AI Script Task Created' : 'AI Caption Task Created',
    message:
      kind === 'script'
        ? `AI script task created for "${reel.title}".`
        : `AI caption task created for "${reel.title}".`,
    supabase,
  });

  return { error: null, taskId: taskResult.data.id };
}

function revalidateReelPaths(reelId?: string) {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/reels');

  if (reelId) {
    revalidatePath(`/dashboard/reels/${reelId}`);
  }
}

export async function createReelAction(
  _state: CreateReelActionState,
  formData: FormData
): Promise<CreateReelActionState> {
  try {
    const validation = validateReelForm(formData);

    if (validation.error) {
      return { error: validation.error };
    }

    const { supabase, user, workspace } = await getCurrentWorkspaceContext();
    const intent = readIntent(formData);
    const status: ReelStatus = intent === 'mark_ready' ? 'ready' : 'draft';
    const result = await createReel(
      buildCreateInput({
        formData,
        workspaceId: workspace.id,
        userId: user.id,
        status,
      }),
      supabase
    );

    if (result.error || !result.data) {
      return { error: result.error || 'Failed to create reel.' };
    }

    await createReelNotification({
      workspaceId: workspace.id,
      userId: user.id,
      reelId: result.data.id,
      type: 'reel_draft_created',
      title: 'Reel Draft Created',
      message: `Reel draft "${result.data.title}" was created.`,
      supabase,
    });

    if (status === 'ready') {
      await createReelNotification({
        workspaceId: workspace.id,
        userId: user.id,
        reelId: result.data.id,
        type: 'reel_marked_ready',
        title: 'Reel Marked Ready',
        message: `Reel "${result.data.title}" is ready for scheduling or publishing.`,
        supabase,
      });
    }

    if (intent === 'ai_script' || intent === 'ai_caption') {
      const taskResult = await createReelTask({
        reel: result.data,
        kind: intent === 'ai_script' ? 'script' : 'caption',
        workspaceId: workspace.id,
        userId: user.id,
        supabase,
      });

      if (taskResult.error) {
        return { error: taskResult.error, reel: result.data };
      }

      revalidateReelPaths(result.data.id);
      return {
        error: null,
        message: intent === 'ai_script' ? 'AI script task created.' : 'AI caption task created.',
        reel: result.data,
        taskId: taskResult.taskId,
      };
    }

    revalidateReelPaths(result.data.id);
    return {
      error: null,
      message: status === 'ready' ? 'Reel created and marked ready.' : 'Reel draft created.',
      reel: result.data,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to create reel.',
    };
  }
}

export async function updateReelAction(
  reelId: string,
  _state: UpdateReelActionState,
  formData: FormData
): Promise<UpdateReelActionState> {
  try {
    const validation = validateReelForm(formData);

    if (validation.error) {
      return { error: validation.error };
    }

    const { supabase, user, workspace } = await getCurrentWorkspaceContext();
    const reelResult = await getReelById(workspace.id, user.id, reelId, supabase);

    if (!reelResult.data) {
      return { error: 'Reel not found or you do not have permission to edit it.' };
    }

    const intent = readIntent(formData);
    const status = intent === 'mark_ready' ? 'ready' : undefined;
    const result = await updateReel(
      buildUpdateInput({
        formData,
        workspaceId: workspace.id,
        userId: user.id,
        reelId,
        status,
        metadata: {
          ...reelResult.data.metadata,
          notes: readField(formData, 'notes'),
        },
      }),
      supabase
    );

    if (result.error || !result.data) {
      return { error: result.error || 'Failed to update reel.' };
    }

    if (intent === 'mark_ready') {
      await createReelNotification({
        workspaceId: workspace.id,
        userId: user.id,
        reelId: result.data.id,
        type: 'reel_marked_ready',
        title: 'Reel Marked Ready',
        message: `Reel "${result.data.title}" is ready for scheduling or publishing.`,
        supabase,
      });
    }

    if (intent === 'ai_script' || intent === 'ai_caption') {
      const taskResult = await createReelTask({
        reel: result.data,
        kind: intent === 'ai_script' ? 'script' : 'caption',
        workspaceId: workspace.id,
        userId: user.id,
        supabase,
      });

      if (taskResult.error) {
        return { error: taskResult.error, reel: result.data };
      }

      revalidateReelPaths(result.data.id);
      return {
        error: null,
        message: intent === 'ai_script' ? 'AI script task created.' : 'AI caption task created.',
        reel: result.data,
        taskId: taskResult.taskId,
      };
    }

    revalidateReelPaths(result.data.id);
    return {
      error: null,
      message:
        intent === 'mark_ready'
          ? 'Reel updated and marked ready.'
          : intent === 'open_preview'
            ? 'Reel updated for preview.'
            : 'Reel draft saved.',
      reel: result.data,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update reel.',
    };
  }
}

export async function markReadyAction(
  reelId: string,
  _state: MarkReadyActionState
): Promise<MarkReadyActionState> {
  void _state;

  try {
    const { supabase, user, workspace } = await getCurrentWorkspaceContext();
    const reelResult = await getReelById(workspace.id, user.id, reelId, supabase);

    if (!reelResult.data) {
      return { error: 'Reel not found or you do not have permission to update it.' };
    }

    const result = await markReelReady(reelId, workspace.id, user.id, supabase);

    if (result.error || !result.data) {
      return { error: result.error || 'Failed to mark reel as ready.' };
    }

    await createReelNotification({
      workspaceId: workspace.id,
      userId: user.id,
      reelId: result.data.id,
      type: 'reel_marked_ready',
      title: 'Reel Marked Ready',
      message: `Reel "${result.data.title}" is ready for scheduling or publishing.`,
      supabase,
    });

    revalidateReelPaths(result.data.id);
    return { error: null, message: 'Reel marked ready.', reel: result.data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to mark reel as ready.',
    };
  }
}

export async function scheduleReelAction(
  reelId: string,
  scheduledFor: string,
  _state: ScheduleReelActionState
): Promise<ScheduleReelActionState> {
  void _state;

  try {
    const { supabase, user, workspace } = await getCurrentWorkspaceContext();
    const scheduledDate = new Date(scheduledFor);

    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return { error: 'Scheduled publish time must be in the future.' };
    }

    const reelResult = await getReelById(workspace.id, user.id, reelId, supabase);

    if (!reelResult.data) {
      return { error: 'Reel not found or you do not have permission to update it.' };
    }

    const result = await markReelScheduled(
      reelId,
      workspace.id,
      user.id,
      scheduledDate.toISOString(),
      supabase
    );

    if (result.error || !result.data) {
      return { error: result.error || 'Failed to schedule reel.' };
    }

    revalidateReelPaths(result.data.id);
    return { error: null, message: 'Reel scheduled.', reel: result.data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to schedule reel.',
    };
  }
}

export async function createReelScriptTaskAction(
  reelId: string,
  _state: CreateAITaskActionState
): Promise<CreateAITaskActionState> {
  void _state;

  try {
    const { supabase, user, workspace } = await getCurrentWorkspaceContext();
    const reelResult = await getReelById(workspace.id, user.id, reelId, supabase);

    if (!reelResult.data) {
      return { error: 'Reel not found or you do not have permission to create a task for it.' };
    }

    const taskResult = await createReelTask({
      reel: reelResult.data,
      kind: 'script',
      workspaceId: workspace.id,
      userId: user.id,
      supabase,
    });

    if (taskResult.error) {
      return { error: taskResult.error };
    }

    revalidateReelPaths(reelResult.data.id);
    return { error: null, message: 'AI script task created.', taskId: taskResult.taskId };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to create AI script task.',
    };
  }
}

export async function createReelCaptionTaskAction(
  reelId: string,
  _state: CreateAITaskActionState
): Promise<CreateAITaskActionState> {
  void _state;

  try {
    const { supabase, user, workspace } = await getCurrentWorkspaceContext();
    const reelResult = await getReelById(workspace.id, user.id, reelId, supabase);

    if (!reelResult.data) {
      return { error: 'Reel not found or you do not have permission to create a task for it.' };
    }

    const taskResult = await createReelTask({
      reel: reelResult.data,
      kind: 'caption',
      workspaceId: workspace.id,
      userId: user.id,
      supabase,
    });

    if (taskResult.error) {
      return { error: taskResult.error };
    }

    revalidateReelPaths(reelResult.data.id);
    return { error: null, message: 'AI caption task created.', taskId: taskResult.taskId };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to create AI caption task.',
    };
  }
}

export async function publishReelAction(
  reelId: string,
  _state: PublishReelActionState
): Promise<PublishReelActionState> {
  void _state;

  try {
    const { supabase, user, workspace } = await getCurrentWorkspaceContext();
    const reelResult = await getReelById(workspace.id, user.id, reelId, supabase);

    if (!reelResult.data) {
      return { error: 'Reel not found or you do not have permission to publish it.' };
    }

    const reel = reelResult.data;
    const readiness = await checkInstagramPublishingReadiness({
      workspaceId: workspace.id,
      userId: user.id,
      videoUrl: reel.video_url,
    });

    if (!readiness.isReady) {
      return {
        error:
          readiness.reason ||
          'Instagram publishing setup required. Connect an Instagram Business or Creator account with content publishing permissions.',
        published: false,
      };
    }

    await updateReel(
      {
        reelId,
        workspaceId: workspace.id,
        userId: user.id,
        status: 'publishing',
        error_message: null,
      },
      supabase
    );

    const publishResult = await publishInstagramReel({
      workspaceId: workspace.id,
      userId: user.id,
      reelId,
      videoUrl: reel.video_url || '',
      caption: reel.caption || '',
      coverUrl: reel.cover_url || undefined,
    });

    if (!publishResult.success || !publishResult.mediaId) {
      const safeError = publishResult.error || 'Instagram publishing failed.';
      const failedResult = await markReelFailed(
        reelId,
        workspace.id,
        user.id,
        safeError,
        supabase
      );

      await createReelNotification({
        workspaceId: workspace.id,
        userId: user.id,
        reelId,
        type: 'reel_failed',
        title: 'Reel Failed',
        message: `Reel "${reel.title}" could not be published.`,
        supabase,
      });

      revalidateReelPaths(reelId);
      return {
        error: safeError,
        published: false,
        reel: failedResult.data || reel,
      };
    }

    const publishedResult = await markReelPublished(
      reelId,
      workspace.id,
      user.id,
      publishResult.mediaId,
      publishResult.permalink || '',
      supabase
    );

    await createReelNotification({
      workspaceId: workspace.id,
      userId: user.id,
      reelId,
      type: 'reel_published',
      title: 'Reel Published',
      message: `Reel "${reel.title}" was published to Instagram.`,
      supabase,
    });

    revalidateReelPaths(reelId);
    return {
      error: null,
      message: 'Reel published.',
      published: true,
      reel: publishedResult.data || reel,
    };
  } catch (error) {
    return {
      error: mapMetaErrorToSafeMessage(error, 'Failed to publish reel.'),
      published: false,
    };
  }
}
