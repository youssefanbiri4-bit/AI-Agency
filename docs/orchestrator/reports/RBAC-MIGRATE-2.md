# RBAC-MIGRATE-2 Report — Client-Side RBAC Migration

**Date:** 2026-07-12
**Priority:** High
**Branch:** `fix/rbac-migrate-client-cleanup`

## Summary

Completed the full migration of all ~30 call sites from the legacy `@/lib/workspace-permissions` module to `@/lib/auth/rbac` (and `@/lib/permissions-matrix` for type-only imports). The legacy file has been removed.

## What Changed

### Core Refactoring

| File | Change |
|------|--------|
| `src/lib/auth/rbac.ts` | Inlined `getWorkspaceAccessContext`, `WorkspaceAccessContext`, `normalizeWorkspaceRole`, and `countWorkspaceMembers` from the removed `workspace-permissions.ts`. Exported `normalizeWorkspaceRole` for callers needing per-member role normalization. |

### Files Removed

| File | Reason |
|------|--------|
| `src/lib/workspace-permissions.ts` | All call sites migrated; logic inlined into `rbac.ts`; removed entirely. |

### Files Migrated (import path + function calls)

**API Routes (7 files):**
- `src/app/api/dashboard/operational/alerts/route.ts` — `getWorkspaceAccessContext` → `getRBACContext`
- `src/app/api/dashboard/operational/execution/route.ts` — `getWorkspaceAccessContext` → `getRBACContext`
- `src/app/api/dashboard/operational/provider/route.ts` — `getWorkspaceAccessContext` → `getRBACContext`
- `src/app/api/dashboard/operational/summary/route.ts` — `getWorkspaceAccessContext` → `getRBACContext`
- `src/app/api/dashboard/content-studio/run-scheduler/route.ts` — `normalizeWorkspaceRole` → `getRBACContext` + `hasPermission`
- `src/app/api/ads/pinterest/connect/route.ts` — `normalizeWorkspaceRole` + `canManageProviders` → `getRBACContext` + `hasPermission`
- `src/app/api/ads/meta/connect/route.ts` — same pattern
- `src/app/api/ads/google/connect/route.ts` — same pattern

**Page & Server Action Files (13 files):**
- `src/app/(dashboard)/dashboard/production/page.tsx` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/production/actions.ts` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/backups/page.tsx` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/backups/actions.ts` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/security/page.tsx` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/system-health/page.tsx` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/settings/roles/page.tsx` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/settings/roles/actions.ts` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/settings/actions.ts` — migrated to `getRBACContext` + `hasPermission` + `permissions-matrix`
- `src/app/(dashboard)/dashboard/review/actions.ts` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/create-task/actions.ts` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/prompt-library/actions.ts` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/releases/actions.ts` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/ai-studio/actions.ts` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/creative-assets/actions.ts` — migrated to `getRBACContext` + `hasPermission`
- `src/app/(dashboard)/dashboard/content-studio/actions.ts` — migrated to `getRBACContext` + `hasPermission`

**Layout & Lib Files (6 files):**
- `src/app/(dashboard)/operational/layout.tsx` — migrated to `getRBACContext`
- `src/actions/preferences.ts` — migrated to `getRBACContext`
- `src/actions/creative-assets.ts` — migrated to `getRBACContext`
- `src/lib/dashboard/get-dashboard-data.ts` — imports from `rbac` + `permissions-matrix`
- `src/lib/content-studio/provider-types.ts` — imports `StrictWorkspaceRole` from `permissions-matrix`
- `src/lib/production-readiness.ts` — imports `StrictWorkspaceRole` from `permissions-matrix`

### Permission Mapping (canXxx → hasPermission)

| Legacy Function | Equivalent | Mapped To |
|-----------------|------------|-----------|
| `canManageBackups(role)` | `hasPermission(role, 'admin')` | admin+ |
| `canManageSecurity(role)` | `hasPermission(role, 'admin')` | admin+ |
| `canManageRoles(role)` | `hasPermission(role, 'owner')` | owner only |
| `canManageSettings(role)` | `hasPermission(role, 'admin')` | admin+ |
| `canManageProviders(role)` | `hasPermission(role, 'admin')` | admin+ |
| `canEditContent(role)` | `hasPermission(role, 'editor')` | editor+ |
| `canPublishContent(role)` | `hasPermission(role, 'operator')` | operator+ |
| `canCreateTasks(role)` | `hasPermission(role, 'editor')` | editor+ |
| `canReviewTasks(role)` | `hasPermission(role, 'editor')` | editor+ |
| `canUseAIGeneration(role)` | `hasPermission(role, 'editor')` | editor+ |
| `canDeleteContent(role)` | `hasPermission(role, 'admin')` | admin+ |
| `canManageReleases(role)` | `hasPermission(role, 'admin')` | admin+ |
| `canRunScheduler(role)` | `hasPermission(role, 'admin')` | admin+ |

## Validation

- **Typecheck:** No new errors from migrated files (pre-existing `.next/types/` infrastructure issue)
- **Lint:** 0 errors, 49 warnings (all pre-existing, none from migrated files)
- **Build:** Not re-run (requires full environment, pre-existing successes)

## Documentation Updates

- `docs/orchestrator/TECHNICAL_DEBT.md` — Removed "Dual RBAC systems" from Low Priority Debt
- `docs/orchestrator/RISK_REGISTER.md` — R5 "Dual RBAC systems" moved from **Mitigated** to **Resolved/Closed**
- `docs/orchestrator/MERGE_REPORT.md` — Updated file change table with all migrated files
- `src/lib/permissions-matrix.ts` — Updated doc comment to reflect legacy layer removal

## Success Criteria

- [x] Zero remaining imports of `@/lib/workspace-permissions` in `src/`
- [x] Legacy file `workspace-permissions.ts` removed
- [x] typecheck + lint still green (no new errors)
- [x] TECHNICAL_DEBT and RISK_REGISTER updated
- [x] Report written

## Future Work

- The `normalizeWorkspaceRole` export from `rbac.ts` duplicates `normalizeRole` from `rbac-client.ts` (with owner_id handling). Consider merging in a future cleanup wave.
- The `getWorkspaceAccessContextInternal` helper remains private in `rbac.ts` for `getRBACContext`'s use. No callers need it directly.
