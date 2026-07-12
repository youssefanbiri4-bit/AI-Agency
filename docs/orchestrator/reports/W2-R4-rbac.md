# W2-R4: RBAC Dual Systems Cleanup

## Overview

The project has two overlapping authorization systems that co-exist. This report documents which is the current source of truth, which is legacy, and how they relate.

## Systems Identified

### System A — Current Source of Truth: `@/lib/auth/rbac`

| File | Purpose |
|------|---------|
| `src/lib/auth/rbac.ts` | Server-side RBAC context (`RBACContext`), guards (`requireRole`, `requireDepartment`, `requireWorkspaceAccessWithRBAC`), page access, membership updates |
| `src/lib/auth/rbac-client.ts` | Client-safe pure helpers (`hasPermission`, `normalizeRole`, `canAccessDepartment`, `canViewArea`, catalog↔RBAC department mapping) |
| `src/lib/auth/require-page-access.ts` | Edge-safe page access evaluation (`evaluatePageAccess`, `buildPageAccessContext`) — shared by middleware and server |

**Features unique to System A:**
- Department-aware access control (department scoping + cookie override for admins)
- Catalog ↔ RBAC department mapping (`DEPARTMENT_MAP`, `resolvePrimaryRbacDepartment`)
- Page-level access evaluation (`requirePageAccess`, `evaluatePageAccess`)
- `RBACContext` extends `WorkspaceAccessContext` with `rbacRole`, `department`, `isAdminOrHigher`, `isOperatorOrHigher`

### System B — Legacy Foundation: `@/lib/workspace-permissions`

| File | Purpose |
|------|---------|
| `src/lib/workspace-permissions.ts` | Legacy role normalization + individual `canX()` functions (`canManageSettings`, `canCreateTasks`, etc.) |
| `src/lib/permissions-matrix.ts` | `StrictWorkspaceRole` type + `permissionsMatrix` table (shared role values) |

**Features of System B:**
- Workspace-level role checks **without** department scoping
- Individual `canX()` functions with hardcoded role arrays
- `WorkspaceAccessContext` — role + workspace + membership, no department

## How They Relate

```
  ┌─────────────────────────────┐
  │   @/lib/auth/rbac.ts        │  ← CURRENT source of truth
  │   (RBACContext, guards)      │
  └──────────┬──────────────────┘
             │ imports getWorkspaceAccessContext()
             ▼
  ┌─────────────────────────────┐
  │ @/lib/workspace-permissions │  ← LEGACY foundation layer
  │ (WorkspaceAccessContext)     │
  └─────────────────────────────┘
```

`rbac.ts` **depends on** `workspace-permissions.ts`. The `getRBACContext()` function internally calls `getWorkspaceAccessContext()` and enriches the result with department scoping and RBAC role normalization. System B is the foundation that System A wraps — it cannot be removed until all call sites in System A are refactored to not depend on it.

## Import Count (Direct Usage)

| Import Path | Files | Notes |
|-------------|------:|-------|
| `@/lib/workspace-permissions` | 22 | Legacy — dashboard actions, API routes, older code paths |
| `@/lib/auth/rbac` | 6 | Current — newer actions (reels, reports, tasks, creative-assets), task-service |
| `@/lib/auth/rbac-client` | 4 | Client-side — department-filter, preferences |
| `@/lib/auth/require-page-access` | 2+ | Edge/server — dashboard-edge-auth, rbac.ts |

## Changes Made

1. **`src/lib/workspace-permissions.ts`** — Added top-level deprecation doc comment:
   - Clearly marks this as the LEGACY authorization layer
   - Points to `@/lib/auth/rbac` as the current source of truth
   - Marks `getWorkspaceAccessContext()` with `@deprecated` JSDoc tag
   - Includes TODO for migration of ~22 call sites
   - Comments list which files should be imported instead

2. **`src/lib/permissions-matrix.ts`** — Added doc comment clarifying:
   - This defines types shared by both legacy and current systems
   - Points to `@/types/auth.ts` as the canonical type source
   - Clarifies that `StrictWorkspaceRole` and `RBACRole` resolve to the same values

3. **`TECH_DEBT.md`** — Added new section "RBAC / Dual Systems":
   - Architecture table mapping each file to its role
   - Migration plan with checklist items
   - Clear statement of current source of truth vs legacy

4. **This report** — `docs/orchestrator/reports/W2-R4-rbac.md`

## Security / Behavior

No authorization behavior was changed. All existing permission checks continue to work exactly as before. The legacy markers are documentation-only.

## Forbidden Actions (Not Done)

- ❌ Did not rewrite the RBAC system
- ❌ Did not break existing permissions
- ❌ Did not change any authorization behavior
- ❌ Did not migrate any call sites (that's the next step)

## Success Criteria

- [x] Clear documentation of current vs legacy
- [x] `TECH_DEBT.md` updated with RBAC dual systems section
- [x] Report: `docs/orchestrator/reports/W2-R4-rbac.md`
- [x] Legacy files marked with strong comments + TODOs
- [x] No authorization behavior changed

## Future Work

1. Migrate the 22 call sites from `@/lib/workspace-permissions` to `@/lib/auth/rbac`
2. Add deprecation warning/console.warn on legacy imports
3. Remove `workspace-permissions.ts` and `permissions-matrix.ts` after full migration
4. Consider deduplicating `StrictWorkspaceRole` and `RBACRole` into a single type source

---

*Report generated 2026-07-11 per W2-R4*
