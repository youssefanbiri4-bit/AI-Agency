# W7-T5 — Limit Changes Audit UI

**Status:** ✅ Complete  
**Branch:** `feature/wave7-limits-audit-ui`

## Summary

Added a "Limit Changes" section to `/dashboard/usage` (admin/owner only) showing who changed quota limits and when, sourced from the existing `security_audit_logs` table.

## Files Changed

| File | Change |
|---|---|
| `src/app/(dashboard)/dashboard/usage/limit-changes.ts` | **New** — `getLimitChangeEvents()` queries `security_audit_logs` for `quota_limits_updated`, `quota_limits_reset`, `usage_limits_updated` events; `formatChangeSummary()` extracts human-readable change summary from event metadata |
| `src/app/(dashboard)/dashboard/usage/LimitChangesSection.tsx` | **New** — Table component showing Who (name + email from profiles), Action (type with color label), When (formatted datetime), Summary (parsed override/limit values) |
| `src/app/(dashboard)/dashboard/usage/page.tsx` | **Modified** — Fetches limit change events when user is admin, renders `LimitChangesSection` in the admin block |

## Data Source

Real data from `security_audit_logs` via authenticated supabase client (RLS allows workspace members to SELECT). Query pattern:

```sql
SELECT id, user_id, event_type, message, metadata, created_at
FROM security_audit_logs
WHERE workspace_id = $1
  AND event_type IN ('quota_limits_updated', 'quota_limits_reset', 'usage_limits_updated')
ORDER BY created_at DESC
LIMIT 20;
```

User names are resolved via a second query to `profiles` (same pattern as `team-usage.ts`).

## Events Tracked

| Event Type | Source | Description |
|---|---|---|
| `quota_limits_updated` | `settings/actions/limits.ts` | Admin overrides individual limits via settings page |
| `quota_limits_reset` | `settings/actions/limits.ts` | Admin resets all limits to plan defaults |
| `usage_limits_updated` | `usage/actions.ts` | Admin adjusts limits via the Adjust Limits form on usage page |

## UI

- Card with "Limit Changes" title, shown only when user has admin/owner role
- Table columns: Who (name + email), Action (color-coded), When, Summary
- Empty state: "No limit changes have been recorded yet."
- Summary parses `metadata.overrides` for overridden values, or direct `max_*` fields from the AdjustLimitsForm metadata
- Last 20 events shown, most recent first

## Gates

- ✅ Typecheck: `tsc --noEmit` — clean
- ✅ Lint: `eslint` on changed files — clean
- ✅ Tests: 30 files, 203 passed

## Verification

1. Log in as admin/owner
2. Navigate to `/dashboard/usage`
3. Scroll to the "Limit Changes" card (below Team Usage section)
4. Make a change via "Adjust Limits" form — a new row should appear showing your name, "Limits Adjusted", and the values you changed
5. Verify the settings page limit overrides also appear as "Limits Updated" events
