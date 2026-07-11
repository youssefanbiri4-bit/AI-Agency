# RBAC + Departments Implementation

**Date:** 2026-07-02  
**Status:** Implemented (additive layer on top of existing workspace roles)  
**Author:** Senior Full-Stack (Grok)

## Overview

We introduced a complete, clean, and extensible **Role-Based Access Control (RBAC) + Department Scoping** system.

- **Roles** (hierarchical): `viewer` < `editor` < `operator` < `admin` < `owner`
- **Departments** (scoping): `content`, `creative`, `social`, `strategy`, `paid_ads`, `operations`
- Existing `workspace_members.role` migrated to proper Postgres `rbac_role` enum.
- New `department` column added (nullable for compatibility).

RBAC is enforced primarily **in the application layer** (server actions + components) following the existing PHASE4 philosophy.

## 1. Database Changes

New migration: `supabase/migrations/20260702000000_add_rbac_departments_roles.sql`

- Created `public.department` enum
- Created `public.rbac_role` enum
- `ALTER` on `workspace_members`:
  - `role` → cast to `rbac_role` enum + CHECK
  - New `department public.department NULL`
  - CHECK constraint on department
  - New indexes
- New helper DB functions: `has_min_role(workspace_id, min_role)`
- RLS policies kept workspace-scoped (non-breaking). App layer guards are authoritative.

**Apply:** `supabase db push` or run the migration in Supabase dashboard / CLI.

### Recommended Post-Migration Seed (optional)

```sql
-- Give sample users departments (run manually or via admin UI)
UPDATE public.workspace_members 
SET department = 'operations' 
WHERE department IS NULL AND role IN ('owner', 'admin');

UPDATE public.workspace_members 
SET department = 'content' 
WHERE department IS NULL;
```

## 2. Types (`src/types/auth.ts`)

Full definitions:
- `Department`, `RBACRole`
- `ROLE_HIERARCHY`, `ROLE_ORDER`
- `ROLE_LABELS`, `DEPARTMENT_LABELS` (en/ar + descriptions)
- `DEPARTMENT_FEATURES` mapping
- `canViewArea`, helpers, guards

Also re-exports + type guards (`isRBACRole`, `isDepartment`).

Database types updated in `src/types/database.ts`.

## 3. Core RBAC Library (`src/lib/auth/rbac.ts`)

Exported API:

```ts
// Pure
hasPermission(role, minRole)
canAccessDepartment(role, userDept, requestedDept)
normalizeRole(role)
getAccessibleDepartments(role, userDept)
canViewArea(area, role, dept)

// Context (async)
getRBACContext()                 // => { data: RBACContext, error }
requireRole(minRole)
requireDepartment(dept)
requireWorkspaceAccessWithRBAC({ minRole?, department?, strictDepartment? })

// Utilities
updateMemberRBAC(...)
```

`RBACContext` extends the previous `WorkspaceAccessContext`.

## 4. Integration Points

### 4.1 Layout + Context
- `src/app/(dashboard)/layout.tsx` now fetches membership and passes `rbac` to `DashboardShell`.
- Extended `DashboardContext` + `useRBAC()` hook (client).
- Non-breaking: missing rbac data falls back gracefully (shows all items).

### 4.2 Sidebar Filtering
- `Sidebar.tsx` now filters `menuItems` using `canViewArea()` + current RBAC.
- Admin/Owner: full access.
- Operator/Editor: their dept + globals + some ops.
- Viewer: mostly globals + read areas.

### 4.3 DepartmentSwitcher
- New component `src/components/ui/DepartmentSwitcher.tsx`
- Renders **only for admin/owner**.
- Placed in `Topbar` (desktop).
- Allows selecting dept context (extend to drive filtered views).

### 4.4 Server Actions (examples updated)
- `create-task/actions.ts`: added `requireWorkspaceAccessWithRBAC({ minRole: 'editor' })`
- `reels/actions.ts` → `publishReelAction`: requires `operator`
- `content-studio/actions.ts` → `createContentStudioItemAction`: requires `editor`

Legacy `can*` helpers from `workspace-permissions` are kept for compatibility.

## 5. Permissions Matrix (how it works now)

| Role     | Min for create/edit | Can publish | Dept Scoping (non-admins) | Sidebar |
|----------|---------------------|-------------|---------------------------|---------|
| viewer   | read                | no          | strict                    | limited |
| editor   | create/edit         | no          | own dept                  | partial |
| operator | run + create        | yes         | own or broad              | most    |
| admin    | full                | yes         | any dept                  | all     |
| owner    | everything          | yes         | any                       | all     |

## 6. Extensibility

- Add new department? → extend enum + labels + `DEPARTMENT_FEATURES` + migration enum value.
- New permission action? → extend `PermissionAction` + matrix checks in future `hasPermission(area, action)`.
- Push more to RLS? → Use `has_min_role()` + `department` column in policies (future phase).
- Multi-department users? → Currently one dept per membership (easy to evolve to array/jsonb).

## 7. Usage Examples

### Server Action Guard

```ts
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';

export async function myAction() {
  const check = await requireWorkspaceAccessWithRBAC({ minRole: 'operator', department: 'creative' });
  if (!check.ok) return { error: check.error };
  // safe to proceed
}
```

### Client Component (filtering or badges)

```tsx
import { useRBAC } from '@/components/layout/DashboardContext';
import { canViewArea } from '@/lib/auth/rbac';

const { role, department } = useRBAC();
const show = !role || canViewArea('/dashboard/reels', role, department);
```

### Update Member (from roles settings)

```ts
import { updateMemberRBAC } from '@/lib/auth/rbac';

await updateMemberRBAC(supabase, wsId, userId, { role: 'editor', department: 'social' });
```

## 8. Migration & Rollout Notes

- **Safe:** All changes additive. Old code paths work.
- Run migration before deploying code that assumes `department` column (layout fetches defensively).
- Existing members will have `department = NULL` → treated as "broad access" for operator+ and "restricted" for lower.
- Recommend assigning depts to team members via `/dashboard/settings/roles` (future enhancement: add dept selector to `MemberRoleForm`).

## 9. Future Work (recommended)

- Surface department selector in member role management form.
- Add `department` filter chips on Tasks / Content Studio lists.
- Use `DepartmentSwitcher` value to filter client queries (pass selected dept down).
- Stronger RLS using `has_min_role` for sensitive tables.
- Audit log for role/dept changes.

## Files Changed / Added

- `supabase/migrations/20260702...`
- `src/types/auth.ts` (new)
- `src/lib/auth/rbac.ts` (new)
- `src/components/ui/DepartmentSwitcher.tsx` (new)
- `src/components/ui/Sidebar.tsx`
- `src/components/layout/DashboardContext.tsx`
- `src/components/layout/DashboardShell.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/.../create-task/actions.ts`, `reels/actions.ts`, `content-studio/actions.ts`
- `src/types/database.ts` (types)
- `docs/RBAC_IMPLEMENTATION.md`
- `RBAC_SUMMARY.md`

This system is clean, documented (JSDoc), and ready for extension.
