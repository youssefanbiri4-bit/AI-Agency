/**
 * Advanced Analytics Insights PDF Generator
 *
 * W15-T2: renders a branded HTML report (usage forecast, churn risk, team
 * performance) and converts to PDF via puppeteer-core, falling back to HTML
 * when Chromium is unavailable — mirrors src/lib/usage/pdf-export.ts.
 */

import 'server-only';

import { logger } from '@/lib/logger';
import type { InsightsSummary } from './insights';

const pdfLog = logger.child('analytics:pdf-export');

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SEGMENT_COLORS: Record<string, string> = {
  healthy: '#10b981',
  watch: '#3b82f6',
  at_risk: '#f59e0b',
  churn_risk: '#ef4444',
};

export function renderInsightsReportHtml(data: InsightsSummary): string {
  const usageRows = [...data.usage.daily.slice(-30), ...data.usage.forecast]
    .map((row) => {
      const date = 'total' in row ? (row as { date: string }).date : (row as { date: string }).date;
      const predicted = 'predicted' in row ? (row as { predicted: number }).predicted : (row as { total: number }).total;
      const isForecast = 'predicted' in row;
      return `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(date)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${predicted}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">
            ${isForecast ? '<span style="color:#ef4444;font-weight:700;">forecast</span>' : '<span style="color:#9ca3af;">actual</span>'}
          </td>
        </tr>`;
    })
    .join('');

  const churnRows = data.churn.scores
    .map((c) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(c.fullName ?? c.email ?? 'Unknown')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${c.riskScore}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;color:#fff;background:${SEGMENT_COLORS[c.segment] ?? '#6b7280'};">${escapeHtml(c.segment)}</span>
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${c.daysSinceLastActivity ?? '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${escapeHtml(c.signals.join('; '))}</td>
      </tr>`)
    .join('');

  const teamRows = data.team.members
    .map((m) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(m.fullName ?? m.email ?? 'Unknown')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${m.totalTasks}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${m.completedTasks}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${m.failedTasks}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${m.completionRate}%</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${m.avgCycleHours ?? '—'}</td>
      </tr>`)
    .join('');

  const deptRows = data.team.byDepartment
    .map((d) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(d.department)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${d.members}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${d.totalTasks}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${d.completionRate}%</td>
      </tr>`)
    .join('');

  const segmentSummary = Object.entries(data.churn.segments)
    .map(([seg, count]) => `<span style="display:inline-block;margin-right:12px;"><strong style="color:${SEGMENT_COLORS[seg] ?? '#6b7280'};">${count}</strong> ${escapeHtml(seg)}</span>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Analytics &amp; Insights Report</title>
  <style>
    @page { size: A4; margin: 1.2cm; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a1a; line-height: 1.5; margin: 0; }
    .page { max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 1.8rem; margin: 0 0 0.5rem; }
    h2 { font-size: 1.2rem; margin: 1.5rem 0 0.75rem; color: #374151; border-bottom: 2px solid #F7CBCA; padding-bottom: 0.25rem; }
    .subtitle { color: #6b7280; margin-bottom: 1rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
    .summary-card { text-align: center; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px; }
    .summary-card .value { font-size: 1.5rem; font-weight: 900; font-family: monospace; }
    .summary-card .label { font-size: 0.7rem; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="page">
    <h1>Analytics &amp; Insights Report</h1>
    <p class="subtitle">Workspace ${escapeHtml(data.workspaceId)} &middot; Generated ${escapeHtml(new Date(data.generatedAt).toLocaleString())}</p>

    <div class="summary-grid">
      <div class="summary-card"><div class="value">${data.usage.totalLast30}</div><div class="label">Usage (30d)</div></div>
      <div class="summary-card"><div class="value" style="color:${data.usage.changePercent > 0 ? '#10b981' : data.usage.changePercent < 0 ? '#ef4444' : '#6b7280'}">${data.usage.changePercent > 0 ? '+' : ''}${data.usage.changePercent}%</div><div class="label">MoM Change</div></div>
      <div class="summary-card"><div class="value">${data.churn.averageRisk}</div><div class="label">Avg Churn Risk</div></div>
      <div class="summary-card"><div class="value">${data.team.totals.completionRate}%</div><div class="label">Team Completion</div></div>
    </div>

    <h2>Usage Trends &amp; Forecast</h2>
    <p style="font-size:12px;color:#6b7280;">Forecast fit quality (R²): ${data.usage.fitQuality} &middot; Direction: ${escapeHtml(data.usage.trendDirection)}</p>
    <table>
      <thead><tr style="background:#f9fafb;">
        <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Date</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Total</th>
        <th style="padding:6px 8px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Type</th>
      </tr></thead>
      <tbody>${usageRows}</tbody>
    </table>

    <h2>Churn Risk</h2>
    <p style="font-size:12px;color:#6b7280;">${segmentSummary}</p>
    <table>
      <thead><tr style="background:#f9fafb;">
        <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Member</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Risk</th>
        <th style="padding:6px 8px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Segment</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Days Inactive</th>
        <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Signals</th>
      </tr></thead>
      <tbody>${churnRows}</tbody>
    </table>

    <h2>Team Performance</h2>
    <table>
      <thead><tr style="background:#f9fafb;">
        <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Member</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Total</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Done</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Failed</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Rate</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Cycle (h)</th>
      </tr></thead>
      <tbody>${teamRows}</tbody>
    </table>

    <h2>Department Breakdown</h2>
    <table>
      <thead><tr style="background:#f9fafb;">
        <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Department</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Members</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Tasks</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:0.7rem;text-transform:uppercase;color:#6b7280;">Rate</th>
      </tr></thead>
      <tbody>${deptRows}</tbody>
    </table>

    <div class="footer">Generated by AgentFlow AI &middot; ${escapeHtml(data.generatedAt)} &middot; Confidential analytics report</div>
  </div>
</body>
</html>`;
}

/**
 * Generate PDF from HTML via puppeteer-core. Falls back to HTML when Chromium
 * is unavailable (e.g. sandboxed build environments).
 */
export async function generateInsightsReportPdf(
  data: InsightsSummary
): Promise<{ buffer: Buffer; contentType: string }> {
  const html = renderInsightsReportHtml(data);

  try {
    const puppeteer = await import('puppeteer-core');
    const chromium = await puppeteer.default.launch({
      executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await chromium.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1.2cm', bottom: '1.2cm', left: '1.2cm', right: '1.2cm' },
    });
    await chromium.close();
    pdfLog.info('Insights report PDF generated', { sizeBytes: buffer.length });
    return { buffer: Buffer.from(buffer), contentType: 'application/pdf' };
  } catch (err) {
    pdfLog.warn('Puppeteer unavailable, returning HTML report', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { buffer: Buffer.from(html, 'utf-8'), contentType: 'text/html' };
  }
}
