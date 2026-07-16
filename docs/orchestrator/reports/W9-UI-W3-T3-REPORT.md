# W9-UI-W3-T3 — DataTable Bulk Actions Foundation

**Date:** 2026-07-13
**Plan refs:** DESIGN_IMPROVEMENT_PLAN.md (FRP-09: bulk selection), FRONTEND_IMPLEMENTATION_PLAN.md (T4.5)
**Status:** DONE (foundation + Change Status wired; Assign/Delete/Export stubbed as "coming soon")

## Goal
Provide a reusable, accessible bulk-selection foundation for the app's data tables so that
multiple rows can be selected (with shift-range) and acted on through a floating bulk-action bar.
This ticket delivers the shared primitives and wires them into the dashboard Tasks table with a
working "Change Status" bulk action.

## What was built

### New shared primitives
- `src/hooks/useRowSelection.ts` — client hook managing a `Set<string>` of selected ids.
  - `toggle(id)`, `toggleRange(ids, from, to, anchorId)` (shift+click range), `selectAll(ids)`,
    `clear()`, `isAllSelected(ids)`, `isSomeSelected(ids)`.
  - Resets selection automatically when the underlying `ids` list changes (e.g. filters change),
    so stale ids never linger.
- `src/components/ui/BulkActionBar.tsx` — floating, bottom-anchored bar shown only when
  `count > 0`. Renders a live count (`aria-live="polite"`), action buttons (icon + label), and a
  Clear button. Supports `BulkActionConfig` with `variant`, `disabled`, and `disabledTooltip`.
- `src/components/ui/TaskTable.tsx` — added an **opt-in** `selection?: TaskTableSelection` prop.
  - When provided, renders a checkbox column on the desktop table and a checkbox on each mobile
    card, plus header select-all with indeterminate state.
  - Per-row checkbox handles Space/Enter (native) and **Shift+Click** range selection without
    triggering row navigation (uses `onClick` + `preventDefault` so state stays the single source
    of truth).
  - Selected rows get a subtle `bg-primary-light/5` highlight. `aria-selected` is on the `<tr>`
    (valid), not on the mobile `<article>` (invalid per jsx-a11y).
  - Backward compatible: passing no `selection` renders the table exactly as before, so existing
    consumers (`components/tasks/TasksClient.tsx`, `agents/[id]/page.tsx`) are untouched.

### Wiring into the Tasks table
- `src/app/(dashboard)/dashboard/tasks/TasksClient.tsx`
  - Uses `useRowSelection` over the filtered task ids; tracks last-clicked index for shift-range.
  - Passes `selection` to `TaskTable`.
  - Renders `BulkActionBar` with four actions: **Assign** (disabled, "coming soon"),
    **Change Status** (opens a status popover), **Delete** (disabled, "coming soon"),
    **Export** (disabled, "coming soon").
  - "Change Status" popover lists supported statuses and calls the bulk server action: success /
    partial / error are surfaced via `toast`.
- `src/app/(dashboard)/dashboard/tasks/bulk-actions.ts` — `'use server'` boundary so the client
  can call the server action without importing the `server-only` actions module directly.
- `src/actions/tasks.ts` — `bulkSetTaskStatus(taskIds, status)` server action. Reuses the existing
  data-layer transitions (`updateTaskExecutionState` for processing/needs_review/failed,
  `updateTaskReviewStatus` for pending/completed) inside an operator-role RBAC guard, iterating
  per task and counting successes/failures.

## Why this shape
- **No new bulk API was invented** — the data layer only has single-task state transitions, so the
  bulk action loops over them server-side. This keeps RBAC + quota + validation rules intact.
- **Assign / Delete / Export** are intentionally stubbed (toast "coming soon") because there is no
  bulk-assign/bulk-delete/bulk-export endpoint yet. The foundation is in place to wire them in
  later without UI changes.

## Accessibility
- Select-all checkbox uses `indeterminate` (via ref) for the partial state.
- `aria-live` count region announces selection changes.
- Shift+Click and full keyboard checkbox support; row click does not toggle selection (avoids
  accidental toggles and keeps the "View Details" link intact).

## Verification
- `tsc --noEmit` passes (the only error, in `src/app/auth/signup/page.tsx`, is pre-existing and
  unrelated to this change).
- ESLint passes on all touched files (initial `aria-selected` on `article` warning fixed).

## Notes / follow-ups
- Add bulk-assign (agent assignment endpoint), bulk-delete (soft-delete action), and bulk-export
  (CSV/JSON) to replace the stubbed actions.
- The same `selection` prop + `BulkActionBar` can be dropped into Content Studio tables next.
