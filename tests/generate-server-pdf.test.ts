import { describe, expect, it } from 'vitest';
import { generateClientReport } from '@/lib/reports/report-generator';
import { generateServerPDF } from '@/lib/reports/generate-server-pdf';

describe('generateServerPDF', () => {
  it('produces a valid PDF buffer (pdf-lib fallback when Chromium unavailable)', async () => {
    const report = generateClientReport({
      workspaceId: 'ws-1',
      workspaceName: 'Test Client',
      tasks: [],
      reels: [],
      creativeAssets: [],
      branding: { agencyName: 'AgentFlow AI' },
      reviewsCount: 0,
      period: 'June 2026',
    });

    const buffer = await generateServerPDF(report);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});