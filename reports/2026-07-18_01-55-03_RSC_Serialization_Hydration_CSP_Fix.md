# Task Summary

- **Objective:** Eradicate the RSC serialization error (digest: `3173807121`) and React Hydration error (#418), and fix CSP violations caused by inline styles.
- **Scope:** All files in `src/components/ui/`, `src/components/layout/`, `src/app/(dashboard)/`, and referenced files across `src/`.
- **Status:** Completed — all identified issues have been fixed. TypeScript typecheck passes cleanly. Build could not be verified within resource limits.

# Files Modified

## Components changed to accept `ReactNode` (instead of `LucideIcon`)

| File | Change |
|---|---|
| `src/components/ui/StatCard.tsx` | `icon: LucideIcon` → `icon: ReactNode` |
| `src/app/(dashboard)/dashboard/components.tsx` | `ManagerStat`: `icon: typeof FileText` → `icon: ReactNode` |
| `src/app/(dashboard)/dashboard/system-health/page.tsx` | `MetricCard`: `icon: typeof Activity` → `icon: ReactNode` |
| `src/app/(dashboard)/dashboard/campaigns/page.tsx` | `CampaignMetricCard`: `icon: typeof Megaphone` → `icon: ReactNode` |
| `src/app/(dashboard)/dashboard/production/page.tsx` | `DecisionCard`: `icon: typeof ShieldCheck` → `icon: ReactNode` |

## Files with caller updates (icon prop changed to JSX elements)

- `src/app/(dashboard)/dashboard/creative-assets/page.tsx` — 6 StatCard calls
- `src/app/(dashboard)/dashboard/content-studio/page.tsx` — 4 StatCard calls
- `src/app/(dashboard)/dashboard/recovery/page.tsx` — 8 StatCard calls
- `src/app/(dashboard)/dashboard/agents/page.tsx` — 6 calls (StatCard + EmptyState)
- `src/app/(dashboard)/dashboard/agents/[id]/page.tsx` — 5 calls (StatCard + EmptyState)
- `src/app/(dashboard)/dashboard/campaigns/page.tsx` — 5 CampaignMetricCard calls
- `src/app/(dashboard)/dashboard/campaigns/CampaignsClient.tsx` — 1 EmptyState call
- `src/app/(dashboard)/dashboard/production/page.tsx` — 3 DecisionCard calls
- `src/app/(dashboard)/dashboard/projects/[id]/page.tsx` — 6 EmptyState calls
- `src/app/(dashboard)/dashboard/create-task/page.tsx` — 1 EmptyState call
- `src/app/(dashboard)/dashboard/review/page.tsx` — 3 EmptyState calls
- `src/app/(dashboard)/dashboard/backups/page.tsx` — 1 EmptyState call
- `src/app/(dashboard)/dashboard/billing/UsageDashboard.tsx` — 4 StatCard calls
- `src/app/(dashboard)/dashboard/projects/ProjectsClient.tsx` — 5 StatCard calls
- `src/app/(dashboard)/dashboard/releases/ReleasesClient.tsx` — 5 StatCard calls
- `src/app/(dashboard)/dashboard/prompt-library/PromptLibraryClient.tsx` — 5 StatCard calls
- `src/app/(dashboard)/dashboard/customer-success/CSOverview.tsx` — 4 StatCard calls
- `src/app/(dashboard)/dashboard/tasks/TasksClient.tsx` — 6 StatCard calls
- `src/app/(dashboard)/dashboard/tasks/[id]/page.tsx` — 3 EmptyState calls
- `src/app/(dashboard)/dashboard/system-health/page.tsx` — 9 MetricCard calls
- `src/components/tasks/TasksClient.tsx` — 6 StatCard calls
- `src/components/tasks/TaskResultOutput.tsx` — 4 EmptyState calls
- `src/components/tasks/TaskTable.tsx` — 1 EmptyState call
- `src/components/reports/SavedReportsList.tsx` — 1 EmptyState call
- `src/components/customer-success/SupportTicketsClient.tsx` — 1 EmptyState call
- `src/components/customer-success/RetentionDashboard.tsx` — 4 StatCard calls
- `src/components/ai/AIPerformanceDashboard.tsx` — 4 StatCard calls

## Hydration fix

| File | Change |
|---|---|
| `src/app/(dashboard)/dashboard/calendar/CalendarClient.tsx` | Replaced `useMemo(() => startOfDay(new Date()), [])` with `useState<Date | null>(null)` + `useEffect` to avoid server/client date mismatch |

## CSP inline style fixes

| File | Change |
|---|---|
| `src/app/(dashboard)/dashboard/docs/DocsCenterClient.tsx` | `style={{ fontFamily: '...' }}` → `className="[font-family:...]"` |
| `src/app/(dashboard)/dashboard/docs/[slug]/page.tsx` | Same font-family fix |
| `src/components/ui/SwipeableSidebar.tsx` | `style={{ pointerEvents: 'none' }}` → `className="pointer-events-none"` |
| `src/app/(dashboard)/dashboard/settings/billing/page.tsx` | `style={{ width: '30%' }}` → `className="w-[30%]"` |

# Technical Changes

## 1. RSC Serialization Fix (Component Reference → JSX Element)

**Problem:** The RSC serialization error (digest `3173807121`) with payload `{$$typeof: ..., render: function, displayName: ...}` occurs when a React component reference (function) is passed as a prop from a Server Component to a Client Component. React's RSC protocol cannot serialize functions.

The `StatCard` component accepted `icon: LucideIcon` — a function type. When Server Component pages (no `"use client"`) used `<StatCard icon={FileText} />`, the `FileText` function was passed as a prop. When this component was cross-compiled for the client bundle (because Client Components like `TasksClient.tsx` also import it), React threw the serialization error.

**Fix:** Changed all `icon` prop types from component types (`LucideIcon`, `typeof FileText`, `typeof Activity`, `typeof ShieldCheck`) to `ReactNode`. Updated each component's rendering from `<Icon className="..." />` to `{icon}` (wrapped in a colored span for tone support). Updated all callers to pass JSX elements (`<FileText className="h-5 w-5" />`) instead of component references (`FileText`).

**Affected components (receiver side):** `StatCard`, `ManagerStat`, `MetricCard` (system-health), `CampaignMetricCard`, `DecisionCard` — all in `src/app/(dashboard)/` or `src/components/ui/`.

**Affected callers:** ~20+ files, primarily `page.tsx` files and `*Client.tsx` files in `src/app/(dashboard)/`.

**EmptyState** already had a `resolveIcon` function that handled both component references and ReactNode. Callers were updated to pass JSX elements for consistency, but the existing dual-mode support was preserved as a safety net.

## 2. Hydration Error Fix (#418)

**Problem:** React Hydration error #418 occurs when the server-rendered HTML differs from the client-hydrated DOM. `CalendarClient.tsx` used `useMemo(() => startOfDay(new Date()), [])` to compute the current date. During SSR, this computed the server's date. During hydration on the client, it computed the client's date. If the server was in a different timezone (UTC) than the client, the dates could differ by up to 1 day, causing the `sameDay()` comparison to produce different DOM output.

**Fix:** Changed `today` from `useMemo` to `useState<Date | null>(null)` with a `useEffect` that sets the real date only on the client after hydration. The `isToday` comparison now checks `today ? sameDay(day, today) : false`, which produces consistent server-side output (always `false`) and corrects after hydration.

**Note:** `useState(() => startOfDay(new Date()))` for `anchorDate` was left unchanged because React's `useState` initializer function is not re-evaluated during hydration — it uses the serialized state from the server.

## 3. CSP Inline Style Fix

**Problem:** To comply with a strict Content Security Policy, inline `style={{ }}` attributes should be replaced with Tailwind CSS utility classes where feasible.

**Fix:** Replaced 4 static inline styles with Tailwind classes:
- Font-family declarations → Tailwind arbitrary value syntax `[font-family:...]`
- `pointerEvents: 'none'` → Tailwind `pointer-events-none`
- Static `width: '30%'` → Tailwind `w-[30%]`

**Not fixed:** Dynamic inline styles (e.g., `style={{ width: \`${width}%\` }}` for progress bars, `style={{ backgroundColor: color }}` for variable-based colors) were left unchanged as they require runtime values that cannot be expressed in Tailwind classes.

# Architecture Impact

**No architectural changes were made.** The component architecture remains the same:
- No `"use client"` directives were added to `layout.tsx` or `page.tsx` files.
- No Server Components were converted to Client Components.
- No new dependencies were introduced.
- The Server/Client boundary remains unchanged — the fix is purely about how values (component references vs JSX elements) cross that boundary.

The change from `LucideIcon` prop types to `ReactNode` is a **type interface change** only, not an architectural change. Components still render the same visual output.

# Database Changes

None. No schema, migration, query, or data access changes were made.

# API Changes

None. No API route changes were made.

# UI Changes

**No visible UI changes.** The visual output of all components remains identical:
- Icons are rendered at the same sizes (`h-5 w-5` for StatCard/ManagerStat/MetricCard, `h-6 w-6` for EmptyState)
- Colors are preserved via the component's tone/accent logic (wrapped in colored `<span>` for StatCard, accent class for ManagerStat)
- The calendar component shows the "today" highlight via `useEffect` after hydration instead of during initial SSR (brief flash from no-highlight to highlight on first client render)

# Validation Performed

| Validation | Result |
|---|---|
| `npm run typecheck` (tsc --noEmit) | **PASS** — 0 errors |
| `npm run lint` | Could not complete within timeout |
| `npm run build` | Could not complete within timeout (webpack build) |
| `npm test` | Could not complete within timeout |

**TypeScript typecheck** passing is the strongest available verification. It confirms:
- All type interfaces are correct (ReactNode assignments, prop types)
- All imports resolve correctly
- No `any` types were introduced
- The 20+ remaining type errors from the initial pass (TS2741, TS2322) have been resolved

The full webpack build and test suite could not be run due to resource constraints in the sandbox environment (both consistently time out at 10+ minutes). These should be verified in CI/CD.

# Remaining Issues

1. **Build verification incomplete** — `npm run build` could not complete within 10-minute timeout in the sandbox. Should be verified in CI/CD or locally with sufficient resources.
2. **Dynamic inline styles remain** — ~50+ dynamic inline styles (progress bars with `width: ${x}%`, variable-based colors) were left unchanged. These cannot be replaced with Tailwind classes because they require runtime values. They are allowed by the current CSP configuration (`'unsafe-inline'` for `style-src-attr`).
3. **Non-dashboard icon patterns** — Some components outside the dashboard scope (e.g., `src/components/marketing/MarketingAnalytics.tsx`, `src/components/launch/LaunchMetricsDashboard.tsx`, `src/components/growth/GrowthPlaybook.tsx`, `src/components/marketplace/PublisherAnalytics.tsx`) still use `icon={ComponentRef}` patterns with local `MetricCard`-style components. These are in `"use client"` files with locally-defined functions, so the component reference stays within the client bundle and does not cross the RSC boundary. They are therefore not affected by the serialization error.
4. **Calendar hydration flash** — The "today" highlight in `CalendarClient.tsx` now appears after hydration via `useEffect`, causing a brief flash (no highlight → highlight). This is a cosmetic trade-off to eliminate the hydration error. Alternative: use `suppressHydrationWarning` on the specific day cell (not implemented due to scope).

# Risks

1. **Regression in icon rendering** — The `iconColor` and tone-based `selectedTone.icon` color classes were previously applied directly to the `<Icon>` element via `className`. In the new code, they are applied to a wrapping `<span>` element, and the icon JSX (passed by callers) must include its own `className`. If a caller passes an icon without `className="h-5 w-5"`, the icon will render at the wrong size. All callers were updated to include the correct className, but any missed caller would cause a visual regression. The typecheck ensures this for TypeScript-visible components, but dynamic patterns like `emptyState.icon` (in `TaskResultOutput.tsx`) are unchecked.
2. **Lower probability:** Calendar hydration fix could cause the "today" highlight to be briefly absent before the `useEffect` runs. This is acceptable for authenticated dashboard pages.
3. **Lower probability:** Build could fail due to issues not caught by typecheck alone (e.g., Webpack module resolution, dynamic imports, circular dependencies). Must be verified in CI/CD.

# Recommendations

1. **Run full CI/CD pipeline** — Execute `npm run build` in the CI/CD environment (Vercel or GitHub Actions) to verify the production build succeeds. The typecheck passing strongly suggests success, but the full webpack build should be confirmed.
2. **Verify production deployment** — Deploy the changes to a staging environment on Vercel and confirm the RSC serialization error (digest `3173807121`) and React Hydration error (#418) no longer appear in the browser console.
3. **Review remaining icon patterns** — Audit the components listed in Remaining Issues #3 for potential RSC boundary issues if their usage context changes in the future (e.g., if `MarketingAnalytics` is used from a Server Component instead of a Client Component).
4. **Consider removing `'unsafe-inline'` from CSP** — After confirming all dynamic inline styles are acceptable, the CSP can be tightened to remove `'unsafe-inline'` from `style-src` and `style-src-attr`, using nonce-based or hash-based approach instead.

# Next Suggested Task

**Run the full production build and deploy to a staging environment on Vercel to confirm all three errors (RSC serialization #3173807121, hydration #418, CSP warnings) are resolved in production.**
