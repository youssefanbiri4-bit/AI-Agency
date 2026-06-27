import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase-server';
import type { Database } from '@/types/database';
import type { JsonObject } from '@/types';
import { emptyDataResult, errorDataResult } from './types';

type ContentStudioPublishAttemptClient = SupabaseClient<Database>;

export type ContentStudioPublishAttemptProvider = 'meta' | 'google_ads' | 'pinterest' | 'linkedin';
export type ContentStudioPublishAttemptActionType =
  | 'publish_post'
  | 'publish_reel'
  | 'create_campaign_draft'
  | 'create_paused_meta_ad_draft'
  | 'publish_pin'
  | 'manual_handoff';
export type ContentStudioPublishAttemptStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'setup_required'
  | 'approval_pending'
  | 'billing_required'
  | 'quota_limit'
  | 'token_missing'
  | 'manual_only'
  | 'unsupported'
  | 'error';

export interface CreateContentStudioPublishAttemptInput {
  workspaceId: string;
  contentItemId: string;
  provider: ContentStudioPublishAttemptProvider;
  actionType: ContentStudioPublishAttemptActionType;
  status: ContentStudioPublishAttemptStatus;
  requestSummary?: JsonObject;
  providerResponseSummary?: JsonObject;
  errorMessage?: string | null;
  providerExternalId?: string | null;
  createdBy?: string | null;
}

export interface UpdateContentStudioPublishAttemptInput {
  status?: ContentStudioPublishAttemptStatus;
  providerResponseSummary?: JsonObject;
  errorMessage?: string | null;
  providerExternalId?: string | null;
}

async function getClient(client?: ContentStudioPublishAttemptClient) {
  return client ?? (await createSupabaseServerClient());
}

export async function createContentStudioPublishAttempt(
  input: CreateContentStudioPublishAttemptInput,
  client?: ContentStudioPublishAttemptClient
) {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  const supabase = await getClient(client);
  const { data, error } = await supabase
    .from('content_studio_publish_attempts')
    .insert({
      workspace_id: input.workspaceId,
      content_item_id: input.contentItemId,
      provider: input.provider,
      action_type: input.actionType,
      status: input.status,
      request_summary: input.requestSummary ?? {},
      provider_response_summary: input.providerResponseSummary ?? {},
      error_message: input.errorMessage ?? null,
      provider_external_id: input.providerExternalId ?? null,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}

export async function updateContentStudioPublishAttempt(
  attemptId: string,
  workspaceId: string,
  input: UpdateContentStudioPublishAttemptInput,
  client?: ContentStudioPublishAttemptClient
) {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  const supabase = await getClient(client);
  const update: Database['public']['Tables']['content_studio_publish_attempts']['Update'] = {};

  if (input.status !== undefined) {
    update.status = input.status;
  }

  if (input.providerResponseSummary !== undefined) {
    update.provider_response_summary = input.providerResponseSummary;
  }

  if (input.errorMessage !== undefined) {
    update.error_message = input.errorMessage;
  }

  if (input.providerExternalId !== undefined) {
    update.provider_external_id = input.providerExternalId;
  }

  const { data, error } = await supabase
    .from('content_studio_publish_attempts')
    .update(update)
    .eq('id', attemptId)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}
