# PERF-AGGREGATES-1 — Eliminate Live COUNT(*) on Quota Hot Paths

## Problem
Every `checkQuota()` call triggered **6 live COUNT(*) queries** against large production tables (`tasks`, `creative_assets`, `content_studio_items`, `reels`). At scale, these sequential aggregate queries become the performance bottleneck for every user action gated by quotas.

## Solution: Pre-computed Counters with DB Triggers

Replaced all 6 COUNT queries with a **`usage_counters` table** maintained by PostgreSQL triggers. Each INSERT/DELETE/UPDATE on a tracked table atomically increments/decrements the corresponding counter.

### New Table: `usage_counters`
| Column | Type | Description |
|--------|------|-------------|
| `workspace_id` | uuid | FK to workspaces |
| `quota_type` | text | e.g., `tasks`, `creative_assets`, `content_items` |
| `count` | integer | Pre-computed count (floor 0) |
| `updated_at` | timestamptz | Auto-maintained by trigger |

Unique constraint on `(workspace_id, quota_type)`.

### Triggers Created

| Table | Trigger | Counter(s) Updated |
|-------|---------|-------------------|
| `tasks` | `sync_tasks_usage` | `tasks` |
| `creative_assets` | `sync_creative_assets_usage` | `creative_assets`, `ai_generations` (image+openai only) |
| `content_studio_items` | `sync_content_studio_usage` | `content_items`, `content_publishes` (status transitions) |
| `reels` | `sync_reels_usage` | `reels_publishes` (status transitions) |

All triggers handle INSERT, DELETE, and (where status matters) UPDATE with proper increment/decrement logic.

## Before vs After

### Before (6 COUNT queries per quota check)
```sql
-- Each query scans the full table (or large subset)
SELECT count(*) FROM tasks WHERE workspace_id = $1;
SELECT count(*) FROM creative_assets WHERE workspace_id = $1;
SELECT count(*) FROM creative_assets WHERE workspace_id = $1 AND asset_type='image' AND source='openai' AND created_at > ...;
SELECT count(*) FROM content_studio_items WHERE workspace_id = $1;
SELECT count(*) FROM content_studio_items WHERE workspace_id = $1 AND status='published';
SELECT count(*) FROM reels WHERE workspace_id = $1 AND status='published';
```

### After (1 fast index read per quota type)
```sql
-- Single indexed lookup, O(1) regardless of table size
SELECT quota_type, count FROM usage_counters WHERE workspace_id = $1;
```

### Query Pattern Comparison

| Metric | Before | After |
|--------|--------|-------|
| Queries per quota check | 6 COUNT(*) + 6 usage_events + 1 metadata | 1 SELECT + 6 usage_events + 1 metadata |
| Table scans | 6 full/partial scans | 0 |
| Complexity | O(N) per query | O(1) per query |
| Write cost | None | +1 trigger per INSERT/DELETE (sub-ms) |

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/20260712000001_create_usage_counters.sql` | New migration: table, triggers, backfill |
| `src/lib/usage/usage-limits.ts` | Added `getUsageCountersFromTable()` function |
| `src/lib/usage/quotas.ts` | Removed 6 `computeCurrent*()` functions; `getCurrentUsage()` now uses `getUsageCountersFromTable()` |
| `src/types/database.ts` | Added `usage_counters` table type definition |

## Backward Compatibility
- `checkQuota()` API unchanged — same return type, same behavior
- `incrementUsage()` still dual-writes to metadata + usage_events
- Metadata counters and usage_events remain as additional safety sources
- `Math.max()` across all 3 sources ensures no under-counting

## Remaining COUNT Risks
| Risk | Mitigation |
|------|------------|
| `cost-tracking.ts` still sums `estimated_cost_usd` via query | Not a hot path (dashboard only); acceptable |
| `getMonthlyUsageByType()` aggregates usage_events | Already indexed; efficient for monthly window |
| Migration backfill runs COUNT once | One-time cost at deploy; indexes in place |
| Trigger race condition (concurrent inserts) | PostgreSQL row-level locking on `usage_counters` ensures atomicity; unlikely contention at current scale |
