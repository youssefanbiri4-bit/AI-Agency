import { describe, expect, it } from 'vitest';
import {
  buildPerformanceMetrics,
  generateClientReport,
  renderReportToHTML,
} from '@/lib/reports/report-generator';
import type { Task } from '@/types';
import type { CreativeAssetRecord, ReelRecord } from '@/types/database';

const FAKE_ENGAGEMENT_PATTERNS = [
  /high engagement observed/i,
  /impressions:\s*\d/i,
  /clicks:\s*\d/i,
  /engagement rate:\s*\d/i,
  /ROI:\s*\d/i,
  /spend:\s*\$\d/i,
];

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    workspace_id: 'ws-1',
    title: 'Campaign Analysis',
    description: 'Analyze Q1 campaign',
    status: 'completed',
    priority: 'medium',
    agent_type: 'content-performance-agent',
    result: JSON.stringify({
      summary: 'Completed analysis with 3 actionable insights.',
      recommendations: ['Increase budget on top-performing reel'],
      qualityNotes: ['Caption length within platform limits'],
    }),
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-02T10:00:00Z',
    completed_at: '2026-06-02T10:00:00Z',
    ...overrides,
  } as Task;
}

const sampleReel: ReelRecord = {
  id: 'reel-1',
  workspace_id: 'ws-1',
  user_id: 'user-1',
  title: 'Summer Launch Reel',
  status: 'published',
  goal: 'Drive signups',
  caption: 'Check out our summer offer.',
  published_permalink: 'https://instagram.com/p/abc',
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-02T10:00:00Z',
} as ReelRecord;

const sampleAsset: CreativeAssetRecord = {
  id: 'asset-1',
  workspace_id: 'ws-1',
  user_id: 'user-1',
  title: 'Hero Banner',
  asset_type: 'image',
  status: 'generated',
  platform: 'instagram',
  prompt: 'Minimal product hero shot',
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-02T10:00:00Z',
} as CreativeAssetRecord;

describe('report-generator', () => {
  it('builds performance metrics from real workspace counts only', () => {
    const metrics = buildPerformanceMetrics({
      tasks: [makeTask(), makeTask({ id: 'task-2', status: 'needs_review' })],
      reels: [sampleReel, { ...sampleReel, id: 'reel-2', status: 'ready' } as ReelRecord],
      creativeAssets: [sampleAsset],
      reviewsCount: 4,
      period: 'June 2026',
    });

    expect(metrics.tasksTotal).toBe(2);
    expect(metrics.tasksCompleted).toBe(1);
    expect(metrics.tasksNeedsReview).toBe(1);
    expect(metrics.reelsPublished).toBe(1);
    expect(metrics.reelsReady).toBe(1);
    expect(metrics.creativeAssetsGenerated).toBe(1);
    expect(metrics.reviewsCount).toBe(4);
    expect(metrics.dataSources).toContain('tasks');
    expect(metrics.dataSources).toContain('reels');
  });

  it('does not include fabricated engagement or ad metrics', () => {
    const report = generateClientReport({
      workspaceId: 'ws-1',
      workspaceName: 'Acme Corp',
      tasks: [makeTask()],
      reels: [sampleReel],
      creativeAssets: [sampleAsset],
      branding: {
        agencyName: 'AgentFlow AI',
        primaryColor: '#F7CBCA',
        accentColor: '#5D6B6B',
      },
      reviewsCount: 2,
      period: 'June 2026',
    });

    const serialized = JSON.stringify(report);

    for (const pattern of FAKE_ENGAGEMENT_PATTERNS) {
      expect(serialized).not.toMatch(pattern);
    }

    const performanceSection = report.sections.find((s) => s.type === 'performance');
    expect(performanceSection?.content).toContain('Operational metrics');
    expect(performanceSection?.content).toContain('Total tasks: 1');
    expect(performanceSection?.content).toContain('Published: 1');
    expect(performanceSection?.content).toMatch(/not included unless connected provider metrics/i);
  });

  it('includes task summaries and deliverables from real records', () => {
    const report = generateClientReport({
      workspaceId: 'ws-1',
      workspaceName: 'Acme Corp',
      tasks: [makeTask()],
      reels: [sampleReel],
      creativeAssets: [sampleAsset],
      reviewsCount: 0,
    });

    expect(report.sections.some((s) => s.title === 'Executive Summary')).toBe(true);
    expect(report.sections.some((s) => s.title === 'Deliverables (Reels & Creative Assets)')).toBe(true);
    expect(report.toc.length).toBeGreaterThan(0);

    const html = renderReportToHTML(report);
    expect(html).toContain('Table of Contents');
    expect(html).toContain('Summer Launch Reel');
    expect(html).toContain('Hero Banner');
    expect(html).not.toMatch(/high engagement observed/i);
  });
});