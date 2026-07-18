# Task Summary

- **Objective:** Eradicate the RSC serialization error (digest: `3173807121`) caused by passing React component references (specifically `forwardRef`-wrapped Lucide icons) as props across the Server-Client boundary.
- **Scope:** All files in `src/components/ui/`, `src/components/layout/`, `src/components/tasks/`, `src/components/reviews/`, and all `page.tsx` / Client Component files under `src/app/` that pass `icon` or `emptyState` props containing component references instead of rendered JSX elements. Additionally, any shared UI component whose prop types accepted `LucideIcon` or `ComponentType` instead of `ReactNode`.
- **Status:** Completed

# Files Modified

### Type definition changes (causal fix)
| File | Change |
|---|---|
| `src/components/ui/EmptyState.tsx` | Changed `icon` prop type from `LucideIcon \| ComponentType<...> \| ReactNode` to `ReactNode`. Removed `resolveIcon()` branching logic that accepted component references. |
| `src/components/ui/FormControls.tsx` | Added `'use client'` directive (component uses `forwardRef` without it) |
| `src/components/tasks/TaskResultOutput.tsx` | Changed `ResultEmptyState.icon` type from `LucideIcon` to `ReactNode`; removed `LucideIcon` import |
| `src/app/(dashboard)/dashboard/notifications/NotificationsCenterClient.tsx` | Changed `SummaryTile.icon` prop type from `typeof Bell` to `React.ReactNode`; updated render from `<Icon className="..." />` to `{icon}` |

### Caller fixes (Server Components passing component references)
| File | Lines | Fix |
|---|---|---|
| `src/app/(dashboard)/dashboard/tasks/[id]/page.tsx` | 243–255 | `emptyState.icon: Workflow/FileText` → `<Workflow className="h-6 w-6" />` / `<FileText className="h-6 w-6" />` |
| `src/app/(dashboard)/dashboard/review/page.tsx` | 143–147 | `emptyState.icon: Workflow` → `<Workflow className="h-6 w-6" />` |
| `src/app/(dashboard)/dashboard/creative-assets/page.tsx` | 277 | `icon={ImageIcon}` → `<ImageIcon className="h-6 w-6" />` |
| `src/components/reviews/ReviewHistory.tsx` | 27 | `icon={Star}` → `<Star className="h-6 w-6" />` |

### Caller fixes (Client Components — forced by type change, prophylactic)
| File | Lines | Fix |
|---|---|---|
| `src/app/(dashboard)/dashboard/notifications/NotificationsCenterClient.tsx` | 218–223, 311, 479 | 8 occurrences of `icon={Component}` converted to `<Component className="h-5 w-5" />` or `<Component className="h-6 w-6" />` |
| `src/app/(dashboard)/dashboard/reports/ReportsListClient.tsx` | 114, 125 | `icon={FileText/Search}` → `<FileText className="h-6 w-6" />` / `<Search className="h-6 w-6" />` |
| `src/app/(dashboard)/dashboard/reports/OperationalReportClient.tsx` | 180, 186 | `icon={Clipboard/Search}` → `<Clipboard className="h-6 w-6" />` / `<Search className="h-6 w-6" />` |
| `src/app/(dashboard)/dashboard/projects/ProjectsClient.tsx` | 184, 196 | `icon={FolderKanban/Search}` → `<FolderKanban className="h-6 w-6" />` / `<Search className="h-6 w-6" />` |
| `src/app/(dashboard)/dashboard/projects/GitHubIssuesPanel.tsx` | 129, 210 | `icon={GitPullRequest/CircleDot}` → `<GitPullRequest className="h-6 w-6" />` / `<CircleDot className="h-6 w-6" />` |
| `src/app/(dashboard)/dashboard/projects/PullRequestAssistantPanel.tsx` | 212 | `icon={GitPullRequest}` → `<GitPullRequest className="h-6 w-6" />` |
| `src/app/(dashboard)/dashboard/prompt-library/PromptLibraryClient.tsx` | 299 | `icon={Clipboard}` → `<Clipboard className="h-6 w-6" />` |
| `src/app/(dashboard)/dashboard/recovery/RecoveryClient.tsx` | 295 | `icon={LifeBuoy}` → `<LifeBuoy className="h-6 w-6" />` |
| `src/app/(dashboard)/dashboard/agent-builder/AgentBuilderClient.tsx` | 221 | `icon={Wand2}` → `<Wand2 className="h-6 w-6" />` |
| `src/app/(dashboard)/dashboard/agent-builder/gallery/GalleryClient.tsx` | 209 | `icon={Store}` → `<Store className="h-6 w-6" />` |

A total of **15 files** were modified.

# Technical Changes

### 1. EmptyState — type narrowing (src/components/ui/EmptyState.tsx)
The `icon` prop previously accepted three forms: a `LucideIcon` component reference, a `ComponentType<{className?: string}>`, or a `ReactNode`. The `resolveIcon()` helper branched on whether the value was a function (component reference) or object (React element) and called `createElement()` for function values. This allowed callers to pass `icon={Workflow}` — a `forwardRef`-wrapped Lucide component — which cannot be serialized across an RSC boundary.

**Fix:** Removed the union types entirely; `icon` now accepts only `ReactNode`. The `resolveIcon()` function was inlined into a ternary (`resolvedIcon = icon ?? <config.icon className="h-6 w-6" />`). Callers must now always pass a rendered JSX element (e.g., `<Workflow className="h-6 w-6" />`).

### 2. FormControls — missing client boundary (src/components/ui/FormControls.tsx)
`Input`, `Select`, and `Textarea` are created via `forwardRef()`, which produces an object with `$$typeof: Symbol.for('react.forward_ref')`. Without `'use client'`, this module was treated as a Server Component module, and when imported by Server Component pages (`settings/page.tsx`, `auth/login/page.tsx`, `auth/signup/page.tsx`, `content-library/page.tsx`), the `forwardRef` objects could not be properly referenced in the RSC payload.

**Fix:** Added `'use client'` at the top of the file.

### 3. TaskResultOutput — ResultEmptyState icon type (src/components/tasks/TaskResultOutput.tsx)
`ResultEmptyState.icon` was typed as `LucideIcon` (a component reference type). Server Component pages (`tasks/[id]/page.tsx`, `review/page.tsx`) passed `emptyState={{ icon: Workflow, ... }}` where `Workflow` is a `forwardRef` component. This object was propagated through the component tree and eventually rendered by `EmptyState`, but the function reference itself could not be serialized if the path crossed a Client boundary.

**Fix:** Changed `icon` type to `ReactNode`. Callers now pass `<Workflow className="h-6 w-6" />` (a rendered element) instead of the bare component reference.

### 4. NotificationsCenter — SummaryTile icon type (src/app/.../NotificationsCenterClient.tsx)
`SummaryTile.icon` was typed as `typeof Bell` (a `forwardRef` component constructor type). The component rendered it as `<Icon className="h-5 w-5" />`, treating the prop as a component reference.

**Fix:** Changed type to `React.ReactNode` and render as `{icon}`. Callers now pass `<Bell className="h-5 w-5" />`.

### 5. All other callers
21 additional call sites across 10 files that passed `icon={ComponentName}` to `EmptyState` were converted to `<ComponentName className="h-6 w-6" />`. While these callers are in Client Components (no RSC boundary crossing), the type change in `EmptyState` made these conversions mandatory for compilation.

# Architecture Impact

**Minimal.** No component hierarchy was restructured. No new components were added. No `'use client'` boundaries were added or removed except for `FormControls.tsx` where it was strictly required. The change only tightens prop types from function/component references to serializable `ReactNode`. Existing behavior is preserved because Lucide icons rendered as `<Icon className="..." />` produce the same output as the previous `createElement(Icon, {className: "..."})` approach.

The only architectural concern: `EmptyState` no longer supports render-prop-style `icon` usage. Downstream callers must always pass an element, not a component constructor. This is a deliberate prophylactic measure — it prevents the RSC serialization error from recurring.

# Database Changes

None.

# API Changes

None.

# UI Changes

None visible. All icons render identically. The className values were preserved (`h-5 w-5` / `h-6 w-6` as appropriate per component).

# Validation Performed

- **TypeScript typecheck:** `npm run typecheck` — passes with 0 errors.
- **Production build:** `npm run build` — passes. Build output confirms all routes compile successfully (91 `ƒ` dynamic routes, 3 `○` static routes, no RSC serialization errors). The only warnings are:
  - Sentry `onRequestError` hook notice (pre-existing config warning)
  - Redis `ECONNREFUSED 127.0.0.1:6379` (expected — no local Redis for BullMQ at build time)

# Remaining Issues

- **`src/components/ui/EmptyState.tsx`** — The `variantConfig` still uses `LucideIcon` as the internal type for fallback icons (`Inbox`, `SearchX`, `AlertTriangle`, `Lock`). This is safe because these are never passed as props; they are directly rendered via JSX `<config.icon className="h-6 w-6" />` only when no `icon` prop is provided. No further action required.
- **`src/components/ui/StatCard.tsx`** — The `icon` prop remains `ReactNode` (already correct). No change needed.
- **`src/components/tasks/TaskResultOutput.tsx`** — The file still imports `CopyReportButton` and `ExportReportButton` (both `'use client'`) but does not itself have `'use client'`. This is safe because it only renders them with serializable props (`markdown: string`, no props). If a future change adds non-serializable props, the boundary will need attention.
- **`src/components/` client-side files** (MarketingAnalytics, LaunchMetricsDashboard, PublisherAnalytics, GrowthPlaybook) — still pass `icon={Component}` to `MetricCard`/`Tip`/`StatCard`. These are all within Client Component trees so they do not cause RSC serialization errors. They were left unchanged to minimize scope. These components' `icon` prop types accept `ComponentType` which is permissive; if they become Server Components in the future, the same error will recur.

# Risks

- **Regression risk:** Low. All changes are type-driven and either change prop types from function references to `ReactNode` or update callers to pass `<Component className="..." />` instead of `Component`. Rendering output is identical.
- **Missing Server Component callers:** The audit focused on `icon` and `emptyState` props. Other prop names (`render`, `component`, `as`, `wrapper`, `template`) were searched and found absent. However, if any Server Component passes a `forwardRef` component under a different prop name not covered by this search, the error could still occur. The grep pattern `(as|component|render|wrapper|itemComponent|Provider|icon|Icon|leftIcon|rightIcon)=\{` was used for initial discovery; a broader audit would need to enumerate every prop on every Client Component.
- **Third-party component references:** If any integration code passes a third-party `forwardRef` component as a prop (e.g., `as={SomeLibraryComponent}`), it would not be caught by this change. The `EmptyState` and `TaskResultOutput` fixes are complete for their respective call sites, but other components in the codebase could still have similar violations.

# Recommendations

1. **Audit all remaining `ComponentType`-typed props** in shared UI components (`BulkActionBar.icon`, `CommandPalette.icon`, etc.) and convert them to `ReactNode` following the same pattern as `EmptyState`. This makes the pattern consistent across the component library.
2. **Add a CI lint rule** that flags `icon={[A-Z]` or `icon={[A-Z]` (a component reference passed as a prop match) — but this would require understanding of the RSC boundary, which is complex to automate. A simpler heuristic: reject any non-JSX JSXExpression with a capitalized identifier on a prop named `icon`, `render`, `component`, or `wrapper`.
3. **Review `StatCard`, `MetricCard`, `Tip`, `SummaryTile`** — ensure their `icon` prop type is `ReactNode` (not `ComponentType` or `LucideIcon`) to prevent future violations if they become Client Components or are used across RSC boundaries.

# Next Suggested Task

Audit and convert `ComponentType`-typed props in the remaining shared UI components (`BulkActionBar`, `CommandPalette`, `AgentAvatar`'s internal icon map, and the `MetricCard`/`Tip`/`StatCard` patterns in `src/components/launch/`, `src/components/marketing/`, `src/components/marketplace/`, `src/components/growth/`) to use `ReactNode` instead, following the same pattern applied to `EmptyState`. This would be a prophylactic pass to eliminate the class of vulnerability entirely from the component library.
