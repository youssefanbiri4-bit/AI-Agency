import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import { increment, timing } from '@/lib/monitoring/metrics';
import { emptyDataResult, errorDataResult, type DataResult } from '@/lib/data/types';
import {
  isValidReviewStatus,
  type CreateReviewInput,
  type HumanReviewRequest,
  type ReviewDecision,
} from './types';

const reviewLog = logger.child('human-review');

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function toRequest(row: Record<string, unknown>): HumanReviewRequest {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    runId: String(row.run_id),
    stepId: String(row.step_id),
    agentType: String(row.agent_type),
    reason: String(row.reason ?? ''),
    context: (row.context as Record<string, unknown>) ?? {},
    requestedAction: (row.requested_action as string | null) ?? null,
    status: (row.status as HumanReviewRequest['status']) ?? 'pending',
    reviewerId: (row.reviewer_id as string | null) ?? null,
    decisionNote: (row.decision_note as string | null) ?? null,
    decidedAt: (row.decided_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function requestHumanReview(
  input: CreateReviewInput
): Promise<DataResult<HumanReviewRequest>> {
  const start = Date.now();
  if (!isSupabaseConfigured()) {
    return emptyDataResult(null as unknown as HumanReviewRequest, false);
  }
  const { client, error: clientError } = getSupabaseAdmin();
  if (clientError || !client) {
    return errorDataResult(null as unknown as HumanReviewRequest, clientError ?? 'supabase unavailable');
  }

  const expiresAt =
    input.expiresInHours && input.expiresInHours > 0
      ? new Date(Date.now() + input.expiresInHours * 3_600_000).toISOString()
      : null;

  const { data, error } = await client
    .from('human_review_requests')
    .insert({
      workspace_id: input.workspaceId,
      run_id: input.runId,
      step_id: input.stepId,
      agent_type: input.agentType,
      reason: input.reason,
      context: (input.context ?? {}) as never,
      requested_action: input.requestedAction ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  timing('human_review_request_ms', Date.now() - start);
  if (error || !data) {
    increment('human_review_request_errors_total');
    return errorDataResult(null as unknown as HumanReviewRequest, error?.message ?? 'insert failed');
  }

  increment('human_review_requested_total');
  reviewLog.info('Human review requested', {
    id: (data as Record<string, unknown>).id,
    stepId: input.stepId,
    agentType: input.agentType,
  });
  return emptyDataResult(toRequest(data as Record<string, unknown>));
}

export async function getReviewRequest(
  id: string
): Promise<DataResult<HumanReviewRequest | null>> {
  if (!isSupabaseConfigured() || !id) {
    return emptyDataResult<HumanReviewRequest | null>(null, false);
  }
  const { client, error: clientError } = getSupabaseAdmin();
  if (clientError || !client) {
    return errorDataResult<HumanReviewRequest | null>(null, clientError ?? 'supabase unavailable');
  }
  const { data, error } = await client
    .from('human_review_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    return errorDataResult<HumanReviewRequest | null>(null, error.message);
  }
  return emptyDataResult<HumanReviewRequest | null>(data ? toRequest(data as Record<string, unknown>) : null);
}

export async function listPendingReviews(
  workspaceId: string
): Promise<DataResult<HumanReviewRequest[]>> {
  if (!isSupabaseConfigured()) {
    return emptyDataResult<HumanReviewRequest[]>([]);
  }
  const { client, error: clientError } = getSupabaseAdmin();
  if (clientError || !client) {
    return errorDataResult<HumanReviewRequest[]>([], clientError ?? 'supabase unavailable');
  }
  const { data, error } = await client
    .from('human_review_requests')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    return errorDataResult<HumanReviewRequest[]>([], error.message);
  }
  return emptyDataResult<HumanReviewRequest[]>((data ?? []).map((r) => toRequest(r as Record<string, unknown>)));
}

export async function decideReview(
  id: string,
  decision: ReviewDecision,
  opts?: { reviewerId?: string; note?: string }
): Promise<DataResult<HumanReviewRequest | null>> {
  const start = Date.now();
  if (!isSupabaseConfigured()) {
    return emptyDataResult<HumanReviewRequest | null>(null, false);
  }
  const { client, error: clientError } = getSupabaseAdmin();
  if (clientError || !client) {
    return errorDataResult<HumanReviewRequest | null>(null, clientError ?? 'supabase unavailable');
  }

  const { data, error } = await client
    .from('human_review_requests')
    .update({
      status: decision,
      reviewer_id: opts?.reviewerId ?? null,
      decision_note: opts?.note ?? null,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .single();

  timing('human_review_decide_ms', Date.now() - start);
  if (error || !data) {
    increment('human_review_decide_errors_total');
    return errorDataResult<HumanReviewRequest | null>(
      null,
      error?.message ?? 'request not found or already decided'
    );
  }

  increment('human_review_decided_total', { decision });
  reviewLog.info('Human review decided', { id, decision, reviewerId: opts?.reviewerId });
  return emptyDataResult<HumanReviewRequest | null>(toRequest(data as Record<string, unknown>));
}

/** Mark requests past their expiry as expired. Returns count updated. */
export async function expireOverdueReviews(): Promise<DataResult<number>> {
  if (!isSupabaseConfigured()) {
    return emptyDataResult(0, false);
  }
  const { client, error: clientError } = getSupabaseAdmin();
  if (clientError || !client) {
    return errorDataResult(0, clientError ?? 'supabase unavailable');
  }
  const { data, error } = await client
    .from('human_review_requests')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('*');
  if (error) {
    return errorDataResult(0, error.message);
  }
  const removed = (data ?? []).length;
  increment('human_review_expired_total', { removed });
  return emptyDataResult(removed);
}

export function isDecision(value: unknown): value is ReviewDecision {
  return value === 'approved' || value === 'rejected';
}

export function isStatus(value: unknown): value is HumanReviewRequest['status'] {
  return isValidReviewStatus(value);
}
