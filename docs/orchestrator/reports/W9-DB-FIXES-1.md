# W9-DB-FIXES-1: Database & Schema Fixes

**Status:** ✅ IMPLEMENTED — All changes applied, gates passed  
**Date:** 2026-07-13  
**Author:** Agent 1 (Database & Schema)

---

## Overview

Four database-level fixes addressing performance and correctness issues identified in the W9-T1 Performance Optimization audit. All changes have been applied and verified.

| # | Fix | Type | Effort | Risk | Priority |
|---|-----|------|--------|------|----------|
| 1 | Add `tasks_workspace_created_idx` | Migration only | ~5 min | None | **High** |
| 2 | Atomic `increment_usage_counter_metadata()` RPC | Migration + 1 file edit | ~30 min | Low | **High** |
| 3 | Server-side offset pagination in list functions | 5 data lib files | ~1 hr | Low | **Medium** |
| 4 | Improve missing indexes (secondary) | Migration only | ~5 min | None | Low |

---

## 1. Missing Index: `tasks_workspace_created_idx`

### Problem

The `listTasks()` function at `src/lib/data/tasks.ts:101-124` queries:

```typescript
client.from('tasks')
  .select('id, workspace_id, user_id, agent_type, title, ...')
  .eq('workspace_id', options.workspaceId)
  .order('created_at', { ascending: false })
  .limit(options.limit);
```

Without a composite index on `(workspace_id, created_at DESC)`, PostgreSQL must:
1. Filter by `workspace_id` using the existing `tasks_workspace_id_idx` (single-column)
2. Sort all matching rows in memory by `created_at DESC`

For workspaces with thousands of tasks, this in-memory sort becomes expensive.

### Existing Coverage

| Index | Columns | Covers query? |
|-------|---------|---------------|
| `tasks_workspace_id_idx` | `(workspace_id)` | Filters but doesn't cover sort |
| `tasks_workspace_agent_department_idx` | `(workspace_id, agent_department)` | Wrong second column |
| `idx_tasks_workspace_status` | `(workspace_id, status)` | Wrong second column |

### Migration

**File:** `supabase/migrations/20260713000000_add_tasks_workspace_created_idx.sql`

```sql
create index if not exists tasks_workspace_created_idx
  on public.tasks(workspace_id, created_at desc);

comment on index public.tasks_workspace_created_idx is
  'Cover listTasks() query: filter by workspace_id, order by created_at desc';
```

---

## 2. Race Condition: `incrementUsageCounter()`

### Problem

**File:** `src/lib/usage/usage-limits.ts:176-243`

```typescript
// STEP 1: Read
const { data: existing } = await supabase
  .from('usage_limits')
  .select('metadata')
  .eq('workspace_id', workspaceId)
  .maybeSingle();

// STEP 2: Modify in JS
metadata[counterKey] = current + amount;

// STEP 3: Write back
await supabase
  .from('usage_limits')
  .update({ metadata, updated_at: new Date().toISOString() })
  .eq('workspace_id', workspaceId);
```

**Race:** Two concurrent requests for the same workspace read the same `metadata` value at STEP 1, both increment in JS at STEP 2, then both write back at STEP 3. The second write overwrites the first, losing one increment.

### Existing Atomic Infrastructure

A separate `usage_counters` table with atomic `increment_usage_counter()` DB function already exists in `20260712000001_create_usage_counters.sql`. However, the TypeScript code still uses the old metadata-based approach.

### Solution

**Phase A — Migration:** Create an atomic `increment_usage_counter_metadata()` RPC function that uses a single `UPDATE ... jsonb_set` statement.

**File:** `supabase/migrations/20260713000001_add_atomic_increment_usage_counter.sql`

```sql
create or replace function public.increment_usage_counter_metadata(
  p_workspace_id uuid,
  p_quota_type text,
  p_amount integer default 1
)
returns void
language plpgsql
security definer
as $$
declare
  v_counter_key text;
begin
  v_counter_key := 'current_' || p_quota_type;

  update public.usage_limits
  set metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    array[v_counter_key],
    to_jsonb(coalesce((metadata ->> v_counter_key)::int, 0) + p_amount)
  ),
  updated_at = now()
  where workspace_id = p_workspace_id;

  if not found then
    insert into public.usage_limits (workspace_id, metadata, updated_at)
    values (
      p_workspace_id,
      jsonb_build_object(v_counter_key, p_amount),
      now()
    )
    on conflict (workspace_id) do update
    set metadata = jsonb_set(
      coalesce(excluded.metadata, '{}'::jsonb),
      array[v_counter_key],
      to_jsonb(coalesce((public.usage_limits.metadata ->> v_counter_key)::int, 0) + p_amount)
    ),
    updated_at = now();
  end if;
end;
$$;
```

**Phase B — TypeScript change:** Replace `incrementUsageCounter()` in `src/lib/usage/usage-limits.ts` to call the RPC instead of read-then-write:

```typescript
export async function incrementUsageCounter(
  workspaceId: string,
  type: QuotaType,
  amount = 1,
  userId?: string | null
): Promise<void> {
  const supabase = getAdminClient();

  const { error: rpcError } = await supabase.rpc('increment_usage_counter_metadata', {
    p_workspace_id: workspaceId,
    p_quota_type: type,
    p_amount: amount,
  });

  if (rpcError) {
    usageLog.error('Failed to increment usage counter atomically', {
      workspaceId,
      type,
      amount,
      error: rpcError.message,
    });
    throw new Error('Failed to increment usage counter');
  }

  usageLog.info('Usage counter incremented', { workspaceId, type, amount });

  try {
    await recordUsageEvent({
      workspaceId,
      userId,
      eventType: `${type}_increment`,
      quotaType: type,
      amount,
      metadata: { counter_source: 'rpc' },
    });
  } catch (eventError) {
    usageLog.warn('Failed to record usage event for monthly aggregation', {
      workspaceId,
      type,
      error: eventError instanceof Error ? eventError.message : String(eventError),
    });
  }
}
```

---

## 3. Server-Side Offset Pagination

### Problem

All list pages fetch the full dataset and paginate client-side via `usePagination().slice()`. For workspaces growing beyond ~500 items, this means:
- All rows fetched from DB (up to Supabase's default 1000-row limit)
- Transferred over network
- Held in component memory
- Sliced client-side

The `reels.ts` `listReels()` function already supports `offset` but `listReelsForWorkspace()` never passes it.

### Changes Required

Add `offset` to 5 data library files:

#### 3a. `src/lib/data/projects.ts`

Add to the inline options type:
```typescript
// Change from:
options: { limit?: number } = {}
// To:
options: { limit?: number; offset?: number } = {}
```

Add range query after the existing limit check:
```typescript
if (options.offset && options.offset > 0 && options.limit && options.limit > 0) {
  query = query.range(options.offset, options.offset + options.limit - 1);
}
```

#### 3b. `src/lib/data/releases.ts`

Same pattern — add `offset?: number` to options type and `.range()` after `.limit()`.

#### 3c. `src/lib/data/content-studio.ts`

Add `offset?: number` to `ListContentStudioItemsOptions` interface:
```typescript
export interface ListContentStudioItemsOptions {
  limit?: number;
  offset?: number;
  departmentScope?: unknown;
}
```

Add `.range()` after `.limit()` in `listContentStudioItemsForWorkspace()`.

#### 3d. `src/lib/data/creative-assets.ts`

Add `offset?: number` to `ListCreativeAssetsOptions` interface:
```typescript
export interface ListCreativeAssetsOptions {
  limit?: number;
  offset?: number;
  includeSignedUrls?: boolean;
  departmentScope?: unknown;
}
```

Add `.range()` after `.limit()` in `listCreativeAssetsForWorkspace()`.

#### 3e. `src/lib/data/tasks.ts`

Add `offset?: number` to `ListTasksOptions` interface:
```typescript
export interface ListTasksOptions {
  workspaceId?: string;
  agentType?: AgentType;
  status?: TaskStatus;
  limit?: number;
  offset?: number;
  userId?: string;
  departmentScope?: unknown[] | null;
}
```

Add `.range()` after `.limit()` in `listTasks()`:
```typescript
if (options.offset && options.offset > 0 && options.limit && options.limit > 0) {
  query = query.range(options.offset, options.offset + options.limit - 1);
}
```

### Caller Compatibility

All existing callers pass `{ limit: N }` without `offset`. The new `offset` parameter is `undefined` by default, so:

| Caller pattern | Backward compatible? |
|----------------|---------------------|
| `listProjectsForWorkspace(id, client, { limit: 200 })` | ✅ Yes |
| `listReleasesForWorkspace(id, client, { limit: 200 })` | ✅ Yes |
| `listContentStudioItemsForWorkspace(id, client, { limit: 500 })` | ✅ Yes |
| `listCreativeAssetsForWorkspace(id, uid, client, { limit: 80 })` | ✅ Yes |
| `listTasks({ workspaceId: id, limit: 100 })` | ✅ Yes |

### Reels Already Done

`listReels()` at `src/lib/data/reels.ts:117-119` already supports `offset` via `.range()`. No change needed.

---

## 4. Secondary Index Improvements

### 4.1 `content_studio_item_assets` covering index

**Current:** `content_studio_item_assets_item_idx(content_item_id)`  
**Recommendation:** Replace with `content_studio_item_assets_item_idx(content_item_id, creative_asset_id)` for index-only scans on the N+1 join query.

**Migration:**

```sql
drop index if exists content_studio_item_assets_item_idx;
create index if not exists content_studio_item_assets_item_idx
  on public.content_studio_item_assets(content_item_id, creative_asset_id);
```

**Priority:** Low — the existing index already covers the lookup.

---

## 5. Migration Execution Order

| Step | Migration File | Dependencies |
|------|---------------|--------------|
| 1 | `20260713000000_add_tasks_workspace_created_idx.sql` | None (pure index add) |
| 2 | `20260713000001_add_atomic_increment_usage_counter.sql` | Requires `usage_limits` table (exists since Wave 1) |
| 3 | (Optional) `20260713000002_add_content_studio_item_assets_covering_idx.sql` | Requires table (exists since Wave 1) |

All migrations are idempotent (use `IF NOT EXISTS` / `OR REPLACE`).

---

## 6. Files Requiring Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/migrations/20260713000000_add_tasks_workspace_created_idx.sql` | **New** | Composite index migration |
| `supabase/migrations/20260713000001_add_atomic_increment_usage_counter.sql` | **New** | Atomic RPC function |
| `src/lib/usage/usage-limits.ts` | **Edit** | Replace read-then-write with RPC call |
| `src/lib/data/projects.ts` | **Edit** | Add `offset` to options + `.range()` |
| `src/lib/data/releases.ts` | **Edit** | Add `offset` to options + `.range()` |
| `src/lib/data/content-studio.ts` | **Edit** | Add `offset` to `ListContentStudioItemsOptions` + `.range()` |
| `src/lib/data/creative-assets.ts` | **Edit** | Add `offset` to `ListCreativeAssetsOptions` + `.range()` |
| `src/lib/data/tasks.ts` | **Edit** | Add `offset` to `ListTasksOptions` + `.range()` |
| `supabase/migrations/20260713000002_add_content_studio_item_assets_covering_idx.sql` | **New** (low priority) | Covering index |

---

## 7. Verification (Results)

All gates pass with the applied changes:

| Check | Result |
|-------|--------|
| `npm run typecheck` | **PASS** — 0 new errors (2 pre-existing remain) |
| `npx eslint` on changed files | **PASS** — 0 errors, 0 warnings |
| `npm test` (Vitest) | **PASS** — 203/203 pass (30 files) |

### Pre-existing errors not related to this change:
- `src/app/auth/signup/page.tsx:3` — `'React'` import not exported from `'react'` (React 19+)
- `src/lib/alerts/email.ts:59` — `'nodemailer'` module not found (package not installed)

## 8. Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/20260713000000_add_tasks_workspace_created_idx.sql` | **New** — composite index on `tasks(workspace_id, created_at desc)` |
| `supabase/migrations/20260713000001_add_atomic_increment_usage_counter.sql` | **New** — `increment_usage_counter_metadata()` RPC function, `security definer`, atomic `jsonb_set` |
| `src/types/database.ts` | **Edit** — added `increment_usage_counter` and `increment_usage_counter_metadata` to `Functions` type |
| `src/lib/usage/usage-limits.ts` | **Edit** — replaced read-then-write with single `supabase.rpc()` call |
| `src/lib/data/tasks.ts` | **Edit** — added `offset` to `ListTasksOptions`, `.range()` in `listTasks()` |
| `src/lib/data/projects.ts` | **Edit** — added `offset` to options type, `.range()` in `listProjectsForWorkspace()` |
| `src/lib/data/releases.ts` | **Edit** — added `offset` to options type, `.range()` in `listReleasesForWorkspace()` |
| `src/lib/data/content-studio.ts` | **Edit** — added `offset` to `ListContentStudioItemsOptions`, `.range()` in list function |
| `src/lib/data/creative-assets.ts` | **Edit** — added `offset` to `ListCreativeAssetsOptions`, `.range()` in list function |
| `src/hooks/usePagination.ts` | **Edit** — added optional `totalCount` parameter for server-side pagination |
