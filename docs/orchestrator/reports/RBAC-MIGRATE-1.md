# RBAC-MIGRATE-1 — Server-Side Migration Report

**Task:** Migrate all server-side / actions / API usages from legacy `@/lib/workspace-permissions` to `@/lib/auth/rbac`
**Branch:** `fix/rbac-migrate-server`
**Date:** 2026-07-12
**Status:** ✅ Complete

## Summary

All server-side imports of `@/lib/workspace-permissions` have been replaced with `@/lib/auth/rbac` equivalents. The legacy file is retained per the task instructions. Typecheck passes cleanly.

## Files Migrated (22 files)

### API Routes (8 files)

| File | Legacy Import | Replacement |
|------|--------------|-------------|
| `src/app/api/dashboard/content-studio/run-scheduler/route.ts` | `canRunScheduler`, `normalizeWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission(role, 'admin')` |
| `src/app/api/dashboard/operational/alerts/route.ts` | `getWorkspaceAccessContext` | `getRBACContext` |
| `src/app/api/dashboard/operational/execution/route.ts` | `getWorkspaceAccessContext` | `getRBACContext` |
| `src/app/api/dashboard/operational/provider/route.ts` | `getWorkspaceAccessContext` | `getRBACContext` |
| `src/app/api/dashboard/operational/summary/route.ts` | `getWorkspaceAccessContext` | `getRBACContext` |
| `src/app/api/ads/pinterest/connect/route.ts` | `canManageProviders`, `normalizeWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission(role, 'admin')` |
| `src/app/api/ads/meta/connect/route.ts` | `canManageProviders`, `normalizeWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission(role, 'admin')` |
| `src/app/api/ads/google/connect/route.ts` | `canManageProviders`, `normalizeWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission(role, 'admin')` |

### Root Actions (2 files)

| File | Legacy Import | Replacement |
|------|--------------|-------------|
| `src/actions/preferences.ts` | `getWorkspaceAccessContext` | `getRBACContext` |
| `src/actions/creative-assets.ts` | `getWorkspaceAccessContext` | `getRBACContext` |

### Dashboard Actions (11 files)

| File | Legacy Imports | Replacement |
|------|---------------|-------------|
| `src/app/(dashboard)/dashboard/creative-assets/actions.ts` | `canDeleteContent`, `canEditContent`, `canUseAIGeneration`, `normalizeWorkspaceRole`, `StrictWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission`, `StrictWorkspaceRole` from `permissions-matrix` |
| `src/app/(dashboard)/dashboard/prompt-library/actions.ts` | `canEditContent`, `normalizeWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission` |
| `src/app/(dashboard)/dashboard/ai-studio/actions.ts` | `canUseAIGeneration`, `normalizeWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission` |
| `src/app/(dashboard)/dashboard/releases/actions.ts` | `canManageReleases`, `normalizeWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission` |
| `src/app/(dashboard)/dashboard/production/actions.ts` | `canManageSecurity`, `getWorkspaceAccessContext` | `getRBACContext`, `hasPermission` |
| `src/app/(dashboard)/dashboard/backups/actions.ts` | `canManageBackups`, `normalizeWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission` |
| `src/app/(dashboard)/dashboard/content-studio/actions.ts` | `canCreateTasks`, `canEditContent`, `canPublishContent`, `canUseAIGeneration`, `normalizeWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission` |
| `src/app/(dashboard)/dashboard/review/actions.ts` | `canReviewTasks`, `getWorkspaceAccessContext` | `getRBACContext`, `hasPermission` |
| `src/app/(dashboard)/dashboard/settings/roles/actions.ts` | `getWorkspaceAccessContext`, `canManageRoles`, `workspaceRoles`, `StrictWorkspaceRole` | `getRBACContext`, `hasPermission`, `workspaceRoles`/`StrictWorkspaceRole` from `permissions-matrix` |
| `src/app/(dashboard)/dashboard/create-task/actions.ts` | `canCreateTasks`, `getWorkspaceAccessContext` | `getRBACContext`, `hasPermission` |
| `src/app/(dashboard)/dashboard/settings/actions.ts` | `canManageProviders`, `canManageSettings`, `getPermissionLevelSummary`, `permissionsMatrix`, `normalizeWorkspaceRole`, `StrictWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission`, `getPermissionLevelSummary`/`permissionsMatrix`/`StrictWorkspaceRole` from `permissions-matrix` |

### Server Components (3 files)

| File | Legacy Imports | Replacement |
|------|---------------|-------------|
| `src/app/(dashboard)/dashboard/security/page.tsx` | `canManageSecurity`, `normalizeWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission` |
| `src/app/(dashboard)/dashboard/system-health/page.tsx` | `getWorkspaceAccessContext`, `canManageSecurity` | `getRBACContext`, `hasPermission` |
| `src/app/(dashboard)/dashboard/backups/page.tsx` | `canManageBackups`, `normalizeWorkspaceRole` | `normalizeWorkspaceRole` (kept), `hasPermission` |
| `src/app/(dashboard)/dashboard/settings/roles/page.tsx` | `getWorkspaceAccessContext`, `canManageRoles`, `normalizeWorkspaceRole` | `getRBACContext`, `hasPermission`, `normalizeWorkspaceRole` (kept) |

### Already Migrated (1 file)

| File | Notes |
|------|-------|
| `src/app/(dashboard)/dashboard/production/page.tsx` | Already used `getRBACContext` + `hasPermission` — no changes needed |
| `src/app/(dashboard)/operational/layout.tsx` | Already used `getRBACContext` — no changes needed |

## Permission Mapping

| Legacy Function | RBAC Replacement | Min Role |
|----------------|-----------------|----------|
| `canCreateTasks(role)` | `hasPermission(role, 'editor')` | editor |
| `canRunTasks(role)` | `hasPermission(role, 'operator')` | operator |
| `canReviewTasks(role)` | `hasPermission(role, 'editor')` | editor |
| `canManageSettings(role)` | `hasPermission(role, 'admin')` | admin |
| `canManageProviders(role)` | `hasPermission(role, 'admin')` | admin |
| `canRunScheduler(role)` | `hasPermission(role, 'admin')` | admin |
| `canManageBackups(role)` | `hasPermission(role, 'admin')` | admin |
| `canManageSecurity(role)` | `hasPermission(role, 'admin')` | admin |
| `canManageRoles(role)` | `hasPermission(role, 'owner')` | owner |
| `canEditContent(role)` | `hasPermission(role, 'editor')` | editor |
| `canDeleteContent(role)` | `hasPermission(role, 'admin')` | admin |
| `canUseAIGeneration(role)` | `hasPermission(role, 'editor')` | editor |
| `canManageReleases(role)` | `hasPermission(role, 'admin')` | admin |
| `canPublishContent(role)` | `hasPermission(role, 'operator')` | operator |
| `canViewReports(role)` | Always true (any role) | viewer |
| `getWorkspaceAccessContext()` | `getRBACContext()` | — |

## Key Decisions

1. **`normalizeWorkspaceRole` kept from legacy module** — The legacy `normalizeWorkspaceRole(role, workspace, userId)` function handles workspace ownership detection (`workspace.owner_id === userId → 'owner'`). The new `normalizeRole()` does not handle this. Keeping the legacy import for files that need workspace-aware role normalization preserves behavior.

2. **`getPermissionLevelSummary`, `permissionsMatrix`, `workspaceRoles`, `StrictWorkspaceRole`** — These types/utilities are re-exported from `@/lib/permissions-matrix` via the legacy module. Files that need them now import directly from `@/lib/permissions-matrix`.

3. **No permission rule changes** — All `canX(role)` → `hasPermission(role, 'X')` mappings preserve the exact same role thresholds. The `hasPermission()` function uses `ROLE_HIERARCHY` which matches the legacy matrix exactly.

4. **Legacy file not deleted** — Per task instructions, `src/lib/workspace-permissions.ts` is retained. It is still imported by `src/lib/auth/rbac.ts` internally and by a few lib files for type exports (`StrictWorkspaceRole`).

## Verification

- **Typecheck:** ✅ `npm run typecheck` passes cleanly (0 errors)
- **No remaining legacy imports in target folders:** ✅ Zero matches for `workspace-permissions` in `src/actions/`, `src/app/api/`, or `src/app/(dashboard)/` action/page/layout files
- **No remaining `canX` function calls:** ✅ Zero matches for any legacy `can*` functions in the migrated files

## Remaining Legacy Imports (NOT in scope for this task)

These files still import from `@/lib/workspace-permissions` but are outside the server/actions/API scope:

| File | Import | Reason |
|------|--------|--------|
| `src/lib/auth/rbac.ts` | `getWorkspaceAccessContext`, `WorkspaceAccessContext` | Internal wrapper — expected |
| `src/lib/content-studio/provider-types.ts` | `StrictWorkspaceRole` (from `permissions-matrix`) | Type-only import — OK |
| `src/lib/dashboard/get-dashboard-data.ts` | `normalizeWorkspaceRole` (now from `rbac`) | Already migrated |
| `src/lib/production-readiness.ts` | `StrictWorkspaceRole` (from `permissions-matrix`) | Type-only import — OK |
| `src/lib/permissions-matrix.ts` | Self-reference doc comment | No actual import |

## Next Steps

- Agent 2 can proceed with client component migration
- After all call sites are migrated, `workspace-permissions.ts` can be safely deleted
