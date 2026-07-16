'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { gatherClientReportData } from '@/features/reports/service/report-data';
import { generateClientReport } from '@/features/reports/service/report-generator';
import { buildReportFilename, generateServerPDF } from '@/features/reports/service/generate-server-pdf';
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';
import {
  uploadSavedReportPdf,
  listSavedReportsForWorkspace,
  createReportSignedUrl,
  createReportShareLink,
  revokeReportShareLink,
  accessSharedReport,
} from '@/features/reports/service/report-storage';
import type { ClientReportTemplate } from '@/features/reports/service/report-types';

export interface DownloadClientReportResult {
  ok: boolean;
  error?: string;
  filename?: string;
  pdfBase64?: string;
  mimeType?: string;
}

export async function downloadClientReportPdfAction(options: {
  workspaceId: string;
  taskIds?: string[];
  template?: ClientReportTemplate;
  password?: string;
  period?: string;
}): Promise<DownloadClientReportResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
  if (!rbac.ok) {
    return { ok: false, error: rbac.error || 'Editor role required to generate client reports.' };
  }

  const gathered = await gatherClientReportData({
    workspaceId: options.workspaceId,
    taskIds: options.taskIds,
  });

  if (!gathered.data) {
    return { ok: false, error: gathered.error || 'Failed to load report data.' };
  }

  const {
    workspaceName,
    tasks,
    reels,
    creativeAssets,
    branding,
    reviewsCount,
  } = gathered.data;

  const report = generateClientReport({
    workspaceId: options.workspaceId,
    workspaceName,
    tasks,
    reels,
    creativeAssets,
    branding,
    reviewsCount,
    period: options.period,
    template: options.template ?? 'full',
  });

  try {
    const pdfBuffer = await generateServerPDF(report, {
      password: options.password,
    });

    return {
      ok: true,
      filename: buildReportFilename(workspaceName, options.template ?? 'full'),
      pdfBase64: pdfBuffer.toString('base64'),
      mimeType: 'application/pdf',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Server PDF generation failed.',
    };
  }
}

// ── Saved Reports ──────────────────────────────────────────────────

export async function saveClientReport(input: {
  workspaceId: string;
  template?: ClientReportTemplate;
  period?: string;
  title?: string;
}): Promise<{ ok: boolean; reportId?: string; filename?: string; error?: string }> {
  try {
    const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (!rbac.ok) {
      return { ok: false, error: rbac.error || 'Access denied.' };
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Authentication required.' };

    const gathered = await gatherClientReportData({ workspaceId: input.workspaceId });
    if (!gathered.data) {
      return { ok: false, error: gathered.error || 'Failed to load report data.' };
    }

    const { workspaceName, tasks, reels, creativeAssets, branding, reviewsCount } = gathered.data;
    const template = input.template ?? 'full';

    const report = generateClientReport({
      workspaceId: input.workspaceId,
      workspaceName,
      tasks,
      reels,
      creativeAssets,
      branding,
      reviewsCount,
      period: input.period,
      template,
    });

    const pdfBuffer = await generateServerPDF(report);
    const filename = buildReportFilename(workspaceName, template);

    const saved = await uploadSavedReportPdf(supabase, {
      workspaceId: input.workspaceId,
      userId: user.id,
      title: input.title ?? `Client Report — ${workspaceName}`,
      template,
      periodLabel: input.period ?? null,
      filename,
      pdfBuffer,
    });

    if (saved.error || !saved.report) {
      return { ok: false, error: saved.error || 'Failed to save report.' };
    }

    return { ok: true, reportId: saved.report.id, filename };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Save failed.' };
  }
}

// ── Access Shared Report ───────────────────────────────────────────

export async function accessSharedReportAction(
  token: string,
  password?: string
): Promise<{
  ok: boolean;
  signedUrl?: string;
  filename?: string;
  title?: string;
  expiresAt?: string;
  requiresPassword?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    return await accessSharedReport(supabase, token, password);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Access failed.' };
  }
}

// ── Create Share Link ──────────────────────────────────────────────

export async function createReportShareLinkAction(input: {
  reportId: string;
  workspaceId: string;
  expiresInDays?: number;
  password?: string;
}): Promise<{ ok: boolean; shareUrl?: string; expiresAt?: string; error?: string }> {
  try {
    const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (!rbac.ok) {
      return { ok: false, error: rbac.error || 'Access denied.' };
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Authentication required.' };

    const result = await createReportShareLink(supabase, {
      reportId: input.reportId,
      workspaceId: input.workspaceId,
      userId: user.id,
      expiresInDays: input.expiresInDays,
      password: input.password,
    });

    if (result.error) {
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      shareUrl: result.shareUrl ?? undefined,
      expiresAt: result.link?.expires_at,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Share link creation failed.' };
  }
}

// ── Get Download URL ───────────────────────────────────────────────

export async function getSavedReportDownloadUrlAction(
  reportId: string,
  workspaceId: string
): Promise<{ ok: boolean; signedUrl?: string; filename?: string; error?: string }> {
  try {
    const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (!rbac.ok) {
      return { ok: false, error: rbac.error || 'Access denied.' };
    }

    const supabase = await createSupabaseServerClient();

    const { data: report, error: reportError } = await supabase
      .from('saved_reports')
      .select('*')
      .eq('id', reportId)
      .eq('workspace_id', workspaceId)
      .single();

    if (reportError || !report) {
      return { ok: false, error: reportError?.message || 'Report not found.' };
    }

    const signed = await createReportSignedUrl(supabase, report.storage_path);
    if (signed.error || !signed.signedUrl) {
      return { ok: false, error: signed.error || 'Failed to create download URL.' };
    }

    return { ok: true, signedUrl: signed.signedUrl, filename: report.filename };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Download failed.' };
  }
}

// ── Revoke Share Link ──────────────────────────────────────────────

export async function revokeReportShareLinkAction(
  linkId: string,
  workspaceId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (!rbac.ok) {
      return { ok: false, error: rbac.error || 'Access denied.' };
    }

    const supabase = await createSupabaseServerClient();
    const result = await revokeReportShareLink(supabase, linkId, workspaceId);

    return { ok: result.ok, error: result.error ?? undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Revoke failed.' };
  }
}