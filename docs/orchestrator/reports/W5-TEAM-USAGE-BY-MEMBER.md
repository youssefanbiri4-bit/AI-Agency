# W5 — Usage by Team Member

**Task:** W5-TEAM-USAGE-BY-MEMBER  
**Branch:** feature/team-usage-by-member  
**Status:** ✅ Complete

---

## What Is Tracked

### Currently tracked per-user

| Data source | Has `user_id`? | Populated today? |
|-------------|----------------|------------------|
| `usage_events` | ✅ nullable | ❌ Never populated |
| `usage_counters` | ❌ | N/A |
| `agent_template_usage_events` | ✅ | ✅ (template actions only) |

**The `usage_events` table has a `user_id` column, but it is never populated.** The call chain `incrementUsage` → `incrementUsageCounter` → `recordUsageEvent` omits the `userId` parameter entirely. All existing usage is recorded as workspace totals.

### What the view shows

The **"Usage by Team Member"** section on `/dashboard/usage` (admin/owner only):

- **Member list**: every workspace member with name (from `profiles.full_name`), email, and role
- **Per-quota columns**: AI Gen, Tasks, Assets, Content, Publishes, Reels
- **Attribution**: `—` for all quotas (since `user_id` is never populated in `usage_events`)
- **Explanation box**: honest message that per-user tracking is not yet active

### What is NOT tracked yet

- Individual attribution for any quota type today
- The `usage_events.user_id` field needs to be populated at the source (`incrementUsage` / `recordUsageEvent` calls), then the view will start showing per-member numbers automatically

---

## Where the UI Lives

The section renders **below the "Adjust Limits" form** on `/dashboard/usage`, inside a `Card` with a table layout. Only owners and admins see it (uses the same `isAdmin` check as the Adjust Limits form).

### Page position order

1. PageHeader ("Usage & Quotas")
2. Quota cards (2-column grid of 6 quotas + cost card)
3. (admin) Adjust Limits form
4. **(admin) Usage by Team Member** ← new
5. (non-admin) "Contact your admin" footer

---

## Implementation Details

### Files added

| File | Purpose |
|------|---------|
| `src/app/(dashboard)/dashboard/usage/team-usage.ts` | `getTeamUsageData()` — fetches workspace members, profiles, and per-user usage_events |
| `src/app/(dashboard)/dashboard/usage/TeamUsageSection.tsx` | Server component rendering the member table with quota columns |
| `src/app/(dashboard)/dashboard/usage/page.tsx` (modified) | Added import, data fetch, and conditional render |

### Data flow

1. `getTeamUsageData(supabase, workspaceId)`:
   - Fetches `workspace_members` (user_id, role) for the workspace
   - Fetches `profiles` (full_name, email) for all member user_ids (joined in-memory)
   - Fetches `usage_events` with non-null `user_id` for the current month
   - Groups events by user_id and quota_type
   - Returns `{ members, perUserEvents, hasPerUserData }`

2. `TeamUsageSection` renders:
   - Table header with member/role/6 quota columns
   - One row per member showing name, role, and per-quota count or `—`
   - Info box explaining tracking status

### Future activation

When `incrementUsage` / `recordUsageEvent` calls begin passing `userId`, the section will automatically show real numbers — no code changes needed on the view side.

---

## Gates

- ✅ Typecheck: clean
- ✅ Tests: `tests/smoke/quotas.test.ts` — 8/8 passed
- ✅ No Stripe / payment code
- ✅ No existing usage/limits/admin forms broken
- ✅ Only Owner/Admin can see the member breakdown
