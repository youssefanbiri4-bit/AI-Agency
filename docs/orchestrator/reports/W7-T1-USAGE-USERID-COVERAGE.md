# W7-T1 — Per-Member Usage Attribution: `userId` Coverage

**Status:** ✅ Complete  
**Branch:** `fix/wave7-userid-coverage`

## Summary

Added `userId` attribution to all major user-facing `incrementUsage` call sites. Previously only `src/actions/tasks.ts` and `src/actions/creative-assets.ts` passed `userId` (added in Wave 5), but those wrappers were dead code — no UI component imported them.

This wave wires `incrementUsage` with the acting user's ID directly into the live UI-connected action files.

## Call Sites Updated (pass `userId`)

| # | File | Quota Type | Source of `userId` |
|---|---|---|---|
| 1 | `src/app/(dashboard)/dashboard/create-task/actions.ts` | `tasks` | `getRBACContext().data.user.id` |
| 2 | `src/app/(dashboard)/dashboard/reels/actions.ts` | `reels_publishes` | `getCurrentWorkspaceContext().user.id` |
| 3 | `src/app/(dashboard)/dashboard/ai-studio/actions.ts` | `ai_generations` | `getWorkspaceContext().user.id` |
| 4 | `src/app/(dashboard)/dashboard/assistant/actions.ts` | `ai_generations` | `supabase.auth.getUser().user.id` |
| 5 | `src/app/(dashboard)/dashboard/content-studio/actions/content-crud.ts` | `content_items` | `getWorkspaceContext().user.id` |
| 6 | `src/app/(dashboard)/dashboard/content-studio/actions/content-generation.ts` | `ai_generations` | `getWorkspaceContext().user.id` |
| 7 | `src/app/(dashboard)/dashboard/content-studio/actions/publishing.ts` | `content_publishes` | `getWorkspaceContext().user.id` |
| 8 | `src/app/(dashboard)/dashboard/content-studio/actions/campaign-planner.ts` | `ai_generations`, `content_items` | `getWorkspaceContext().user.id` |

## Call Sites Still `null` (Intentional)

These paths are true system/cron jobs or internal lib calls where no user context exists:

| # | File | Reason |
|---|---|---|
| 1 | `src/lib/usage/usage-limits.ts` — `incrementUsageCounter` + `recordUsageEvent` | Core lib; accepts `userId` from callers (propagated correctly) |
| 2 | `src/lib/usage/quotas.ts` — `incrementUsage` | Core lib; accepts `userId` from callers (propagated correctly) |
| 3 | `src/lib/queue/workers/task-worker.ts` | Cron/queue worker — no session |
| 4 | `src/app/api/n8n/callback/route.ts` | Webhook callback — no session |
| 5 | `src/app/api/tasks/fail-stale/route.ts` | Cron job — no session |

## How to Verify in Team Usage UI

1. Perform each action as a distinct workspace member:
   - **Create a task** → `/dashboard/create-task`
   - **Publish a reel** → `/dashboard/reels` → publish
   - **Generate an AI image** → `/dashboard/ai-studio`
   - **Generate content field** → `/dashboard/content-studio` → open item → generate script/caption/etc.
   - **Create content item** → `/dashboard/content-studio` → new item
   - **Publish content** → `/dashboard/content-studio` → publish item
   - **Ask assistant** → `/dashboard/assistant`
   - **Generate campaign plan** → `/dashboard/content-studio` → campaign planner

2. Open **Team Usage** view at `/dashboard/usage` — the "Usage by Member" section should show per-member breakdowns with the acting user's email and usage counts.

3. Direct DB query to verify:
   ```sql
   SELECT ue.user_id, ue.quota_type, ue.amount, ue.created_at
   FROM usage_events ue
   WHERE ue.user_id IS NOT NULL
   ORDER BY ue.created_at DESC
   LIMIT 20;
   ```

## Gates

- ✅ Typecheck: `tsc --noEmit` passes
- ✅ Lint: `eslint . --max-warnings 60` — 0 errors
- ✅ Tests: 30 files, 203 tests pass
