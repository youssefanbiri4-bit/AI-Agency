import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { JsonObject } from '@/types';
import type {
  Database,
  NotificationRecord,
  NotificationSeverity,
  NotificationStatus,
  NotificationType,
} from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export interface ListNotificationsInput {
  workspaceId: string;
  userId: string;
  limit?: number;
  status?: NotificationStatus;
  search?: string;
}

export interface CountUnreadNotificationsInput {
  workspaceId: string;
  userId: string;
}

export interface CreateNotificationInput {
  workspaceId: string;
  userId: string;
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  relatedUrl?: string | null;
  metadata?: JsonObject;
}

export interface MarkNotificationReadInput {
  workspaceId: string;
  userId: string;
  notificationId: string;
}

export interface MarkAllNotificationsReadInput {
  workspaceId: string;
  userId: string;
}

export async function listLatestNotifications(
  input: ListNotificationsInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<NotificationRecord[]>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult([], false);
  }

  let query = client
    .from('notifications')
    .select('*')
    .eq('workspace_id', input.workspaceId)
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 8);

  if (input.status) {
    query = query.eq('status', input.status);
  }

  if (input.search?.trim()) {
    const search = input.search.trim().replaceAll('%', '').replaceAll('_', '');
    query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult(data ?? [], true);
}

export async function countUnreadNotifications(
  input: CountUnreadNotificationsInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<number>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(0, false);
  }

  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', input.workspaceId)
    .eq('user_id', input.userId)
    .eq('status', 'unread');

  if (error) {
    return errorDataResult(0, error.message);
  }

  return emptyDataResult(count ?? 0, true);
}

export async function createNotification(
  input: CreateNotificationInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<NotificationRecord | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('notifications')
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      type: input.type,
      severity: input.severity ?? 'info',
      title: input.title,
      message: input.message,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      related_url: input.relatedUrl ?? null,
      status: 'unread',
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}

export async function markNotificationRead(
  input: MarkNotificationReadInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<NotificationRecord | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('notifications')
    .update({
      status: 'read',
      read_at: new Date().toISOString(),
    })
    .eq('id', input.notificationId)
    .eq('workspace_id', input.workspaceId)
    .eq('user_id', input.userId)
    .select('*')
    .maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ?? null, true);
}

export async function markAllNotificationsRead(
  input: MarkAllNotificationsReadInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<NotificationRecord[]>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult([], false);
  }

  const { data, error } = await client
    .from('notifications')
    .update({
      status: 'read',
      read_at: new Date().toISOString(),
    })
    .eq('workspace_id', input.workspaceId)
    .eq('user_id', input.userId)
    .eq('status', 'unread')
    .select('*');

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult(data ?? [], true);
}
