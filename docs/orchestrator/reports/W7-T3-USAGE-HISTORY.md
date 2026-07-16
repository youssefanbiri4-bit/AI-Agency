# W7-T3 — Usage History View

**Status:** ✅ Complete  
**Branch:** `feature/wave7-usage-history`

## Summary

Added a daily usage history view to `/dashboard/usage` showing daily totals for each quota type over the last 7 and 30 days. Uses real data from the `usage_events` table — no fabricated history.

## Files Changed

| File | Change |
|---|---|
| `src/app/(dashboard)/dashboard/usage/usage-history.ts` | **New** — `getUsageHistory()` queries `usage_events` grouped by day for last N days |
| `src/app/(dashboard)/dashboard/usage/UsageHistorySection.tsx` | **New** — React component rendering a table with inline horizontal bars per quota type per day |
| `src/app/(dashboard)/dashboard/usage/page.tsx` | **Modified** — Fetches 7-day and 30-day history, renders two `UsageHistorySection` cards |

## Data Source

Real data from `usage_events` table via the authenticated supabase client (RLS allows workspace members to SELECT). Query pattern:

```sql
SELECT quota_type, amount, created_at
FROM usage_events
WHERE workspace_id = $1
  AND created_at >= now() - interval 'N days'
ORDER BY created_at ASC
```

Grouped by date (YYYY-MM-DD) in-memory. Zero-fills missing quota types per day.

## UI

- Two cards below the quota grid: "Usage History (Last 7 Days)" and "Usage History (Last 30 Days)"
- Each card has a table with row per day (most recent first), columns for each quota type
- Each cell shows a colored bar proportional to that column's daily max, plus the raw count
- Color coding: AI Gen (violet), Tasks (blue), Assets (teal), Content (amber), Publishes (orange), Reels (pink)
- No chart library needed — pure div-based bars matching the existing design system
- Empty state handled: shows "No usage events recorded" when no data exists
- Accessible to all workspace members (same access as the usage page itself)

## Gates

- ✅ Typecheck: `tsc --noEmit` — clean
- ✅ Lint: `eslint` on changed files — clean
- ✅ Tests: 30 files, 203 passed

## Verification

1. Navigate to `/dashboard/usage`
2. Scroll to the "Usage History" cards below the quota display
3. Observe daily bars for each quota type over the last 7 and 30 days
4. Check that empty days show "No usage events recorded"
