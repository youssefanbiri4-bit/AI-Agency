import type {
  SupportTicketRecord,
  CustomerFeedbackRecord,
  NpsResponseRecord,
  ChurnAlertRecord,
} from '@/types/database';
import type {
  NpsSummary,
  ChurnRiskSummary,
  RetentionAnalytics,
} from '@/lib/data/customer-success';

export interface CsPageData {
  tickets: SupportTicketRecord[];
  feedback: CustomerFeedbackRecord[];
  nps: NpsResponseRecord[];
  npsSummary: NpsSummary;
  churnAlerts: ChurnAlertRecord[];
  churn: ChurnRiskSummary;
  retention: RetentionAnalytics;
  isConfigured: boolean;
}
