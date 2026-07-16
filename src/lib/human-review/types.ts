/**
 * Human-in-the-Loop (HITL) — shared types.
 *
 * Lets an autonomous run pause and ask a human to approve or reject a step
 * before it is allowed to proceed (e.g. publishing, spending, deleting).
 * Requests are persisted so they survive across processes and can be acted on
 * from a UI or API.
 */

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export const REVIEW_STATUSES: ReviewStatus[] = [
  'pending',
  'approved',
  'rejected',
  'expired',
  'cancelled',
];

export interface HumanReviewRequest {
  id: string;
  workspaceId: string;
  runId: string;
  stepId: string;
  agentType: string;
  reason: string;
  context: Record<string, unknown>;
  requestedAction?: string | null;
  status: ReviewStatus;
  reviewerId?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewInput {
  runId: string;
  workspaceId: string;
  agentType: string;
  stepId: string;
  reason: string;
  context?: Record<string, unknown>;
  requestedAction?: string | null;
  /** Hours until the request auto-expires. 0 = never. */
  expiresInHours?: number;
}

export type ReviewDecision = 'approved' | 'rejected';

export function isValidReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === 'string' && (REVIEW_STATUSES as string[]).includes(value);
}
