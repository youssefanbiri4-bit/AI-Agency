import type { Task } from '@/types';
import type { CreativeAssetRecord, ReelRecord } from '@/types/database';

export interface ReportBranding {
  agencyName: string;
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  secondaryColor?: string;
}

export interface ClientReportSection {
  id: string;
  title: string;
  content: string;
  type: 'summary' | 'insights' | 'plan' | 'performance' | 'recommendations' | 'deliverables';
}

export interface ReportPerformanceMetrics {
  tasksTotal: number;
  tasksCompleted: number;
  tasksNeedsReview: number;
  tasksFailed: number;
  tasksProcessing: number;
  reelsTotal: number;
  reelsPublished: number;
  reelsReady: number;
  reelsScheduled: number;
  creativeAssetsTotal: number;
  creativeAssetsGenerated: number;
  reviewsCount: number;
  periodLabel: string;
  dataSources: string[];
}

export interface ClientReport {
  title: string;
  subtitle: string;
  date: string;
  cover: {
    agency: string;
    client: string;
    period: string;
    logo?: string | null;
  };
  toc: Array<{ id: string; title: string }>;
  sections: ClientReportSection[];
  branding: ReportBranding;
  performance: ReportPerformanceMetrics;
  rawData?: {
    tasks: Task[];
    reels: ReelRecord[];
    creativeAssets: CreativeAssetRecord[];
  };
}

export type ClientReportTemplate = 'full' | 'executive' | 'performance';

export interface GenerateReportOptions {
  workspaceId: string;
  workspaceName: string;
  tasks: Task[];
  reels?: ReelRecord[];
  creativeAssets?: CreativeAssetRecord[];
  branding?: ReportBranding;
  period?: string;
  template?: ClientReportTemplate;
  reviewsCount?: number;
}

export interface GenerateServerPdfOptions {
  password?: string;
  filename?: string;
}