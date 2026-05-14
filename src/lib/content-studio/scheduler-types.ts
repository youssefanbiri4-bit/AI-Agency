export interface ContentStudioSchedulerSummary {
  scanned: number;
  executed: number;
  skipped: number;
  succeeded: number;
  failed: number;
  setup_required: number;
  approval_pending: number;
  token_missing: number;
  quota_limit: number;
  manual_only: number;
  unsupported: number;
  error: number;
}
