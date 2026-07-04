'use server';

import { gatherClientReportData } from '@/lib/reports/report-data';
import { generateClientReport } from '@/lib/reports/report-generator';
import { buildReportFilename, generateServerPDF } from '@/lib/reports/generate-server-pdf';
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';
import type { ClientReportTemplate } from '@/lib/reports/report-types';

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