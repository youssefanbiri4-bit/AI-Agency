import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { normalizeWorkspaceRole } from '@/lib/auth/rbac';
import { createNotification } from '@/lib/data/notifications';
import type { JsonObject } from '@/types';
import type {
  ContentStudioStatus,
  ContentStudioType,
  NotificationSeverity,
  NotificationType,
} from '@/types/database';
import { contentStudioStatusOptions, contentStudioTypeOptions } from '../shared';

export interface ContentStudioActionState {
  error: string | null;
  message?: string | null;
  itemId?: string | null;
  taskId?: string | null;
  assetIds?: string[];
  assetCount?: number;
  outcome?: 'success' | 'failed' | 'setup_required' | 'approval_pending' | 'manual_only' | 'unsupported' | null;
}

export interface GenerateContentStudioFieldState {
  error: string | null;
  message?: string | null;
  generatedText?: string | null;
  field?: string | null;
  requestId?: string | null;
  providerUsed?: 'openai' | null;
  fallbackUsed?: false;
}

export interface CampaignPlannerGenerateState {
  error: string | null;
  message?: string | null;
  plan?: import('@/lib/content-studio/campaign-planner-types').CampaignPlannerResult | null;
  providerUsed?: 'openai' | null;
  fallbackUsed?: false;
  model?: string | null;
}

export interface CampaignPlannerDraftState {
  error: string | null;
  message?: string | null;
  itemIds?: string[];
  outcome?: 'success' | 'failed' | null;
}

export const initialState: ContentStudioActionState = {
  error: null,
  message: null,
  itemId: null,
  taskId: null,
  outcome: null,
};

export const initialGenerateState: GenerateContentStudioFieldState = {
  error: null,
  message: null,
  generatedText: null,
  field: null,
  requestId: null,
};

export function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function emptyToNull(value: string) {
  return value.length > 0 ? value : null;
}

export function toJsonObject(value: unknown): JsonObject {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as JsonObject;
}

export function readCampaignTextField(formData: FormData, key: string) {
  return emptyToNull(readField(formData, key));
}

export function readCampaignNumberField(formData: FormData, key: string) {
  const raw = readField(formData, key);
  const value = Number(raw);

  return raw && Number.isFinite(value) && value > 0 ? value : null;
}

export function readCampaignListField(formData: FormData, key: string) {
  const raw = readField(formData, key);

  if (!raw) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export function readStatus(formData: FormData): ContentStudioStatus {
  const value = readField(formData, 'status') as ContentStudioStatus;

  return contentStudioStatusOptions.some((option) => option.value === value) ? value : 'draft';
}

export function readContentType(formData: FormData): ContentStudioType | null {
  const value = readField(formData, 'content_type') as ContentStudioType;

  return contentStudioTypeOptions.some((option) => option.value === value) ? value : null;
}

export function readScheduleAt(formData: FormData) {
  const value = readField(formData, 'schedule_at');

  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function readAssetIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll('asset_ids')
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

export async function getWorkspaceContext() {
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
    role: normalizeWorkspaceRole(
      (await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id)).data?.role,
      workspaceResult.data,
      user.id
    ),
  };
}

export async function createContentStudioNotification({
  workspaceId,
  userId,
  type,
  severity,
  title,
  message,
  itemId,
  metadata,
  client,
}: {
  workspaceId: string;
  userId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  itemId: string;
  metadata?: JsonObject;
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  try {
    await createNotification(
      {
        workspaceId,
        userId,
        type,
        severity,
        title,
        message,
        relatedEntityType: 'content',
        relatedEntityId: itemId,
        relatedUrl: `/dashboard/content-studio?item=${itemId}`,
        metadata: {
          category: 'content',
          content_item_id: itemId,
          ...(metadata ?? {}),
        },
      },
      client
    );
  } catch {
    // Notifications are best-effort and must not block Content Studio workflows.
  }
}
