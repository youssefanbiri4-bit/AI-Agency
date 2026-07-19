'use client';

import { useLanguage } from '@/i18n/context';
import { Card, CardHeader } from '@/components/ui/Card';
import { Download } from 'lucide-react';
import type { CsPageData } from './types';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(','));
  }
  return lines.join('\n');
}

function ExportButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface"
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}

export function CSReports({ data }: { data: CsPageData }) {
  const { t } = useLanguage();
  const stamp = new Date().toISOString().slice(0, 10);

  const exportTicketsCsv = () =>
    download(
      `tickets-${stamp}.csv`,
      toCsv(data.tickets.map((x) => ({ id: x.id, subject: x.subject, status: x.status, priority: x.priority, category: x.category, created_at: x.created_at }))),
      'text/csv'
    );
  const exportFeedbackCsv = () =>
    download(
      `feedback-${stamp}.csv`,
      toCsv(data.feedback.map((x) => ({ id: x.id, rating: x.rating ?? '', category: x.category, message: x.message, created_at: x.created_at }))),
      'text/csv'
    );
  const exportNpsCsv = () =>
    download(
      `nps-${stamp}.csv`,
      toCsv(data.nps.map((x) => ({ id: x.id, score: x.score, comment: x.comment ?? '', period: x.period, created_at: x.created_at }))),
      'text/csv'
    );
  const exportBundleJson = () =>
    download(
      `customer-success-${stamp}.json`,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          tickets: data.tickets,
          feedback: data.feedback,
          nps: data.nps,
          npsSummary: data.npsSummary,
          churn: data.churn,
          retention: data.retention,
        },
        null,
        2
      ),
      'application/json'
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('cs.exportCsv', 'Export as CSV')} description={t('cs.exportCsvDesc', 'Download tables for spreadsheets.')} />
        <div className="flex flex-wrap gap-3 p-4">
          <ExportButton onClick={exportTicketsCsv} label={t('cs.exportTickets', 'Support tickets')} />
          <ExportButton onClick={exportFeedbackCsv} label={t('cs.exportFeedback', 'Feedback')} />
          <ExportButton onClick={exportNpsCsv} label={t('cs.exportNps', 'NPS responses')} />
        </div>
      </Card>

      <Card>
        <CardHeader title={t('cs.exportJson', 'Export full report (JSON)')} description={t('cs.exportJsonDesc', 'All CS data in one file.')} />
        <div className="p-4">
          <ExportButton onClick={exportBundleJson} label={t('cs.exportBundle', 'Customer Success report')} />
        </div>
      </Card>

      <Card>
        <CardHeader title={t('cs.apiExport', 'Programmatic export')} />
        <div className="p-4 text-sm text-foreground-muted">
          <code className="rounded bg-surface px-1.5 py-0.5">
            GET /api/customer-success/export?type=tickets&amp;format=csv
          </code>
        </div>
      </Card>
    </div>
  );
}
