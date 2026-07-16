# ORCH-2: Memory System + Planning & Reasoning Engine

**Date:** Thu Jul 16 2026
**Task ID:** ORCH-2
**Title:** Memory System + Planning & Reasoning Engine
**Status:** ✅ Complete

---

## Summary

Built a production-grade Memory System, Planning Engine (Chain-of-Thought + ReAct),
Multi-Step Reasoning module, and Human-in-the-Loop (HITL) integration for the AgentFlow-AI
platform. All new code reuses existing infrastructure conventions: the raw-OpenAI text
provider (`generateTextWithOpenAI`), Supabase service-role data access (`getSupabaseAdmin`),
Redis working memory (`getRedisClient`), `logger.child(...)`, `increment`/`timing` metrics,
`DataResult<T>` returns, and colocated Vitest tests.

No changes to unrelated modules; the project still compiles cleanly (no new TypeScript errors
introduced across the wider tree).

---

## 1. Memory System

Two-tier memory matching the cognitive-science model.

### Short-term (working) memory — `src/lib/memory/short-term.ts`
- Redis-backed conversation buffer + scratchpad keyed by `runId` (`agent:stm:<runId>`), with
  a 30-minute TTL (`EX` seconds).
- **Graceful fallback:** when Redis is unavailable, an in-process `Map` keeps the session
  alive (no crash, degraded durability).
- API: `getShortTermMemory`, `addMessage`, `updateScratchpad`, `getScratchpad`,
  `clearShortTermMemory`.
- `MemoryMessage` records `role`, `content`, optional `toolName`, timestamps.

### Long-term (persistent) memory — `src/lib/memory/long-term.ts`
- Backed by a new `agent_memory` Supabase table (RLS: service-role only).
- Four memory categories: `episodic` (events), `semantic` (facts), `procedural` (how-to),
  `working` (scratch). Ranked by `importance` then recency; optional tag filter via
  `contains(tags, …)`; expired rows excluded automatically.
- API: `storeMemory`, `recallMemories`, `forgetMemory`, `pruneExpiredMemories`.
- `recallMemories` best-effort touches `last_accessed_at` (fire-and-forget).
- `embedding smallint[]` column reserved for a future pgvector semantic-search upgrade
  (current recall is metadata/tag/importance based — no new vector dependency introduced).

### Types — `src/lib/memory/types.ts`
`MemoryType`, `MemoryEntry`, `MemoryMessage`, `ShortTermMemory`, `RecallQuery`,
`isValidMemoryType()`.

---

## 2. Planning Engine

### Chain-of-Thought planner — `src/lib/planning/planner.ts`
- `createPlan()` prompts the LLM to decompose a goal into an ordered, verifiable step list
  (JSON contract). Steps carry `title`, `description`, `rationale`, `kind`
  (`action`|`reasoning`|`human_review`), and `dependsOn` wired to the previous step id.
- **Resilient:** if the LLM is unavailable or returns unparseable output, a deterministic
  2-step (reason → act) fallback plan is produced so the engine is always runnable.
- Steps needing human sign-off are marked `requiresApproval: true`.

### ReAct loop — `src/lib/planning/react.ts`
- `runReact()` interleaves **Reason → Act → Observe** up to `maxIterations` (default 8).
- Each iteration asks the LLM for `{ thought, action, actionInput, finish, answer }`; a
  registered `ToolDefinition` is invoked, the observation is written back into short-term
  memory, and successful actions are persisted as `episodic` long-term memories.
- Unknown tools and tool failures are handled without crashing the loop.
- **HITL integration:** when `enableHumanReview` is set and a step/tool requests approval,
  the loop pauses (`status: 'blocked'`), creates a `human_review_requests` row, and stops
  until a human decides (`blockedOnApproval` flag on the outcome).
- `ToolContext` exposes `memory`, `recall`, and run metadata to tools.

### Multi-Step Reasoning — `src/lib/planning/reasoning.ts`
- `reason()` produces a structured chain of `hypothesis | evidence | conclusion | assumption`
  nodes with confidences and `supports` links.
- Returns `verified: boolean`; when verified **and** `persist: true`, the conclusion is
  written to long-term **semantic** memory for future recall.

### Types — `src/lib/planning/types.ts`
`Plan`, `PlanStep`, `StepStatus`, `StepKind`, `ToolDefinition`, `ToolContext`, `ToolResult`,
`ReasoningNode`, `ReasoningChain`.

### Facade — `src/lib/orchestration.ts`
Thin re-export wrapper (`planGoal`, `runAgentLoop`, `reasonAbout`, `recall`, `remember`,
`requestReview`, `resolveReview`, `pendingReviews`) so callers don't wire every module.

---

## 3. Human-in-the-Loop Integration — `src/lib/human-review/`

- New `human_review_requests` Supabase table (RLS: service-role only) with `status`
  (`pending|approved|rejected|expired|cancelled`), `reviewer_id`, `decision_note`,
  `expires_at`.
- API (`store.ts`):
  - `requestHumanReview(input)` — create a pending request (optional `expiresInHours`).
  - `getReviewRequest(id)`, `listPendingReviews(workspaceId)` — for UIs/APIs.
  - `decideReview(id, 'approved'|'rejected', { reviewerId, note })` — only acts on
    `pending` rows (idempotent guard).
  - `expireOverdueReviews()` — cron-friendly sweep that flips past-due `pending` → `expired`.
- Wired directly into `runReact`: approval-gated steps halt the autonomous loop and surface
  a review request; resolution via `decideReview` lets the loop resume.

---

## 4. Database Changes

**Migration:** `supabase/migrations/20260721000000_orch2_memory_planning.sql`
- `agent_memory` table (workspace-scoped, indexes on workspace/agent/tags/expiry).
- `human_review_requests` table (workspace-scoped, indexes on workspace+status and run_id).
- Both enable RLS with a service-role-only policy (consistent with the existing
  `backup_jobs` pattern).

**Types:** `agent_memory` and `human_review_requests` added to `src/types/database.ts`
(Row / Insert / Update), matching the generated-Database convention used elsewhere.

---

## 5. Verification

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`, new modules) | ✅ 0 errors |
| ESLint (new modules) | ✅ 0 errors / 0 warnings |
| Vitest (new modules) | ✅ 14 passed / 14 |
| Supabase migration | ✅ syntactically consistent with existing migrations; applies via `supabase db push` |
| DB types | ✅ match migration schema |

### Tests (colocated `*.test.ts`)
- `human-review/store.test.ts` — unconfigured fallback + status validation.
- `memory/short-term.test.ts` — Redis-backed + in-memory fallback, messages, scratchpad.
- `memory/long-term.test.ts` — store/recall normalization, error propagation.
- `planning/planner.test.ts` — LLM JSON parsing → ordered steps; deterministic fallback.
- `planning/reasoning.test.ts` — verified chain persistence; unverified suppression.
- `planning/react.test.ts` — tool call + observe + finish; HITL block; LLM-down failure.

---

## 6. Notes / Out of Scope

- **Embeddings/vector search:** the `embedding` column exists but semantic recall is
  currently metadata/tag/importance based. A pgvector upgrade + embedding pipeline can be
  added later without changing the public API.
- **LLM coupling:** uses the existing `generateTextWithOpenAI` (OpenAI only). Swapping
  providers is isolated to that module.
- **UI for reviews:** `listPendingReviews`/`decideReview` are ready for a dashboard/API;
  no UI was built (out of task scope).
- **Existing `src/lib/orchestrator/`**: a separate pre-existing module with its own
  concerns; this task's facade is `src/lib/orchestration.ts` (deliberately distinct name).

---

## Status

✅ **Complete** — Memory System, Planning Engine (CoT + ReAct), Multi-Step Reasoning, and
Human-in-the-Loop integration implemented, tested, and type-clean.
