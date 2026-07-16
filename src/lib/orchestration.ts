import 'server-only';

import { createPlan } from '@/lib/planning/planner';
import { runReact } from '@/lib/planning/react';
import { reason } from '@/lib/planning/reasoning';
import { requestHumanReview, decideReview, listPendingReviews } from '@/lib/human-review/store';
import { recallMemories, storeMemory } from '@/lib/memory/long-term';
import type { PlanGoalInput } from '@/lib/planning/planner';
import type { ReactOptions } from '@/lib/planning/react';
import type { CreateReviewInput, ReviewDecision } from '@/lib/human-review/types';

/**
 * Orchestration facade for the Memory + Planning + Reasoning + HITL stack.
 * Keeps callers from having to wire every module together by hand.
 */

export async function planGoal(input: PlanGoalInput) {
  return createPlan(input);
}

export async function runAgentLoop(options: ReactOptions) {
  return runReact(options);
}

export async function reasonAbout(input: Parameters<typeof reason>[0]) {
  return reason(input);
}

export async function recall(input: Parameters<typeof recallMemories>[0]) {
  return recallMemories(input);
}

export async function remember(input: Parameters<typeof storeMemory>[0]) {
  return storeMemory(input);
}

export async function requestReview(input: CreateReviewInput) {
  return requestHumanReview(input);
}

export async function resolveReview(
  id: string,
  decision: ReviewDecision,
  opts?: { reviewerId?: string; note?: string }
) {
  return decideReview(id, decision, opts);
}

export async function pendingReviews(workspaceId: string) {
  return listPendingReviews(workspaceId);
}
