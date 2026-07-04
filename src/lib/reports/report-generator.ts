/**
 * Professional Client Report Generator
 *
 * Uses real workspace data only — tasks, reels, creative assets.
 * No fabricated performance metrics.
 */

import type { Task } from '@/types';
import type { CreativeAssetRecord, ReelRecord } from '@/types/database';
import { extractStructuredOutput } from '@/lib/task-results';
import { formatDateTime } from '@/lib/utils';
import type {
  ClientReport,
  ClientReportSection,
  GenerateReportOptions,
  ReportBranding,
  ReportPerformanceMetrics,
} from './report-types';

export type {
  ClientReport,
  ClientReportSection,
  GenerateReportOptions,
  ReportBranding,
  ReportPerformanceMetrics,
  ClientReportTemplate,
} from './report-types';

function truncate(str: string, len: number) {
  const normalized = str.replace(/\s+/g, ' ').trim();
  return normalized.length > len ? `${normalized.slice(0, len).trim()}...` : normalized;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(content: string) {
  return escapeHtml(content)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

export function buildPerformanceMetrics(options: {
  tasks: Task[];
  reels: ReelRecord[];
  creativeAssets: CreativeAssetRecord[];
  reviewsCount: number;
  period?: string;
}): ReportPerformanceMetrics {
  const { tasks, reels, creativeAssets, reviewsCount, period } = options;

  return {
    tasksTotal: tasks.length,
    tasksCompleted: tasks.filter((t) => t.status === 'completed').length,
    tasksNeedsReview: tasks.filter((t) => t.status === 'needs_review').length,
    tasksFailed: tasks.filter((t) => t.status === 'failed').length,
    tasksProcessing: tasks.filter((t) => t.status === 'processing').length,
    reelsTotal: reels.length,
    reelsPublished: reels.filter((r) => r.status === 'published').length,
    reelsReady: reels.filter((r) => r.status === 'ready').length,
    reelsScheduled: reels.filter((r) => r.status === 'scheduled').length,
    creativeAssetsTotal: creativeAssets.length,
    creativeAssetsGenerated: creativeAssets.filter((a) =>
      ['generated', 'selected'].includes(a.status)
    ).length,
    reviewsCount,
    periodLabel: period || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    dataSources: ['tasks', 'reels', 'creative_assets', 'task_reviews'],
  };
}

function formatPerformanceSection(metrics: ReportPerformanceMetrics): string {
  const lines = [
    '**Operational metrics (from workspace records only)**',
    '',
    `Period: ${metrics.periodLabel}`,
    '',
    '### Tasks',
    `- Total tasks: ${metrics.tasksTotal}`,
    `- Completed: ${metrics.tasksCompleted}`,
    `- Needs review: ${metrics.tasksNeedsReview}`,
    `- Processing: ${metrics.tasksProcessing}`,
    `- Failed: ${metrics.tasksFailed}`,
    `- Reviews logged: ${metrics.reviewsCount}`,
    '',
    '### Reels Studio',
    `- Total reels: ${metrics.reelsTotal}`,
    `- Published: ${metrics.reelsPublished}`,
    `- Ready: ${metrics.reelsReady}`,
    `- Scheduled: ${metrics.reelsScheduled}`,
    '',
    '### Creative Assets',
    `- Total assets: ${metrics.creativeAssetsTotal}`,
    `- Generated / selected: ${metrics.creativeAssetsGenerated}`,
    '',
    '_Note: Marketing impressions, clicks, spend, conversions, and engagement rates are not included unless connected provider metrics exist._',
  ];

  return lines.join('\n');
}

function extractSectionsFromData(
  tasks: Task[],
  reels: ReelRecord[],
  creativeAssets: CreativeAssetRecord[],
  metrics: ReportPerformanceMetrics
): ClientReportSection[] {
  const sections: ClientReportSection[] = [];

  const taskSummaries = tasks
    .map((task) => {
      const structured = extractStructuredOutput(task.result);
      if (!structured?.summary) return null;
      return {
        title: task.title,
        status: task.status,
        summary: structured.summary,
        agent: task.agent_type,
      };
    })
    .filter(Boolean) as Array<{ title: string; status: string; summary: string; agent: string }>;

  if (taskSummaries.length > 0) {
    sections.push({
      id: 'executive-summary',
      title: 'Executive Summary',
      content: taskSummaries
        .slice(0, 8)
        .map((s) => `**${s.title}** (${s.status})\n\n${s.summary}`)
        .join('\n\n'),
      type: 'summary',
    });
  }

  const insights: string[] = [];
  tasks.forEach((task) => {
    const structured = extractStructuredOutput(task.result);
    if (structured?.qualityNotes?.length) {
      insights.push(...structured.qualityNotes.map((note) => `${task.title}: ${note}`));
    }
    if (structured?.analysis && typeof structured.analysis === 'string') {
      insights.push(`${task.title}: ${structured.analysis}`);
    }
  });

  if (insights.length) {
    sections.push({
      id: 'insights',
      title: 'Key Insights',
      content: insights.slice(0, 12).map((i) => `- ${i}`).join('\n'),
      type: 'insights',
    });
  }

  const deliverableLines: string[] = [];

  reels.slice(0, 12).forEach((reel) => {
    deliverableLines.push(
      `### Reel: ${reel.title}`,
      `- Status: ${reel.status}`,
      reel.goal ? `- Goal: ${reel.goal}` : '',
      reel.published_permalink ? `- Published: ${reel.published_permalink}` : '',
      reel.caption ? `- Caption: ${truncate(reel.caption, 180)}` : '',
      ''
    );
  });

  creativeAssets.slice(0, 12).forEach((asset) => {
    deliverableLines.push(
      `### Asset: ${asset.title}`,
      `- Type: ${asset.asset_type} · Status: ${asset.status}`,
      asset.platform ? `- Platform: ${asset.platform}` : '',
      asset.prompt ? `- Prompt: ${truncate(asset.prompt, 160)}` : '',
      ''
    );
  });

  if (deliverableLines.length) {
    sections.push({
      id: 'deliverables',
      title: 'Deliverables (Reels & Creative Assets)',
      content: deliverableLines.filter(Boolean).join('\n'),
      type: 'deliverables',
    });
  }

  const contentTasks = tasks.filter(
    (t) =>
      t.agent_type?.includes('content') ||
      t.title.toLowerCase().includes('content') ||
      t.title.toLowerCase().includes('reel')
  );

  if (contentTasks.length) {
    sections.push({
      id: 'content-plan',
      title: 'Content & Campaign Work',
      content: contentTasks
        .slice(0, 10)
        .map(
          (t) =>
            `### ${t.title}\n- Status: ${t.status}\n- Agent: ${t.agent_type}\n${truncate(t.description || '', 220)}`
        )
        .join('\n\n'),
      type: 'plan',
    });
  }

  sections.push({
    id: 'performance',
    title: 'Performance Overview',
    content: formatPerformanceSection(metrics),
    type: 'performance',
  });

  const allRecs: string[] = [];
  tasks.forEach((task) => {
    const structured = extractStructuredOutput(task.result);
    if (structured?.recommendations) {
      structured.recommendations.forEach((rec) => {
        const text = typeof rec === 'string' ? rec : (rec as { text?: string }).text;
        if (text) allRecs.push(`${task.title}: ${text}`);
      });
    }
    if (structured?.nextActions?.length) {
      structured.nextActions.forEach((action) => {
        const text = typeof action === 'string' ? action : (action as { text?: string }).text;
        if (text) allRecs.push(`${task.title} → ${text}`);
      });
    }
  });

  if (allRecs.length) {
    sections.push({
      id: 'recommendations',
      title: 'Recommendations & Next Steps',
      content: allRecs.slice(0, 15).map((r) => `- ${r}`).join('\n'),
      type: 'recommendations',
    });
  }

  return sections;
}

function buildCover(workspaceName: string, branding: ReportBranding, period: string) {
  return {
    agency: branding.agencyName,
    client: workspaceName,
    period: period || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    logo: branding.logoUrl,
  };
}

function buildTOC(sections: ClientReportSection[]) {
  return sections.map((s) => ({ id: s.id, title: s.title }));
}

export function generateClientReport(options: GenerateReportOptions): ClientReport {
  const {
    workspaceName,
    branding: inputBranding,
    tasks = [],
    reels = [],
    creativeAssets = [],
    period,
    template = 'full',
    reviewsCount = 0,
  } = options;

  const branding: ReportBranding = inputBranding ?? {
    agencyName: workspaceName || 'AgentFlow AI Agency',
    primaryColor: '#F7CBCA',
    accentColor: '#5D6B6B',
    secondaryColor: '#D5E5E5',
  };

  const performance = buildPerformanceMetrics({
    tasks,
    reels,
    creativeAssets,
    reviewsCount,
    period,
  });

  let sections = extractSectionsFromData(tasks, reels, creativeAssets, performance);

  if (template === 'executive') {
    sections = sections.filter((s) => ['summary', 'recommendations', 'performance'].includes(s.type));
  } else if (template === 'performance') {
    sections = sections.filter((s) => ['performance', 'insights', 'deliverables'].includes(s.type));
  }

  if (sections.length === 0) {
    sections = [
      {
        id: 'executive-summary',
        title: 'Executive Summary',
        content:
          'No completed task outputs were available for this period. Operational counts are included in the Performance Overview section.',
        type: 'summary',
      },
      {
        id: 'performance',
        title: 'Performance Overview',
        content: formatPerformanceSection(performance),
        type: 'performance',
      },
    ];
  }

  const periodLabel = period || performance.periodLabel;

  return {
    title: `Client Performance Report — ${workspaceName}`,
    subtitle: `${periodLabel} | ${branding.agencyName}`,
    date: formatDateTime(new Date().toISOString()),
    cover: buildCover(workspaceName, branding, periodLabel),
    toc: buildTOC(sections),
    sections,
    branding,
    performance,
    rawData: {
      tasks,
      reels,
      creativeAssets,
    },
  };
}

export function renderReportToHTML(report: ClientReport): string {
  const { branding, cover, toc, sections, title, subtitle, date } = report;

  const brandStyle = `
    :root {
      --primary: ${branding.primaryColor || '#F7CBCA'};
      --accent: ${branding.accentColor || '#5D6B6B'};
      --secondary: ${branding.secondaryColor || '#D5E5E5'};
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #1a1a1a;
      line-height: 1.65;
      margin: 0;
      background: #fff;
    }
    .print-optimized { max-width: 820px; margin: 0 auto; }
    .cover {
      min-height: 100vh;
      background: linear-gradient(145deg, var(--primary) 0%, var(--secondary) 55%, #fff 100%);
      padding: 4rem 3rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      page-break-after: always;
    }
    .cover h1 { font-size: 2.2rem; margin: 1rem 0 0.5rem; color: var(--accent); }
    .cover .meta { margin-top: 2.5rem; font-size: 1rem; color: #444; }
    .toc { padding: 3rem 2.5rem; page-break-after: always; }
    .toc h1 { color: var(--accent); border-bottom: 3px solid var(--primary); padding-bottom: 0.5rem; }
    .toc li { margin: 0.65rem 0; font-size: 1.05rem; }
    .section { padding: 2rem 2.5rem 1rem; page-break-inside: avoid; }
    .section h2 {
      color: var(--accent);
      border-left: 4px solid var(--primary);
      padding-left: 0.75rem;
      margin-top: 0;
    }
    .section-body p { margin: 0.75rem 0; }
    .section-body ul { margin: 0.5rem 0 1rem 1.25rem; }
    .section-body h3 { font-size: 1rem; color: #333; margin: 1rem 0 0.35rem; }
    .footer-note {
      margin: 2rem 2.5rem 3rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e5e5;
      font-size: 0.75rem;
      color: #666;
      text-align: center;
    }
    @media print {
      @page { size: A4; margin: 1.2cm; }
      .cover { min-height: 95vh; }
    }
  `;

  const sectionHtml = sections
    .map(
      (section) => `
      <div id="${section.id}" class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <div class="section-body"><p>${markdownToHtml(section.content)}</p></div>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${brandStyle}</style>
</head>
<body class="print-optimized">
  <div class="cover">
    ${cover.logo ? `<img src="${escapeHtml(cover.logo)}" alt="Logo" style="max-height:72px;margin-bottom:1.5rem;" />` : ''}
    <h1>${escapeHtml(title)}</h1>
    <p style="font-size:1.1rem;opacity:0.85;">${escapeHtml(subtitle)}</p>
    <div class="meta">
      <p><strong>Prepared for:</strong> ${escapeHtml(cover.client)}</p>
      <p><strong>Period:</strong> ${escapeHtml(cover.period)}</p>
      <p><strong>Generated:</strong> ${escapeHtml(date)}</p>
      <p style="margin-top:2rem;font-weight:600;">${escapeHtml(branding.agencyName)}</p>
    </div>
  </div>
  <div class="toc">
    <h1>Table of Contents</h1>
    <ol>
      ${toc.map((item) => `<li><a href="#${item.id}" style="color:inherit;text-decoration:none;">${escapeHtml(item.title)}</a></li>`).join('')}
    </ol>
  </div>
  ${sectionHtml}
  <div class="footer-note">
    Generated by ${escapeHtml(branding.agencyName)} · ${escapeHtml(date)} · Confidential client report
  </div>
</body>
</html>`;
}