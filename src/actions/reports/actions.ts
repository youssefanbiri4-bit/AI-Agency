'use server';

import { gatherClientReportData } from '@/features/reports/service/report-data';
import { generateClientReport } from '@/features/reports/service/report-generator';
import { buildReportFilename, generateServerPDF } from '@/features/reports/service/generate-server-pdf';
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';
import type { ClientReportTemplate } from '@/features/reports/service/report-types';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  uploadSavedReportPdf,
  accessSharedReport,
  createReportShareLink,
  revokeReportShareLink,
  createReportSignedUrl,
} from '@/features/reports/service/report-storage';

export interface DownloadClientReportResult {
  ok: boolean;
  error?: string;
  filename?: string;
  pdfBase64?: string;
  mimeType?: string;
}

export interface SaveClientReportResult {
  ok: boolean;
  error?: string;
  reportId?: string;
  filename?: string;
}

export interface AccessSharedReportResult {
  ok: boolean;
  error?: string;
  signedUrl?: string;
  filename?: string;
  title?: string;
  expiresAt?: string;
  requiresPassword?: boolean;
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

export async function saveClientReport(input: {
  workspaceId: string;
  taskIds?: string[];
  template?: ClientReportTemplate;
  password?: string;
  period?: string;
  title?: string;
}): Promise<SaveClientReportResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Editor role required to save client reports.' };
  }

  const gathered = await gatherClientReportData({
    workspaceId: input.workspaceId,
    taskIds: input.taskIds,
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

  try {
    const pdfBuffer = await generateServerPDF(report, {
      password: input.password,
    });

    const filename = buildReportFilename(workspaceName, template);

    const { report: savedReport, error } = await uploadSavedReportPdf(rbac.context.supabase, {
      workspaceId: input.workspaceId,
      userId: rbac.context.user.id,
      title: input.title?.trim() || report.title,
      template,
      periodLabel: input.period ?? null,
      filename,
      pdfBuffer,
      metadata: {
        template,
        period: input.period ?? null,
      },
    });

    if (error || !savedReport) {
      return { ok: false, error: error || 'Failed to save report.' };
    }

    return { ok: true, reportId: savedReport.id, filename };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save report.',
    };
  }
}

export async function accessSharedReportAction(
  token: string,
  password?: string
): Promise<AccessSharedReportResult> {
  try {
    const adminClient = await createSupabaseServerClient();
    return await accessSharedReport(adminClient, token, password);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to access shared report.',
    };
  }
}

export interface CreateReportShareLinkActionInput {
  reportId: string;
  workspaceId: string;
  expiresInDays?: number;
  password?: string;
}

export interface CreateReportShareLinkActionResult {
  ok: boolean;
  error?: string;
  shareUrl?: string;
  expiresAt?: string;
  requiresPassword?: boolean;
}

export async function createReportShareLinkAction(
  input: CreateReportShareLinkActionInput
): Promise<CreateReportShareLinkActionResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Editor role required.' };
  }

  try {
    const { link, shareUrl, error } = await createReportShareLink(rbac.context.supabase, {
      reportId: input.reportId,
      workspaceId: input.workspaceId,
      userId: rbac.context.user.id,
      expiresInDays: input.expiresInDays,
      password: input.password,
    });

    if (error || !link || !shareUrl) {
      return { ok: false, error: error || 'Failed to create share link.' };
    }

    return {
      ok: true,
      shareUrl,
      expiresAt: link.expires_at,
      requiresPassword: Boolean(link.password_hash),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to create share link.',
    };
  }
}

export interface GetSavedReportDownloadUrlActionResult {
  ok: boolean;
  error?: string;
  signedUrl?: string;
  filename?: string;
}

export async function getSavedReportDownloadUrlAction(
  reportId: string,
  workspaceId: string
): Promise<GetSavedReportDownloadUrlActionResult> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Editor role required.' };
  }

  try {
    const { data: report, error: reportError } = await rbac.context.supabase
      .from('saved_reports')
      .select('id, storage_path, filename')
      .eq('id', reportId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (reportError || !report) {
      return { ok: false, error: reportError?.message || 'Report not found.' };
    }

    const signed = await createReportSignedUrl(
      rbac.context.supabase,
      report.storage_path
    );

    if (signed.error || !signed.signedUrl) {
      return { ok: false, error: signed.error || 'Failed to create signed URL.' };
    }

    return { ok: true, signedUrl: signed.signedUrl, filename: report.filename };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to create download URL.',
    };
  }
}

export async function revokeReportShareLinkAction(
  linkId: string,
  workspaceId: string
): Promise<{ ok: boolean; error?: string }> {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
  if (!rbac.ok || !rbac.context) {
    return { ok: false, error: rbac.error || 'Editor role required.' };
  }

  try {
    const result = await revokeReportShareLink(rbac.context.supabase, linkId, workspaceId);
    if (!result.ok) {
      return { ok: false, error: result.error || 'Failed to revoke share link.' };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to revoke share link.',
    };
  }
}
