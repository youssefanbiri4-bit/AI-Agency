export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AlertPayload {
  /** Logical source of the alert, e.g. 'quota', 'health', 'error-rate'. */
  source: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  /** Workspace the alert relates to (null/undefined = platform-wide). */
  workspaceId?: string | null;
  /** Optional deep-link shown in the notification. */
  relatedUrl?: string;
  /** Arbitrary structured context. */
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

export interface AlertChannel {
  name: string;
  /** Deliver the payload. Returns true on success, false if skipped/failed. */
  send(payload: AlertPayload): Promise<boolean>;
}
