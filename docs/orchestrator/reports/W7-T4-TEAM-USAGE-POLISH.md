# W7-T4-TEAM-USAGE-POLISH

**Status:** Done  
**Branch:** `feature/wave7-team-usage-polish`  
**Owner:** Agent 2  

## Summary

Polished the **Usage by Team Member** table on `/dashboard/usage` with sort, search filter, and CSV export for admin users. The section was already admin-only — no access change needed.

## Changes

### File: `src/app/(dashboard)/dashboard/usage/TeamUsageSection.tsx`

Rewrote from plain server component to a `'use client'` component with interactive controls:

| Feature | Detail |
|---------|--------|
| **Sort** | Cycles through: Name A→Z, Name Z→A, Usage high→low, Usage low→high. Button shows current direction with `ArrowUp`/`ArrowDown` icon. |
| **Filter** | Text input with `Search` icon. Filters by member name, email, or role. Shows "No members match your search." when empty after filter. |
| **CSV Export** | `Button` with `Download` icon. Generates a CSV with columns: Member, Email, Role, each quota type, and Total. Only shown to admin (section is already admin-only). Uses `Blob` + download link — no server endpoint needed. |
| **Total column** | Added a "Total" column (sum across all quota types) when per-user data exists. |
| **Empty states** | Preserved the existing honest `—` dashes when `hasPerUserData` is false. Added "No workspace members found." row for empty member list. |

### No changes to:
- `page.tsx` — already passes `data` prop correctly
- `team-usage.ts` — data fetching logic unchanged
- No Stripe/commercial UI touched

## Gates

| Gate | Result |
|------|--------|
| `npm run typecheck` | Passed (0 errors) |
| `npm run lint` | Passed (0 errors, 17 pre-existing warnings) |

## Success Criteria

- [x] Sort/filter usable (cycling sort + text search)
- [x] CSV export works for admin
- [x] Gates green
- [x] Report written
