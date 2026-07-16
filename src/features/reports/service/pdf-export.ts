/**
 * @deprecated Client-side print-to-PDF replaced by server-side generateServerPDF.
 * This file is kept only for backward compatibility.
 * All new code should import from '@/features/reports/service/generate-server-pdf'.
 * Kept for backward compatibility in tests or legacy callers.
 */

import { renderReportToHTML } from './report-generator';
import type { ClientReport } from './report-types';

export interface ExportOptions {
  filename?: string;
  includeFooter?: boolean;
}

export function generatePrintableHTML(report: ClientReport): string {
  return renderReportToHTML(report);
}

export function triggerClientPDFDownload(report: ClientReport, options: ExportOptions = {}) {
  if (typeof window === 'undefined') return;

  const html = renderReportToHTML(report);
  const filename = options.filename || `${report.title.replace(/\s+/g, '_')}.html`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.replace('.pdf', '.html');
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportReportAsPDF(report: ClientReport, options?: ExportOptions) {
  triggerClientPDFDownload(report, options);
}