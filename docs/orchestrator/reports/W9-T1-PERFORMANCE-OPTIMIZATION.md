# Wave 9, Task 1: Performance Optimization

**Date:** 2026-07-13

**Goal:** Identify and plan optimizations for database queries, pagination, caching, and slow query patterns across the codebase.

**Status:** Report complete — awaiting Project Owner approval for any file modifications.

---

## 1. Database Index Analysis

### 1.1 Existing Composite Index Coverage

The schema is already well-indexed for most list queries. Every major table has at least one composite index on `(workspace_id, sort_column DESC)`:

| Table | Composite Index | Covers |
|-------|-----------------|--------|
| `tasks` | `idx_tasks_workspace_status (workspace_id, status)` | Filter by workspace + status |
| `projects` | `projects_workspace_updated_idx (workspace_id, updated_at DESC)` | Sort by updated_at |
| `releases` | `releases_workspace_updated_idx (workspace_id, updated_at DESC)` | Sort by updated_at |
| `reels` | `reels_workspace_created_idx (workspace_id, created_at DESC)` | Sort by created_at |
| `creative_assets` | `creative_assets_workspace_created_idx (workspace_id, created_at DESC)` | Sort by created_at |
| `content_studio_items` | `content_studio_items_workspace_updated_idx (workspace_id, updated_at DESC)` | Sort by updated_at |
| `notifications` | `notifications_workspace_user_created_idx (workspace_id, user_id, created_at DESC)` | Filter by workspace+user, sort by created_at |
| `usage_events` | `usage_events_workspace_quota_created_idx (workspace_id, quota_type, created_at DESC)` | Monthly aggregation query |

### 1.2 Missing Indexes

#### 1.2.1 `tasks` — no `(workspace_id, created_at DESC)`

**Impact:** The `listTasks()` function (`src/lib/data/tasks.ts:101-124`) queries `.eq('workspace_id', workspaceId).order('created_at', { ascending: false })`. Without a composite index on `(workspace_id, created_at DESC)`, Postgres will either:
- Use the `tasks_workspace_id_idx` index and sort in memory (slow for large result sets)
- Full table scan

**Recommendation:** Add `create index if not exists tasks_workspace_created_idx on public.tasks(workspace_id, created_at desc);`

#### 1.2.2 `tasks` — no `(workspace_id, priority)` for priority filtering

**Impact:** If the UI adds priority-based filtering, this index would be needed. Low priority for now.

#### 1.2.3 `content_studio_item_assets` — no `(content_item_id, creative_asset_id)` covering index

**Impact:** The `getContentStudioItemById()` function queries `.eq('content_item_id', item.id)` after fetching an item. There's already `content_studio_item_assets_item_idx` on `(content_item_id)`, which covers the lookup — but adding `creative_asset_id` as a covering column could enable index-only scans for the join.

**Recommendation:** Consider replacing with `content_studio_item_assets_item_idx(content_item_id, creative_asset_id)` — low priority.

---

## 2. Pagination Analysis

### 2.1 Current Architecture

All 4 main list pages use **client-side pagination**:

| Page | Server Fetch | Client Pagination |
|------|-------------|-------------------|
| Projects | `listProjectsForWorkspace()` with `limit` only | `usePagination` (pageSize 50) |
| Releases | `listReleasesForWorkspace()` with `limit` only | `usePagination` (pageSize 50) |
| Content Library | `listContentStudioItems()` with `limit` only | `usePagination` (pageSize 50) |
| Reels | `listReelsForWorkspace()` → `listReels()` with `limit` only | `usePagination` (pageSize 50) |

**The problem:** The `usePagination` hook (`src/hooks/usePagination.ts:19`) runs `.slice()` on the **entire** dataset in memory. For workspaces with hundreds or thousands of items, this means:
- All rows are fetched from the database (with `.limit()` defaulting to 1000 in Supabase)
- Transferred over the network
- Held in component state
- Sliced client-side

### 2.2 Only Reel Has Server-Side Offset Support

`listReels()` in `src/lib/data/reels.ts:117-119` accepts `options.offset` and uses `.range()` for server-side pagination — but `listReelsForWorkspace()` never passes it.

### 2.3 Recommendation: Server-Side Cursor/Offset Pagination

**Phase 1 — Add `offset` to all list functions:**

Add `offset` parameter to `ListProjectsOptions`, `ListReleasesOptions`, `ListContentStudioItemsOptions`, `ListReelsOptions`. Pass it through to Supabase `.range()`.

**Phase 2 — Add `getTotalCount()` companion functions:**

Each list page needs a `count()` query for total pages. Use `{ count: 'exact', head: true }` for efficient count-only queries.

**Phase 3 — Move pagination state to server:**

Convert `usePagination` from client-side slicing to a server-action-based pattern where each page fetch passes `page` and `pageSize` to the server.

**Priority:** Medium — only needed if workspaces exceed ~500 items.

---

## 3. Query Pattern Issues

### 3.1 Widespread `select('*')`

**Found:** 100+ occurrences of `.select('*')` across all data lib files.

**Impact:** Transfers unnecessary columns over the network and prevents index-only scans.

**Examples:**
- `projects.ts:329` — `.select('*')` when only a subset of fields are displayed
- `releases.ts:147` — `.select('*')` with the same pattern
- `content-studio.ts:144` — `.select('*')` then `mapAssets()` only uses specific fields

**Recommendation:** Audit each list query and replace `'*'` with specific column lists matching the UI's actual field usage.

**Priority:** Low — minor savings; worthwhile as a batch refactor.

### 3.2 Sequential N+1 in `listContentStudioItems()`

**File:** `src/lib/data/content-studio.ts:141-188`

After fetching items, it makes a **second** query for asset links:
```
1: SELECT * FROM content_studio_items WHERE workspace_id = $1 ORDER BY updated_at DESC
2: SELECT * FROM content_studio_item_assets WHERE content_item_id IN ($ids...)
```

**Impact:** Two round trips per list load. With the existing index on `content_studio_item_assets(content_item_id)`, this is fast but still adds latency.

**Recommendation:** Consider a single query with a LEFT JOIN, or a Supabase `.select('*, content_studio_item_assets(*)')` if the ORM supports it. Alternatively, cache the asset-to-item mappings if they're accessed frequently.

**Priority:** Low — acceptable for moderate item counts.

### 3.3 `incrementUsageCounter()` Read-Then-Write Race Condition

**File:** `src/lib/usage/usage-limits.ts:176-243`

The function reads `metadata`, increments a counter in JavaScript, then writes back:
```
1: SELECT metadata FROM usage_limits WHERE workspace_id = $1
2: UPDATE usage_limits SET metadata = $2 WHERE workspace_id = $1
```

**Problem:** Two concurrent requests for the same workspace will race — one overwrites the other's increment, losing counts.

**Impact:** Usage counters may undercount under concurrent load.

**Recommendation:** Use a Supabase RPC or a raw SQL update that increments atomically:
```sql
UPDATE usage_limits
SET metadata = jsonb_set(metadata, '{current_ai_generations}',
  (COALESCE((metadata->>'current_ai_generations')::int, 0) + 1)::text::jsonb)
WHERE workspace_id = $1;
```

Alternatively, rely on the `usage_events` table (which is append-only and race-safe) and compute counters from events, removing the metadata counter altogether.

**Priority:** Medium — correctness issue under concurrency.

---

## 4. Query Caching Opportunities

### 4.1 Current Caching

| Layer | Used? | Details |
|-------|-------|---------|
| `unstable_cache` (Next.js) | No | Not used anywhere |
| Redis | Yes | Only for BullMQ queue (`src/lib/queue/redis.ts`) |
| Upstash | Yes | Only for rate limiting |
| `NodeCache` | Yes | Only for provider states (5-min TTL) |
| `revalidatePath` | Yes | After mutations (manual cache busting) |
| Database query caching | No | No Redis-based query result caching |

### 4.2 Cacheable Query Patterns

**High-value caching targets:**

| Query | Cache Key | TTL | Rationale |
|-------|-----------|-----|-----------|
| Plan limits | `plan_limits:{plan}` | 10 min | Changes only on admin action |
| Usage counters | `usage_counters:{workspaceId}` | 30s | Fast-moving but not real-time critical |
| Provider readiness | Already cached via NodeCache | 5 min | Already done |
| Notifications unread count | `notif_unread:{workspaceId}:{userId}` | 15s | Changes frequently but okay to lag |

**Low-value caching targets (read-heavy but cache-invalidation-heavy):**

| Query | Reason to skip |
|-------|----------------|
| Tasks list | Changes every time a task is created/updated |
| Projects list | Changes on every create/update |
| Content studio items | Same as above |

### 4.3 Recommendation

**Implement a lightweight query cache layer using Redis (existing connection) with:**
- Configurable TTL per query pattern
- Manual invalidation after mutations (via existing mutation functions)
- Simple `get/set` helpers in `src/lib/cache/` module

**Alternative:** Use `unstable_cache` from Next.js (built-in) with tags for targeted revalidation. This requires zero infrastructure changes.

**Priority:** Low — adds complexity; only justified if pgBouncer/Supabase connection limits become a bottleneck.

---

## 5. Slow Query Monitoring

### 5.1 Current State
- No database-level query logging/monitoring infrastructure
- No slow query detection
- No EXPLAIN ANALYZE infrastructure in the codebase
- Application-level logging exists (`taskDataLog.info('before list tasks', ...)`) but no query duration tracking

### 5.2 Recommendation

**Option A: pg_stat_statements** (Postgres extension, production-safe)
Enable via Supabase dashboard. Track query frequency, mean time, and total time per normalized query.

**Option B: Application-level query timing wrapper**
Create a thin wrapper around Supabase queries that logs duration:
```typescript
async function timedQuery<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  if (duration > 100) logger.warn('Slow query', { label, duration_ms: duration });
  return result;
}
```

**Priority:** Medium — query timing is cheap and enables data-driven decisions.

---

## 6. Optimization Priority Matrix

| # | Optimization | Effort | Impact | Risk | Priority |
|---|-------------|--------|--------|------|----------|
| 1 | Add `tasks_workspace_created_idx` index | Very low | Medium | None | **High** |
| 2 | Fix `incrementUsageCounter` race condition | Low | Medium | Low | **Medium** |
| 3 | Add application-level query timing | Low | Medium | None | **Medium** |
| 4 | Server-side pagination with offset | Medium | Medium | Low | **Medium** |
| 5 | Replace `select('*')` with specific columns | Medium | Low | Low | Low |
| 6 | Redis/Next.js query cache | High | Medium | Medium | Low |
| 7 | N+1 in content_studio_items asset query | Low | Low | Low | Low |
| 8 | Covering index on `content_studio_item_assets` | Very low | Very low | None | Low |

---

## 7. Proposed Migration: `tasks_workspace_created_idx`

```sql
-- Supabase migration (new file)
create index if not exists tasks_workspace_created_idx
  on public.tasks(workspace_id, created_at desc);

comment on index public.tasks_workspace_created_idx is
  'Cover listTasks() query: filter by workspace_id, order by created_at desc';
```

This single index is the highest-value, lowest-risk change. It directly covers the most frequently executed list query in the application.

---

## 8. Files Referenced

| File | Relevance |
|------|-----------|
| `supabase/migrations/20260703000000_full_clean_schema.sql` | All existing indexes defined here |
| `src/hooks/usePagination.ts` | Client-side pagination hook |
| `src/components/ui/PaginationControls.tsx` | Pagination UI component |
| `src/lib/data/tasks.ts` | `listTasks()` — query needs index |
| `src/lib/data/projects.ts` | `listProjectsForWorkspace()` — uses limit-only |
| `src/lib/data/releases.ts` | `listReleasesForWorkspace()` — uses limit-only |
| `src/lib/data/reels.ts` | `listReels()` — supports offset but unused |
| `src/lib/data/creative-assets.ts` | `listCreativeAssets()` — uses limit-only |
| `src/lib/data/content-studio.ts` | `listContentStudioItems()` — sequential N+1 |
| `src/lib/usage/usage-limits.ts` | `incrementUsageCounter()` — race condition |
| `src/lib/queue/redis.ts` | Existing Redis connection (reusable for caching) |
| `src/lib/usage/quotas.ts` | Quota check logic |
