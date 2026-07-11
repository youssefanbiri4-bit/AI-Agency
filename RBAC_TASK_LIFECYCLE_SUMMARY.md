# RBAC Task Lifecycle Summary

**Date:** 2026-07-02
**Focus:** Full integration of RBAC into Task Create → Execute → Review → Complete lifecycle.

## Changes

### 1. New: `src/lib/tasks/task-service.ts`
Central service providing RBAC-guarded methods:
- `createTask(input)` — enforces `minRole: 'editor'` + dept validation against agent's department.
- `canExecuteTask` / `executeTask` — `minRole: 'operator'`, production gate (n8n readiness + status).
- `canReviewTask` / `approveTask` / `requestChangesTask` — `minRole: 'operator'`.
- `listTasksForCurrentUser()` — returns dept-scoped list (admins see all, others only matching dept or own).
- `getTaskWithRBAC()`.

### 2. Create (TASK 1)
- `src/app/(dashboard)/dashboard/create-task/actions.ts`
  - Uses `taskService.createTask`
  - Fetches agent dept and passes for validation.
  - Keeps legacy + new RBAC (`require... min 'editor'`).

### 3. Execution (TASK 2)
- `src/app/api/tasks/execute/route.ts`
  - Added `requireWorkspaceAccessWithRBAC({ minRole: 'operator' })` early.
  - Leverages `taskService.canExecuteTask` (production gate).
- `RunTaskButton` + status gates remain, now backed by RBAC.

### 4. Review (TASK 3)
- `src/app/(dashboard)/dashboard/review/actions.ts`
  - Added RBAC check + `taskService.canReviewTask`.
  - minRole 'operator'.

### 5. UI (TASK 4)
- `src/app/(dashboard)/dashboard/tasks/page.tsx`: Uses `taskService.listTasksForCurrentUser()` for server-side filtering.
- `TasksClient.tsx`: Initializes dept filter to user's dept (unless admin), exposes role info.
- `src/app/(dashboard)/dashboard/tasks/[id]/page.tsx`: Computes `canExecute`, `canReview` using `getRBACContext` + `hasPermission`. Conditions RunTaskButton and ReviewForm visibility.
- Details and lists respect "own department or all for admin".

### Validation Rules (enforced)
- **Member/Editor**: Can create in *own* dept only. Cannot execute/review.
- **Operator**: Can create (if matches), execute, review/approve.
- **Admin/Owner**: Full access across all depts.
- Workspace RLS + RBAC layer double protection.
- No breaking changes to data layer or legacy permission helpers.

## Usage Example (in new code)

```ts
import { taskService } from '@/lib/tasks/task-service';

const result = await taskService.createTask({ ... , agentDepartment: 'content' });

// In page:
const tasks = await taskService.listTasksForCurrentUser();
```

## Files Updated
- Created: src/lib/tasks/task-service.ts
- Updated: create-task/actions.ts, review/actions.ts, api/tasks/execute/route.ts
- Updated: tasks/page.tsx, TasksClient.tsx, tasks/[id]/page.tsx + related
- Docs: TECH_DEBT.md + this summary

See RBAC_SUMMARY.md for core RBAC.

## Next
- Apply same pattern to other auto-task creators (Alex, campaigns).
- Snapshot agent dept on task record.
- Add client-side role badges on task rows.
