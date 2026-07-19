# Task Summary

- **Objective:** Fix Server Component render crash (React error #418) caused by invalid lazy/dynamic import in Root Layout, and resolve CSP inline style violations in Dashboard components.
- **Scope:** `src/app/layout.tsx`, `src/lib/sentry-client.tsx`, `src/lib/monitoring/web-vitals.tsx`, all dashboard components with `style={{` inline patterns, CSP policy files.
- **Status:** Partially Completed

---

# Files Modified

| File | Action |
|---|---|
| `src/app/(dashboard)/dashboard/billing/UsageDashboard.tsx` | Modified (line 118) |
| `src/app/(dashboard)/dashboard/settings/WhiteLabelSettings.tsx` | Modified (line 101) |

No files were created or deleted.

---

# Technical Changes

## 1. Root Layout Import Audit (No Change Required)

`src/app/layout.tsx:24-26` uses static named imports:
```tsx
import { SentrySetup, SentryErrorBoundary } from '@/lib/sentry-client';
import { WebVitalsReporter } from '@/lib/monitoring/web-vitals';
```

Both source files (`src/lib/sentry-client.tsx`, `src/lib/monitoring/web-vitals.tsx`) have `'use client'` directives and proper named exports. There is **no** `next/dynamic` or `React.lazy` usage in the layout. The imports resolve correctly at build time. **The React error #418 is not caused by invalid imports in the Root Layout.**

## 2. Static Inline Style Removal

### UsageDashboard.tsx (line 118)
**Before:**
```tsx
<div className="h-2.5 rounded-full bg-emerald-300" style={{ width: '15%' }} />
```
**After:**
```tsx
<div className="h-2.5 w-[15%] rounded-full bg-emerald-300" />
```
Replaced the only static `width` inline style with Tailwind arbitrary value `w-[15%]`.

### WhiteLabelSettings.tsx (line 101)
**Before:**
```tsx
<div className="flex items-center gap-3 mb-3" style={{ backgroundColor: config.colors.header, padding: '8px 12px', borderRadius: '8px' }}>
```
**After:**
```tsx
<div className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: config.colors.header }}>
```
Extracted static `padding` and `borderRadius` values to Tailwind classes (`rounded-lg px-3 py-2`). The dynamic `backgroundColor` remains as inline style because it depends on user-configurable white-label color.

## 3. Remaining Inline Styles (31 instances — NOT modified)

All remaining 31 inline style instances across the dashboard are **runtime-dynamic values** that cannot be expressed as static Tailwind classes:

- **Progress bar widths:** `style={{ width: \`${Math.min(percent, 100)}%\` }}` — computed from runtime data (quotas, usage stats, NPS scores, department task counts). Found in: `components.tsx:142`, `UsageDashboard.tsx:113`, `UsageAnalyticsDashboard.tsx:109,274`, `UsageHistorySection.tsx:71`, `usage/page.tsx:121`, `ops/page.tsx:274`, `reports/components.tsx:106`, `reports/analytics-components.tsx:67`, `InsightsDashboard.tsx:53,264`, `CSNps.tsx:79`, `agent-library/page.tsx:633`, `settings/billing/page.tsx:592`.

- **Data-driven background colors:** `style={{ backgroundColor: agent.accent_color }}` — values from database records. Found in: `GalleryClient.tsx:221,287`, `SharedTemplateView.tsx:101`, `AgentPreview.tsx:54`, `AgentCard.tsx:145`, `LogoBrandingSettings.tsx:225`, `WhiteLabelSettings.tsx:45,102`.

- **Dynamic text colors and backgrounds:** `style={{ color: plan.color }}`, `style={{ backgroundColor: config.colors.* }}` — user-configurable theme values. Found in: `settings/billing/page.tsx:260,347`, `WhiteLabelSettings.tsx:97,103,108,109,111,112`.

---

# Architecture Impact

No architectural changes were made. The CSP policy (`src/lib/security/security-headers.ts` and `src/lib/security/content-security-policy.ts`) was not modified and already includes `"style-src-attr 'unsafe-inline'"` which permits inline `style` attributes.

---

# Database Changes

None.

---

# API Changes

None.

---

# UI Changes

Two minor, imperceptible changes:

1. **UsageDashboard unlimited quota bar:** The `style={{ width: '15%' }}` was replaced with Tailwind `w-[15%]`. Visual output is identical.

2. **WhiteLabelSettings preview header:** Static `padding: '8px 12px'` and `borderRadius: '8px'` extracted to Tailwind `px-3 py-2 rounded-lg`. Visual output is identical (Tailwind's `px-3` = 0.75rem = 12px, `py-2` = 0.5rem = 8px, `rounded-lg` = 0.5rem = 8px).

---

# Validation Performed

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** — zero errors |
| `npm run build` | **PASS** — compiled successfully, 129/129 static pages generated |
| `npm test` | 303/324 pass, 21 fail — **21 failures are pre-existing** (Redis connection refused, Supabase mock issues unrelated to this change) |

---

# Remaining Issues

1. **React error #418 root cause NOT identified.** The Root Layout imports (`SentrySetup`, `WebVitalsReporter`) are static and resolve correctly. The crash is not caused by invalid dynamic imports. The actual root cause of error #418 may be elsewhere (e.g., a missing `'use client'` boundary, a server-only import in a client component, or a Supabase/auth issue during SSR).

2. **31 dynamic inline styles remain.** These cannot be converted to Tailwind classes because the width/color values are computed at runtime. The current CSP policy (`style-src-attr 'unsafe-inline'`) already permits them. If the CSP is tightened to remove `'unsafe-inline'` for `style-src-attr`, a nonce-based `<style>` tag approach or a `ProgressBar` abstraction component would be needed.

3. **21 pre-existing test failures** exist in the test suite (Redis ECONNREFUSED, Supabase mock issues). These are unrelated to this task.

---

# Risks

- **Low risk:** The two files modified are self-contained UI components. Changes are mechanical substitutions that produce identical visual output.
- **No risk to CSP:** The CSP policy was not modified. The remaining inline styles are already permitted by `style-src-attr 'unsafe-inline'`.

---

# Recommendations

1. **Investigate the actual React error #418 root cause.** The layout imports are correct. Look for other potential causes: components imported into Server Components that lack `'use client'`, `server-only` imports in client components, or Supabase client initialization failures during SSR build-time rendering.
2. **If CSP hardening is planned** (removing `style-src-attr 'unsafe-inline'`), create a reusable `ProgressBar` component that uses CSS custom properties via nonce'd `<style>` tags, or use a pattern where width is applied via a data attribute and a global CSS rule.
3. **Consider extracting a shared progress bar utility** to reduce duplication across the 15+ files that implement the same pattern.

---

# Next Suggested Task

Investigate and fix the actual root cause of React error #418 — check for missing `'use client'` directives in components rendered inside Server Components, or failing Supabase client initialization during RSC render.
