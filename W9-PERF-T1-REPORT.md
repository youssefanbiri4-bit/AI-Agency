# W9-PERF-T1-REPORT — Database Indexes + Race Condition + Pagination

## Summary
Audited 4 performance targets from W9-T1-PERFORMANCE-OPTIMIZATION.md. Two items (composite index, race condition) were already correctly implemented in prior migrations. Two items (pagination forwarding, `select('*')` reduction) required code changes in 3 data-layer files.

## Files Modified

### 1. `src/lib/data/reels.ts`
- **`listReels()`** (line 98): Replaced `select('*')` with all 33 explicit columns
- **`listReelsForWorkspace()`** (lines 130-137): Added `options: { limit?: number; offset?: number }` parameter — forwards pagination to `listReels()`

### 2. `src/lib/data/projects.ts`
- **`listProjectsForWorkspace()`** (line 330): Replaced `select('*')` with all 19 explicit columns

### 3. `src/lib/data/content-studio.ts`
- **`listContentStudioItemsForWorkspace()`** (line 145): Replaced `select('*')` with all 27 explicit columns
- **Asset links query** (line 180): Replaced `select('*')` with explicit `id, content_item_id, creative_asset_id, created_at`
- **`getContentStudioItemById()` asset links** (line 222): Same fix — explicit columns for `content_studio_item_assets`

## Already Verified (no changes needed)

### Composite Index: `tasks_workspace_created_idx`
- **Migration**: `20260713000000_add_tasks_workspace_created_idx.sql` already exists (lines 18-19)
- Uses `IF NOT EXISTS`, covers `tasks(workspace_id, created_at DESC)` exactly

### Race Condition: `increment_usage_counter`
- **Migration** `20260712000001_create_usage_counters.sql`: `increment_usage_counter()` at lines 19-34 uses `INSERT ... ON CONFLICT DO UPDATE` — fully atomic
- **Migration** `20260713000001_add_atomic_increment_usage_counter.sql`: `increment_usage_counter_metadata()` at lines 16-56 uses `jsonb_set` in atomic `UPDATE` with `INSERT ... ON CONFLICT DO UPDATE` fallback
- Both functions have `security definer`
- **TypeScript caller** `usage-limits.ts:184` calls `increment_usage_counter_metadata` RPC directly — no read-then-write in JS

### Server-side Pagination
- **`listTasks()`**: Already supports `limit` + `offset` ✅
- **`listProjectsForWorkspace()`**: Already supports `limit` + `offset` ✅
- **`listContentStudioItemsForWorkspace()`**: Already supports `limit` + `offset` ✅
- **`listReels()`**: Already supports `limit` + `offset` ✅

## SQL Changes
None — both migrations pre-exist. All work is in TypeScript data layer only.

## Tests
- No new TS errors introduced in the 3 modified files
- Backward-compatible API: `listReelsForWorkspace()` gains an optional 4th parameter with default `{}` — zero callers break
- All `select('*')` replacements use exact column lists matching `Database['public']['Tables']['X']['Row']`

## Remaining Issues
- Widespread `select('*')` persists in 17 other data-layer files (single-record getById/create/update functions) — acceptable per task scope
- `content_studio_item_assets.creative_asset_id` covering index not added — low priority

## Status
✅ **Complete**
