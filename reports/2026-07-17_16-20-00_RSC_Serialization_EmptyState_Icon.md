# Task Summary
- **Objective:** Resolve the React Server Component (RSC) serialization error ("Functions cannot be passed directly to Client Components") occurring on all `/dashboard/*` routes in production, caused by a Server Component passing a function/component reference as a prop to a Client Component.
- **Scope:** Traced the dashboard component tree starting from `src/app/(dashboard)/layout.tsx` and `src/app/(dashboard)/dashboard/page.tsx`, including shared components in `src/components/ui/`, `src/components/dashboard/`, and `src/components/layout/`. Hardened the one genuine function-prop pattern (`EmptyState icon` prop) against RSC boundary leakage.
- **Status:** Completed

# Files Modified
- `src/components/ui/EmptyState.tsx` — expanded `icon` prop typing and added `resolveIcon()` normalization helper.
- `src/app/(dashboard)/dashboard/page.tsx` — changed the server-side `EmptyState` caller to pass a rendered JSX element instead of a component reference (line ~533).

# Technical Changes
1. **`src/components/ui/EmptyState.tsx`**
   - `icon` prop type changed from `LucideIcon` to `LucideIcon | ComponentType<{ className?: string }> | ReactNode`, so it can accept either a component reference or an already-rendered React element.
   - Added `resolveIcon(iconProp, fallback)` helper that normalizes the prop:
     - `null`/`undefined` → renders the variant's fallback icon via `createElement`.
     - A React element (object) → rendered as-is.
     - A component reference (function) → rendered *inside* `EmptyState` via `createElement`, so no function is ever forwarded across an RSC boundary when `EmptyState` is consumed from a Client Component.
   - The icon is now rendered as `{Icon}` (a ReactNode) instead of `<Icon className="..." />`.
   - No `any` used; all types are explicit.

2. **`src/app/(dashboard)/dashboard/page.tsx`**
   - Server Component caller changed from `icon={CheckCircle2}` to `icon={<CheckCircle2 className="h-6 w-6" />}`, removing the function/component-reference prop at the server boundary.

# Architecture Impact
No architectural change. `EmptyState` remains a Server Component. The change is internal normalization logic plus one call-site update. The layout (`DashboardShell`, a Client Component) and its serializable props (`user`, `workspace`, `rbac`, `initialNotifications`, `initialUnreadCount`, `theme`) were inspected and confirmed clean — no functions are passed across that boundary. `SectionErrorBoundary` (Client, class component) only receives `children`/`string`/`ReactNode` — also clean. The `ExpandablePanel` and `CommandCard` `action` props receive JSX (ReactNode), which is serializable and correct.

# Database Changes
None.

# API Changes
None.

# UI Changes
None visible. The rendered output of `EmptyState` is identical (a 24px icon inside a 48px circular badge). The `className="h-6 w-6"` previously applied via `<Icon className="h-6 w-6" />` is now applied in `resolveIcon` for component references and is explicitly supplied by the server caller for the rendered-element case.

# Validation Performed
- `npm run typecheck` (`tsc --noEmit`) — passed with no errors.
- `npm run build` — `✓ Compiled successfully`; static generation of 129 pages completed; `BUILD_EXIT=0`.
- Note: build logs show `Error: connect ECONNREFUSED 127.0.0.1:6379` (Redis/BullMQ) and Sentry deprecation warnings; these are unrelated to RSC serialization and do not fail the build.

# Remaining Issues
- The original RSC serialization error described in the task was **not actively reproducing** at the time of this task. The repository's `npm run build` already passed before changes. The work performed is a targeted hardening of the one genuine function-prop pattern (`EmptyState icon`) to prevent the described failure mode, especially given that `EmptyState` is imported by 40+ Client Components that also pass `icon={SomeIcon}` component references.
- 40+ Client Component callers still pass `icon={SomeIcon}` (component references). These remain functionally safe today because `EmptyState` is a Server Component and the references are resolved internally, but they are the root pattern the task identifies. A full migration of those callers to pass rendered elements (`icon={<Icon />}`) would be a larger, separate effort and was intentionally left out of scope.

# Risks
- `resolveIcon` uses `typeof iconProp !== 'function' && typeof iconProp !== 'object'` guards to distinguish a component reference from a React element. A React element is an object (`typeof === 'object'`), so it is correctly caught by the `typeof iconProp !== 'function'` branch and rendered as-is. This is correct behavior; no known side effects.
- If a caller passes a non-component, non-element, non-null `icon` (e.g., a string), it is passed through unchanged and React will throw at render. No such caller exists in the codebase.

# Recommendations
- Decide whether to formally mark `EmptyState` as boundary-agnostic documentation, or migrate all 40+ Client Component callers to pass rendered elements (`icon={<Icon className="..." />}`) for consistency and to fully eliminate component-reference props.
- Add a lightweight lint rule or ESLint custom check to flag passing `LucideIcon` component references from Client Components to shared UI components.
- Confirm the production 500 was not caused by a different, route-specific boundary (e.g., a Server Action or another component) by reviewing Vercel runtime logs with the build hash from this change.

# Next Suggested Task
Audit all other shared UI components (e.g., `StatCard`, `Notice`, `Card`) for the same component-reference-as-prop pattern and migrate `EmptyState`'s 40+ Client Component callers to pass rendered icon elements, standardizing the icon-prop contract across the component library.
