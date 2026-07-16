# W5-FINAL-USERID-USAGE — Report

**Date:** 2026-07-12  
**Status:** COMPLETE  
**Branch:** `fix/wave5-userid-usage-events`

---

## Objective

Make **Usage by Team Member** show real numbers by populating `user_id` on usage events.

---

## What Was Done

### Chain Traced

```
incrementUsage (quotas.ts)
  → incrementUsageCounter (usage-limits.ts)
    → recordUsageEvent (usage-limits.ts)
      → usage_events table (user_id column)
```

`recordUsageEvent` already accepted `userId` as optional — it was never passed down the chain.

### Files Modified

| File | Change |
|------|--------|
| `src/lib/usage/usage-limits.ts:176-180` | Added `userId?: string \| null` param to `incrementUsageCounter`. Passes it to `recordUsageEvent` at line 230. |
| `src/lib/usage/quotas.ts:329-333` | Added `userId?: string \| null` param to `incrementUsage`. Passes it to `incrementUsageCounter` at line 336. |
| `src/actions/tasks.ts:23,47` | Extracts `userId` from `rbacCheck.context.user.id`. Passes to `incrementUsage` in `gatedCreateTask` and `gatedExecuteTask`. |
| `src/actions/creative-assets.ts:19` | Extracts `userId` from `access.data.user.id`. Passes to both `incrementUsage` calls in `gatedGenerateImage`. |
| `src/app/(dashboard)/dashboard/usage/TeamUsageSection.tsx:49-53` | Updated empty state message from "not yet active" to accurate "no events recorded yet this month". |
| `tests/smoke/task-lifecycle.test.ts:96,164` | Updated expectations to include `'user-1'` as 4th arg. |
| `tests/smoke/quotas.test.ts:165` | Updated expectation to include `undefined` as 4th arg. |

### Call Sites Updated

| Call Site | Has User? | userId Source |
|-----------|-----------|---------------|
| `gatedCreateTask` (tasks.ts:36) | Yes | `rbacCheck.context.user.id` |
| `gatedExecuteTask` (tasks.ts:59) | Yes | `rbacCheck.context.user.id` |
| `gatedGenerateImage` (creative-assets.ts:32-33) | Yes | `access.data.user.id` |

### What Is Still Unattributable

- **`incrementUsageCounter` internal `recordUsageEvent` call** (usage-limits.ts:227-235): This is the event logged when a counter is incremented via the metadata path. The `userId` is now passed through from callers, so it will be attributed when the caller has a user context.
- **System/cron jobs**: Any direct calls to `recordUsageEvent` without a user context will leave `user_id` null — this is correct behavior. The Team Usage UI already filters for `user_id IS NOT NULL`.

### How to Verify in UI

1. Log in as a team member
2. Create a task → check `/dashboard/usage` → "Usage by Team Member" should show the task under your name
3. Execute an AI generation → should appear under your name
4. Generate a creative asset → should appear under your name
5. Events without a user context (system/cron) will not appear in per-member breakdown

---

## Quality Gates

| Gate | Status |
|------|:------:|
| typecheck | **PASS** (0 new errors — only pre-existing `.next/types` noise) |
| lint | **PASS** |
| build | **PASS** (compiled successfully) |
| test | **PASS** — 203/203 |

---

## Summary

- 4 source files modified (usage-limits.ts, quotas.ts, tasks.ts, creative-assets.ts)
- 1 UI component updated (TeamUsageSection.tsx)
- 2 test files updated (task-lifecycle.test.ts, quotas.test.ts)
- All quality gates green
- `user_id` now populates on usage events when actions are performed by authenticated users
- Team Usage UI will show real per-member numbers for new activity
