'use server';

import { z } from 'zod';
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';
import { createNotification } from '@/lib/data/notifications';
import { logger } from '@/lib/logger';

const csActionLog = logger.child('action:customer-success');
import {
  createSupportTicket,
  updateSupportTicket,
  deleteSupportTicket,
  createFeedback,
  deleteFeedback,
  createNpsResponse,
  acknowledgeChurnAlert,
  createChurnAlert,
  computeChurnSignals,
} from '@/lib/data/customer-success';

const ticketSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(5).max(5000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  category: z.string().trim().max(60).default('general'),
});

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  message: z.string().trim().min(2).max(3000),
  category: z.string().trim().max(60).default('general'),
  authorEmail: z.string().email().max(160).nullable().optional(),
});

const npsSchema = z.object({
  score: z.number().int().min(0).max(10),
  comment: z.string().max(2000).nullable().optional(),
});

export interface CsResult {
  ok: boolean;
  error?: string;
  ticketId?: string;
  feedbackId?: string;
  npsId?: string;
  alertsCreated?: number;
}

export async function createSupportTicketAction(input: {
  subject: string;
  description: string;
  priority?: string;
  category?: string;
}): Promise<CsResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Editor role required to create tickets.' };
  }
  const parsed = ticketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid ticket data.' };
  }
  const result = await createSupportTicket(
    {
      workspaceId: rbac.context.workspace.id,
      userId: rbac.context.user.id,
      subject: parsed.data.subject,
      description: parsed.data.description,
      priority: parsed.data.priority,
      category: parsed.data.category,
    },
    rbac.context.supabase
  );
  if (result.error) return { ok: false, error: result.error };
  return { ok: true, ticketId: result.data?.id };
}

export async function updateTicketStatusAction(input: {
  id: string;
  status: string;
  priority?: string;
  category?: string;
  assignedTo?: string | null;
}): Promise<CsResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Editor role required.' };
  }
  const result = await updateSupportTicket(
    input.id,
    rbac.context.workspace.id,
    { status: input.status, priority: input.priority, category: input.category, assigned_to: input.assignedTo ?? null },
    rbac.context.supabase
  );
  if (result.error) return { ok: false, error: result.error };
  return { ok: true, ticketId: result.data?.id };
}

export async function deleteTicketAction(id: string): Promise<CsResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'admin' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Admin role required.' };
  }
  const result = await deleteSupportTicket(id, rbac.context.workspace.id, rbac.context.supabase);
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}

export async function createFeedbackAction(input: {
  rating?: number | null;
  message: string;
  category?: string;
  authorEmail?: string | null;
}): Promise<CsResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Authentication required.' };
  }
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid feedback data.' };
  }
  const result = await createFeedback(
    {
      workspaceId: rbac.context.workspace.id,
      userId: rbac.context.user.id,
      rating: parsed.data.rating ?? null,
      message: parsed.data.message,
      category: parsed.data.category,
      authorEmail: parsed.data.authorEmail ?? null,
    },
    rbac.context.supabase
  );
  if (result.error) return { ok: false, error: result.error };
  return { ok: true, feedbackId: result.data?.id };
}

export async function deleteFeedbackAction(id: string): Promise<CsResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'admin' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Admin role required.' };
  }
  const result = await deleteFeedback(id, rbac.context.workspace.id, rbac.context.supabase);
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}

export async function createNpsAction(input: { score: number; comment?: string | null }): Promise<CsResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Authentication required.' };
  }
  const parsed = npsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid NPS score (0-10).' };
  }
  const result = await createNpsResponse(
    {
      workspaceId: rbac.context.workspace.id,
      userId: rbac.context.user.id,
      score: parsed.data.score,
      comment: parsed.data.comment ?? null,
    },
    rbac.context.supabase
  );
  if (result.error) return { ok: false, error: result.error };
  return { ok: true, npsId: result.data?.id };
}

export async function acknowledgeChurnAlertAction(id: string): Promise<CsResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'admin' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Admin role required.' };
  }
  const result = await acknowledgeChurnAlert(id, rbac.context.workspace.id, rbac.context.user.id, rbac.context.supabase);
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}

export async function runChurnAnalysisAction(): Promise<CsResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'admin' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Admin role required.' };
  }
  const workspaceId = rbac.context.workspace.id;
  csActionLog.info('churn_analysis.start', { workspaceId });
  const signals = await computeChurnSignals(workspaceId);

  // Deduplicate: skip a signal type if an unacknowledged alert of same type exists in last 14 days
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await rbac.context.supabase
    .from('churn_alerts')
    .select('signal_type')
    .eq('workspace_id', workspaceId)
    .eq('acknowledged', false)
    .gte('created_at', since);
  const recentTypes = new Set((existing ?? []).map((e: { signal_type: string }) => e.signal_type));

  let created = 0;
  for (const s of signals) {
    if (recentTypes.has(s.signalType)) continue;
    const res = await createChurnAlert(
      {
        workspaceId,
        signalType: s.signalType,
        severity: s.severity,
        title: s.title,
        message: s.message,
        metadata: s.metadata,
      },
      rbac.context.supabase
    );
    if (!res.error) created += 1;
  }

  if (created > 0) {
    const { data: admins } = await rbac.context.supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .in('role', ['admin', 'owner']);
    for (const a of admins ?? []) {
      await createNotification({
        workspaceId,
        userId: a.user_id,
        type: 'churn_warning',
        severity: 'warning',
        title: `${created} new churn signal(s) detected`,
        message: 'Open Customer Success → Churn to review and acknowledge.',
        relatedEntityType: 'churn_alert',
      });
    }
  }

  csActionLog.info('churn_analysis.done', { workspaceId, signals: signals.length, created });
  return { ok: true, alertsCreated: created };
}

export async function triggerWinBackFlowAction(input: { alertId?: string | null; note?: string }): Promise<CsResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'admin' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Admin role required.' };
  }
  const workspaceId = rbac.context.workspace.id;
  csActionLog.info('winback.start', { workspaceId, alertId: input.alertId ?? null });

  if (input.alertId) {
    await acknowledgeChurnAlert(input.alertId, workspaceId, rbac.context.user.id, rbac.context.supabase);
  }

  const { data: admins } = await rbac.context.supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .in('role', ['admin', 'owner']);
  const note = input.note?.trim();
  for (const a of admins ?? []) {
    await createNotification({
      workspaceId,
      userId: a.user_id,
      type: 'win_back',
      severity: 'info',
      title: 'Win-back flow launched',
      message: note
        ? `Win-back outreach started: ${note}`
        : 'A win-back outreach flow has been launched for at-risk customers.',
      relatedEntityType: 'churn_alert',
      relatedEntityId: input.alertId ?? null,
    });
  }

  return { ok: true };
}
