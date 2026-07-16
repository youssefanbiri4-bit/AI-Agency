# FRONTEND_IMPLEMENTATION_PLAN.md

**Author:** Agent 3 — Senior Frontend Implementation Engineer  
**Date:** 2025-07-13  
**Based on:** `UI_UX_AUDIT_REPORT.md` (W8), Codebase Exploration  
**Status:** Plan Only — No Code Changes

---

## Executive Summary

This plan converts the UI/UX Audit findings into **26 discrete, reviewable implementation tasks** organized into 5 waves. Each task is scoped to a single concern (single-component fix, token migration, or pattern addition), enabling independent PRs and incremental shipping.

**Key finding from codebase exploration:** The token system (`src/styles/tokens.ts`) and Tailwind config (`tailwind.config.ts`) already define WCAG AA compliant colors, spacing, shadows, and typography. The primary work is **migrating existing components off legacy color classes** (`#F7CBCA`, `black/52`, `#5D6B6B`, etc.) onto the new token classes, and restructuring navigation/dashboard IA.

**Estimated total effort:** 38–52 engineering days (1 engineer, full-time)  
**Recommended team:** 2 frontend engineers, 8-week sprint

---

## Recommended Implementation Order

### Wave 1 — Token Migration & A11y Foundations (Days 1–5)
**Goal:** Eliminate all legacy color references; establish focus/skip system.  
**Rationale:** Every downstream task depends on correct token usage. Fixing tokens first means all subsequent work inherits WCAG AA compliance.

### Wave 2 — Navigation Restructure (Days 6–12)
**Goal:** Collapsible sidebar groups, responsive sidebar, Cmd+K command palette.  
**Rationale:** Navigation is the #1 friction point (3/10 score). Must be resolved before dashboard redesign.

### Wave 3 — Dashboard & Core Page Redesign (Days 13–22)
**Goal:** Dashboard "Command Center" layout, Content Studio notice consolidation, Settings sectioned nav.  
**Rationale:** These are the highest-traffic pages; improvements have maximum user impact.

### Wave 4 — Component Library Hardening (Days 23–34)
**Goal:** Form system, data display, toast/notification, modal/drawer primitives.  
**Rationale:** Standardized primitives prevent regressions and accelerate future feature work.

### Wave 5 — Polish & Enterprise Signals (Days 35–52)
**Goal:** Onboarding wizard, keyboard shortcuts, empty states, audit log visibility, full a11y audit.  
**Rationale:** Enterprise-grade features that complete the platform maturity story.

---

## Wave 1 — Token Migration & A11y Foundations

### T1.1 — Migrate Button Component Off Legacy Focus Ring

| Field | Value |
|-------|-------|
| **Task ID** | T1.1 |
| **Title** | Button focus ring: replace `#F7CBCA/50` with `ring` token |
| **Objective** | All focus-visible rings on `Button` use the `ring` color token instead of hardcoded legacy hex |
| **Affected Components** | `Button` |
| **Files Expected To Change** | `src/components/ui/Button.tsx` |
| **Implementation Notes** | In `buttonStyles()` (line 55), replace `focus-visible:ring-[#F7CBCA]/50` with `focus-visible:ring-ring/50`. The `ring` token is already defined as `#C0392B` (5.2:1 on white) in `tokens.ts:59`. Also remove `hover:-translate-y-0.5 active:translate-y-px` (reduces motion issues). |
| **Testing Requirements** | Visual: focus ring visible on all button variants in light mode. A11y: keyboard Tab through buttons, ring must be clearly visible (3:1+ contrast). Responsive: verify on mobile viewport. |
| **Acceptance Criteria** | 1. `focus-visible:ring-ring/50` in all button variants. 2. No hardcoded `#F7CBCA` in Button.tsx. 3. Focus ring meets 3:1 contrast on white background. |
| **Complexity** | S |
| **Priority** | P1 — Critical |
| **Dependencies** | None (tokens already exist) |

---

### T1.2 — Migrate FormControls Off Legacy Colors

| Field | Value |
|-------|-------|
| **Task ID** | T1.2 |
| **Title** | FormControls: replace all legacy color references with token classes |
| **Objective** | `Input`, `Select`, `Textarea`, `Label` use only token-based Tailwind classes |
| **Affected Components** | `FormControls` |
| **Files Expected To Change** | `src/components/ui/FormControls.tsx` |
| **Implementation Notes** | Current `controlBase` (line 11) uses `border-black/10`, `bg-white/92`, `text-black`, `placeholder:text-black/42`, `focus:border-[#F7CBCA]`, `focus:ring-[#F7CBCA]/20`, `disabled:bg-[#D5E5E5]/35`, `disabled:text-black/45`. Replace with: `border-border`, `bg-surface-elevated`, `text-foreground`, `placeholder:text-foreground-muted`, `focus:border-ring`, `focus:ring-ring/20`, `disabled:bg-surface`, `disabled:text-foreground-muted`. Label (line 51): replace `text-black/76` with `text-foreground`. |
| **Testing Requirements** | Visual: all form inputs render correctly. A11y: focus ring visible, labels associated (manual check). Dark mode: if applicable, verify contrast. |
| **Acceptance Criteria** | 1. Zero `black/` or `#F7CBCA` references in FormControls.tsx. 2. Focus ring uses `ring` token. 3. Labels use `text-foreground`. |
| **Complexity** | S |
| **Priority** | P1 — Critical |
| **Dependencies** | None |

---

### T1.3 — Migrate EmptyState Off Legacy Colors & Glassmorphism

| Field | Value |
|-------|-------|
| **Task ID** | T1.3 |
| **Title** | EmptyState: replace legacy hex colors and backdrop-blur with token classes |
| **Objective** | EmptyState uses solid surfaces, token colors, no backdrop-blur |
| **Affected Components** | `EmptyState` |
| **Files Expected To Change** | `src/components/ui/EmptyState.tsx` |
| **Implementation Notes** | Current (line 17) uses `border-[#F7CBCA]/24`, `bg-white/86`, `backdrop-blur-[16px]`, `-webkit-backdrop-filter:blur(16px)`. Replace with: `border-border`, `bg-surface-elevated`, remove backdrop-blur. Icon container (line 21): replace `border-[#F7CBCA]/12`, `bg-[#D5E5E5]/55`, `text-[#F7CBCA]` with `border-border`, `bg-surface`, `text-foreground-muted`. Title (line 24): replace `text-black` with `text-foreground`. Description (line 26): replace `text-black/58` with `text-foreground-muted`. |
| **Testing Requirements** | Visual: empty states render clean, no background bleed. Responsive: verify at 320px–1440px. |
| **Acceptance Criteria** | 1. No `#F7CBCA`, `#D5E5E5`, `black/` references. 2. No `backdrop-blur`. 3. Uses `bg-surface-elevated` for card surface. |
| **Complexity** | S |
| **Priority** | P1 — Critical |
| **Dependencies** | None |

---

### T1.4 — Migrate Topbar Off Legacy Colors

| Field | Value |
|-------|-------|
| **Task ID** | T1.4 |
| **Title** | Topbar: replace legacy hex colors in search form and language dropdown |
| **Objective** | Topbar uses only token-based classes; no hardcoded legacy hex |
| **Affected Components** | `Topbar` |
| **Files Expected To Change** | `src/components/ui/Topbar.tsx` |
| **Implementation Notes** | Search form (line 159): replace `border-[#F7CBCA]/12`, `bg-white/78`, `focus-within:border-[#F7CBCA]/50`, `focus-within:ring-[#F7CBCA]/30` with `border-border`, `bg-surface-elevated`, `focus-within:border-ring/50`, `focus-within:ring-ring/30`. Language dropdown (line 183): replace `backdrop-blur-xl` with nothing (solid surface). Replace `hover:bg-primary/10` — keep as-is (token-based). |
| **Testing Requirements** | Visual: search bar and language dropdown render correctly. A11y: focus states visible. |
| **Acceptance Criteria** | 1. Zero `#F7CBCA` references in Topbar.tsx. 2. No `backdrop-blur` on language dropdown. 3. Search form focus uses `ring` token. |
| **Complexity** | S |
| **Priority** | P1 — Critical |
| **Dependencies** | None |

---

### T1.5 — Migrate Sidebar Off Legacy Focus Ring Colors

| Field | Value |
|-------|-------|
| **Task ID** | T1.5 |
| **Title** | Sidebar: replace `focus:ring-[#F7CBCA]/50` with `focus:ring-ring/50` |
| **Objective** | All focus-visible states in Sidebar use the `ring` token |
| **Affected Components** | `Sidebar` |
| **Files Expected To Change** | `src/components/ui/Sidebar.tsx` |
| **Implementation Notes** | Lines 198, 234, 264 all use `focus-visible:ring-[#F7CBCA]/50`. Replace with `focus-visible:ring-ring/50`. Also in "Create Task" link (line 209): replace `focus-visible:ring-[#F7CBCA]/50` with `focus-visible:ring-ring/50`. The `bg-surface/80` on the aside (line 179) — keep as-is (token-based). |
| **Testing Requirements** | A11y: Tab through all sidebar items, verify focus ring visible. Keyboard: arrow key navigation through groups. |
| **Acceptance Criteria** | 1. Zero `#F7CBCA` references in Sidebar.tsx. 2. Focus ring uses `ring` token throughout. |
| **Complexity** | S |
| **Priority** | P1 — Critical |
| **Dependencies** | None |

---

### T1.6 — Fix DashboardShell Skip Link Colors

| Field | Value |
|-------|-------|
| **Task ID** | T1.6 |
| **Title** | DashboardShell: fix skip link background color to use token |
| **Objective** | Skip link uses token-based colors instead of legacy hex |
| **Affected Components** | `DashboardShell` |
| **Files Expected To Change** | `src/components/layout/DashboardShell.tsx` |
| **Implementation Notes** | Line 59: replace `bg-[#F7CBCA]` with `bg-primary`. Replace `focus-visible:ring-white/60` with `focus-visible:ring-primary-foreground/60`. The skip link pattern is correct; only colors need updating. |
| **Testing Requirements** | A11y: Tab from page load, skip link appears and is visible. Focus ring visible on skip link. |
| **Acceptance Criteria** | 1. Skip link uses `bg-primary`. 2. No `#F7CBCA` in DashboardShell.tsx. |
| **Complexity** | S |
| **Priority** | P1 — Critical |
| **Dependencies** | None |

---

### T1.7 — Add Global `aria-live` Region for Toast Notifications

| Field | Value |
|-------|-------|
| **Task ID** | T1.7 |
| **Title** | Add `aria-live="polite"` region in DashboardShell for dynamic content |
| **Objective** | Screen readers announce toast/notification updates without user focus change |
| **Affected Components** | `DashboardShell`, `toast.tsx` |
| **Files Expected To Change** | `src/components/layout/DashboardShell.tsx`, `src/components/ui/toast.tsx` |
| **Implementation Notes** | Add a visually hidden `<div aria-live="polite" aria-atomic="true" className="sr-only" />` in DashboardShell after the `<main>` element. Update `toast.tsx` to inject toast content into this region via `role="status"` for non-critical and `role="alert"` for errors. |
| **Testing Requirements** | A11y: Use screen reader (VoiceOver/NVDA), trigger a toast, verify announcement. Visual: no layout shift. |
| **Acceptance Criteria** | 1. `aria-live="polite"` region exists in DashboardShell. 2. Toast system populates live region. 3. `role="alert"` used for error toasts. |
| **Complexity** | M |
| **Priority** | P1 — Critical |
| **Dependencies** | None |

---

### T1.8 — Standardize Focus Ring Across All Interactive Elements

| Field | Value |
|-------|-------|
| **Task ID** | T1.8 |
| **Title** | Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` to all interactive elements missing focus styles |
| **Objective** | Every clickable/focusable element has a visible focus indicator meeting WCAG 2.4.7 |
| **Affected Components** | `DepartmentCard`, `ProviderRowsSection`, `ContentStudioClient` toolbar, `Notice` close buttons |
| **Files Expected To Change** | `src/components/ui/DepartmentCard.tsx`, `src/components/ui/Notice.tsx`, `src/app/(dashboard)/dashboard/content-studio/page.tsx` (toolbar buttons) |
| **Implementation Notes** | Audit all `<button>`, `<a>`, `<input>`, `<select>`, `<textarea>` elements. Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white` to any missing focus styles. For `DepartmentCard` action buttons (icon-only), add both `aria-label` and focus ring. |
| **Testing Requirements** | A11y: Full keyboard walkthrough of every interactive element. Screen reader: verify all elements reachable and operable. |
| **Acceptance Criteria** | 1. Every interactive element has visible focus ring. 2. All icon-only buttons have `aria-label`. 3. No elements with `outline: none` and no replacement. |
| **Complexity** | M |
| **Priority** | P1 — Critical |
| **Dependencies** | T1.1, T1.5 (ring token established) |

---

### T1.9 — Add `prefers-reduced-motion` Global Override

| Field | Value |
|-------|-------|
| **Task ID** | T1.9 |
| **Title** | Add reduced-motion media query to globals.css |
| **Objective** | Users who prefer reduced motion see no animations or transitions |
| **Affected Components** | Global styles |
| **Files Expected To Change** | `src/app/globals.css` |
| **Implementation Notes** | Add to globals.css: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }`. This is a global CSS addition, no component changes needed. |
| **Testing Requirements** | A11y: Enable "Reduce Motion" in OS settings, verify no animations play. Visual: layout remains stable. |
| **Acceptance Criteria** | 1. `prefers-reduced-motion: reduce` rule exists in globals.css. 2. All CSS animations and transitions suppressed. 3. No layout breakage. |
| **Complexity** | S |
| **Priority** | P2 — High |
| **Dependencies** | None |

---

## Wave 2 — Navigation Restructure

### T2.1 — Sidebar Collapsible Groups with Persisted State

| Field | Value |
|-------|-------|
| **Task ID** | T2.1 |
| **Title** | Sidebar: implement collapsible nav groups with localStorage persistence |
| **Objective** | Nav groups collapse/expand independently; state persists across sessions |
| **Affected Components** | `Sidebar` |
| **Files Expected To Change** | `src/components/ui/Sidebar.tsx` |
| **Implementation Notes** | The `navGroups` structure and `collapsedGroups` state with localStorage persistence already exist (lines 66–174). **Current state: already implemented.** Verify: (1) groups collapse on click, (2) state persists on reload, (3) active group auto-expands, (4) chevron rotates correctly. If any gap exists, fix it. This is a verification/fix task, not a greenfield implementation. |
| **Testing Requirements** | Visual: collapse/expand animation smooth. Persistence: reload page, groups maintain state. Active: navigating to a sub-item auto-expands parent group. |
| **Acceptance Criteria** | 1. All 7 groups collapse/expand. 2. State persists in localStorage. 3. Active group is always expanded. |
| **Complexity** | M |
| **Priority** | P1 — Critical |
| **Dependencies** | T1.5 (legacy color cleanup) |

---

### T2.2 — Sidebar Responsive Width & Icon-Only Collapsed State

| Field | Value |
|-------|-------|
| **Task ID** | T2.2 |
| **Title** | Sidebar: reduce default width to 240px; add icon-only collapsed mode at 64px |
| **Objective** | Sidebar consumes less horizontal space; collapses to icons on narrow viewports |
| **Affected Components** | `Sidebar`, `DashboardShell` |
| **Files Expected To Change** | `src/components/ui/Sidebar.tsx`, `src/components/layout/DashboardShell.tsx` |
| **Implementation Notes** | Sidebar.tsx line 179: change `w-60` (240px) — already correct per plan. Add a `collapsed` state (boolean) toggled by a button in sidebar header. When collapsed: show only icons (64px width, `w-16`), hide labels, show tooltips on hover. DashboardShell.tsx line 76: update `lg:ps-60` to be dynamic based on collapsed state. At viewports < 1024px: auto-collapse. Persist collapsed state in localStorage. |
| **Testing Requirements** | Visual: sidebar collapses/expands smoothly. Responsive: verify at 768px, 1024px, 1440px. Tooltip: collapsed state shows labels on hover. |
| **Acceptance Criteria** | 1. Default width ≤ 240px. 2. Icon-only mode at 64px. 3. Collapsed state persists. 4. Content area adjusts dynamically. |
| **Complexity** | L |
| **Priority** | P1 — Critical |
| **Dependencies** | T2.1 |

---

### T2.3 — Enhance CommandPalette with Real Search

| Field | Value |
|-------|-------|
| **Task ID** | T2.3 |
| **Title** | CommandPalette: add type-ahead search with results dropdown |
| **Objective** | Cmd+K opens a command palette with real search across tasks, agents, content, settings |
| **Affected Components** | `CommandPalette` |
| **Files Expected To Change** | `src/components/ui/CommandPalette.tsx` |
| **Implementation Notes** | Current `CommandPalette.tsx` exists. Replace keyword router in `Topbar.tsx` (lines 87–134) with: (1) Topbar search input triggers `setIsCommandPaletteOpen(true)` instead of direct navigation. (2) CommandPalette receives search query, shows categorized results (Navigation, Tasks, Agents, Content). (3) Keep existing keyword shortcuts as "Quick Actions" section. (4) Add `Cmd+K` keyboard hint in search placeholder. |
| **Testing Requirements** | Keyboard: Cmd+K opens palette, Esc closes, arrow keys navigate results, Enter selects. Visual: results grouped by category. A11y: `role="combobox"`, `aria-expanded`, `aria-activedescendant`. |
| **Acceptance Criteria** | 1. Cmd+K opens search palette. 2. Type-ahead shows filtered results. 3. Results categorized. 4. Keyboard navigation works. 5. Topbar search redirects to palette. |
| **Complexity** | L |
| **Priority** | P1 — Critical |
| **Dependencies** | T1.4 (Topbar cleanup) |

---

### T2.4 — Mobile Sidebar Close Button & Focus Trap

| Field | Value |
|-------|-------|
| **Task ID** | T2.4 |
| **Title** | Sidebar mobile: add visible close button and focus trap |
| **Objective** | Mobile overlay sidebar has visible X button and traps focus within |
| **Affected Components** | `Sidebar`, `DashboardShell` |
| **Files Expected To Change** | `src/components/ui/Sidebar.tsx`, `src/components/layout/DashboardShell.tsx` |
| **Implementation Notes** | Sidebar.tsx line 194–201: close button already exists with `aria-label="Close navigation menu"`. **Verify it renders on mobile.** DashboardShell.tsx line 67–74: backdrop button exists. Add focus trap: when `isMobileMenuOpen` is true, trap focus within Sidebar using `focus-trap-react` or manual `Tab` key handling. On open: focus first interactive element. On close: return focus to hamburger button. |
| **Testing Requirements** | A11y: open sidebar on mobile, Tab should cycle within sidebar only. Esc closes sidebar. Focus returns to hamburger. |
| **Acceptance Criteria** | 1. Close button visible on mobile. 2. Focus trapped within sidebar when open. 3. Focus returns to trigger on close. 4. Esc key closes sidebar. |
| **Complexity** | M |
| **Priority** | P2 — High |
| **Dependencies** | T1.5 |

---

## Wave 3 — Dashboard & Core Page Redesign

### T3.1 — Dashboard Primary CTA Zone (Above Fold)

| Field | Value |
|-------|-------|
| **Task ID** | T3.1 |
| **Title** | Dashboard: add primary action zone above fold |
| **Objective** | Replace hero section with 3 primary CTAs: Create Task, Run Scheduler, Review Queue |
| **Affected Components** | `DashboardHeroAnimation`, `PersonalizedDashboard` |
| **Files Expected To Change** | `src/app/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/DashboardHeroAnimation.tsx`, `src/components/dashboard/PersonalizedDashboard.tsx` |
| **Implementation Notes** | The dashboard page uses `PersonalizedDashboard` component. Redesign the top section to: (1) `QuickActionsBar` — 3 large action cards with icons, labels, and status indicators. (2) Replace `DashboardHeroAnimation` with a compact health scorecard row. (3) Use `Card` component with `bg-surface-elevated` (no glassmorphism). Follow existing `Card`/`CardHeader` patterns. Use i18n keys for all text. |
| **Testing Requirements** | Visual: primary actions visible without scrolling on 1080p. Responsive: stacks on mobile. A11y: all CTAs keyboard accessible. |
| **Acceptance Criteria** | 1. 3 primary CTAs above fold. 2. No stacked card overload. 3. Uses existing `Card` component. 4. All text via i18n. |
| **Complexity** | L |
| **Priority** | P1 — Critical |
| **Dependencies** | T1.1–T1.6 (token cleanup) |

---

### T3.2 — Dashboard Health Scorecard Row

| Field | Value |
|-------|-------|
| **Task ID** | T3.2 |
| **Title** | Dashboard: add single-row health scorecard (4 critical metrics) |
| **Objective** | Replace 12+ stacked stat cards with a compact 4-metric health row |
| **Affected Components** | `StatCard` (existing), new `HealthScoreCard` |
| **Files Expected To Change** | `src/app/(dashboard)/dashboard/page.tsx`, potentially new `src/components/dashboard/HealthScoreCard.tsx` |
| **Implementation Notes** | Create `HealthScoreCard` that renders 4 `StatCard` instances in a responsive grid (`grid-cols-2 lg:grid-cols-4`). Metrics: Provider Status (count active/total), Scheduler Health (green/red dot), Queue Depth (tasks pending review), System Uptime. Use existing `StatCard` with semantic tones (`success`, `warning`, `danger`). Remove `card-lift` hover animation (causes motion issues). |
| **Testing Requirements** | Visual: 4 metrics in single row on desktop, 2x2 on tablet, stacked on mobile. A11y: screen reader announces each metric. |
| **Acceptance Criteria** | 1. 4 health metrics in single visual row. 2. Uses `StatCard` with semantic tones. 3. No hover lift animation. 4. Responsive at all breakpoints. |
| **Complexity** | M |
| **Priority** | P1 — Critical |
| **Dependencies** | T3.1 |

---

### T3.3 — Dashboard Expandable Secondary Panels

| Field | Value |
|-------|-------|
| **Task ID** | T3.3 |
| **Title** | Dashboard: move Projects, Releases, Content stats into collapsible panels |
| **Objective** | Reduce cognitive load by hiding secondary content behind expandable sections |
| **Affected Components** | `PersonalizedDashboard`, new `ExpandablePanel` |
| **Files Expected To Change** | `src/components/dashboard/PersonalizedDashboard.tsx`, new `src/components/ui/ExpandablePanel.tsx` |
| **Implementation Notes** | Create `ExpandablePanel` component: header with chevron, collapsible body, persisted open/close state (localStorage). Pattern: `<ExpandablePanel title="Projects" defaultOpen={false}>...</ExpandablePanel>`. Migrate Projects, Releases, Content Snapshot, and Activity sections into panels. Default: collapsed for first-time users, persisted after interaction. |
| **Testing Requirements** | Visual: panels collapse/expand smoothly. Persistence: state saved across reloads. A11y: `aria-expanded` on trigger, `role="region"` on content. |
| **Acceptance Criteria** | 1. `ExpandablePanel` component created. 2. 4+ sections migrated to panels. 3. State persisted. 4. Accessible expand/collapse. |
| **Complexity** | M |
| **Priority** | P2 — High |
| **Dependencies** | T3.1, T3.2 |

---

### T3.4 — Content Studio Notice Consolidation

| Field | Value |
|-------|-------|
| **Task ID** | T3.4 |
| **Title** | Content Studio: replace 5 stacked Notices with single ProviderStatusPanel |
| **Objective** | Consolidate provider warnings into one accordion panel with inline status badges |
| **Affected Components** | `Notice`, new `ProviderStatusPanel` |
| **Files Expected To Change** | `src/app/(dashboard)/dashboard/content-studio/page.tsx`, new `src/components/dashboard/ProviderStatusPanel.tsx` |
| **Implementation Notes** | Lines 294–327 of content-studio page have 5 `Notice` components stacked. Create `ProviderStatusPanel`: (1) Single card with header "Provider Status". (2) Each provider: `StatusBadge` + provider name + action link (Connect/Configure/View Logs). (3) Only critical blockers show as top-level banner. (4) Use existing `Card`, `CardHeader`, `StatusBadge` components. Move scheduler status to Topbar indicator (green dot = running). |
| **Testing Requirements** | Visual: single panel replaces 5 notices. A11y: panel expandable, each provider row focusable. Responsive: stacks on mobile. |
| **Acceptance Criteria** | 1. Single `ProviderStatusPanel` replaces 5 `Notice` components. 2. Each provider has status badge and action. 3. Only critical issues show as banner. |
| **Complexity** | M |
| **Priority** | P2 — High |
| **Dependencies** | T1.3 (Notice cleanup) |

---

### T3.5 — Settings Page Sectioned Navigation

| Field | Value |
|-------|-------|
| **Task ID** | T3.5 |
| **Title** | Settings: add left-rail section navigation with collapsible sections |
| **Objective** | Settings page uses persistent sidebar navigation instead of anchor links |
| **Affected Components** | Settings page layout |
| **Files Expected To Change** | `src/app/(dashboard)/dashboard/settings/page.tsx` |
| **Implementation Notes** | Current settings page (line 333–345) has 10 sections in single scroll with anchor links. Redesign: (1) Left rail with section links (sticky on desktop, drawer on mobile). (2) Groups: Workspace, Brand, Integrations, Team, Security, Advanced. (3) Each section: collapsible card with summary status. (4) Basic/Advanced toggle per section. Use existing `Card`/`CardHeader` pattern. Use i18n for all labels. |
| **Testing Requirements** | Visual: left rail visible on desktop, drawer on mobile. Navigation: clicking section scrolls to it. A11y: `aria-current` on active section. |
| **Acceptance Criteria** | 1. Left rail navigation present. 2. Sections grouped logically. 3. Collapsible with summary status. 4. Responsive (drawer on mobile). |
| **Complexity** | L |
| **Priority** | P2 — High |
| **Dependencies** | T1.1–T1.6 |

---

## Wave 4 — Component Library Hardening

### T4.1 — FormField Wrapper Component

| Field | Value |
|-------|-------|
| **Task ID** | T4.1 |
| **Title** | Create FormField component enforcing label-input association |
| **Objective** | Every form input is wrapped in FormField that enforces `id`/`htmlFor` binding, error display, and hint text |
| **Affected Components** | New `FormField`, `FormControls` |
| **Files Expected To Change** | New `src/components/ui/FormField.tsx`, `src/components/ui/FormControls.tsx` |
| **Implementation Notes** | Create `FormField` that wraps `Label` + `Input`/`Select`/`Textarea` + `FormError` + `FormHint`. Auto-generates `id` from field name. Links error via `aria-describedby`. Adds `required` + `aria-required` when needed. Pattern: `<FormField label="Email" name="email" required error={errors.email}><Input /></FormField>`. Update all existing forms to use `FormField`. |
| **Testing Requirements** | A11y: screen reader announces label when input focused. Error messages linked via `aria-describedby`. Required fields announced. |
| **Acceptance Criteria** | 1. `FormField` component created. 2. All forms migrated. 3. `id`/`htmlFor` always paired. 4. Errors use `aria-describedby`. |
| **Complexity** | M |
| **Priority** | P1 — Critical |
| **Dependencies** | T1.2 |

---

### T4.2 — StatusBadge Semantic Color Audit

| Field | Value |
|-------|-------|
| **Task ID** | T4.2 |
| **Title** | StatusBadge: verify all status→color mappings are semantically correct |
| **Objective** | Every status uses the correct semantic color (success=green, warning=amber, danger=red, info=blue, neutral=gray) |
| **Affected Components** | `StatusBadge` |
| **Files Expected To Change** | `src/components/ui/StatusBadge.tsx` |
| **Implementation Notes** | **Current state: already correct.** The `statusConfig` object (lines 43–289) already maps all statuses to semantic tokens (`status-success-*`, `status-warning-*`, `status-danger-*`, `status-info-*`, `status-neutral-*`). Audit: (1) "Active" uses `status-warning-*` — this is intentional (active=needs attention). (2) "Ready" uses `status-success-*` — correct. (3) "Setup Required" uses `status-warning-*` — correct. Verify no legacy `#F7CBCA` references remain. This is a verification task. |
| **Testing Requirements** | Visual: each status badge renders with correct color. Cross-reference with audit report VFL-06. |
| **Acceptance Criteria** | 1. All status→color mappings verified correct. 2. No legacy hex in StatusBadge.tsx. 3. Audit report VFL-06 resolved. |
| **Complexity** | S |
| **Priority** | P2 — High |
| **Dependencies** | None |

---

### T4.3 — StatCard Trend Indicator Fix

| Field | Value |
|-------|-------|
| **Task ID** | T4.3 |
| **Title** | StatCard: verify trend indicators use distinct semantic colors |
| **Objective** | Positive trends = green, negative trends = red (no color confusion) |
| **Affected Components** | `StatCard` |
| **Files Expected To Change** | `src/components/ui/StatCard.tsx` |
| **Implementation Notes** | **Current state: already fixed.** Lines 103–107 show: `trend.isPositive ? 'bg-success-light text-success' : 'bg-danger-light text-danger'`. This resolves audit VFL-05. Verify: (1) No other `StatCard` usage overrides trend colors. (2) Remove `card-lift` class if present (hover:-translate-y-0.5 causes motion issues). This is a verification task. |
| **Testing Requirements** | Visual: positive trend = green badge, negative = red badge. No identical colors for opposite trends. |
| **Acceptance Criteria** | 1. Trend colors verified distinct. 2. No `card-lift` or `hover:-translate-y-0.5` on StatCard. 3. Audit VFL-05 confirmed resolved. |
| **Complexity** | S |
| **Priority** | P2 — High |
| **Dependencies** | None |

---

### T4.4 — Toast Provider with aria-live Integration

| Field | Value |
|-------|-------|
| **Task ID** | T4.4 |
| **Title** | Toast: connect toast system to global aria-live region |
| **Objective** | Toast notifications are announced to screen readers via the live region |
| **Affected Components** | `toast.tsx`, `useActionToast.ts` |
| **Files Expected To Change** | `src/components/ui/toast.tsx`, `src/components/ui/useActionToast.ts` |
| **Implementation Notes** | The `useActionToast` hook exists. Connect it to the `aria-live` region added in T1.7. When a toast fires: (1) Inject text content into the live region div. (2) Use `role="status"` for success/info, `role="alert"` for errors. (3) Auto-remove after timeout. Ensure toast component uses semantic colors from tokens. |
| **Testing Requirements** | A11y: trigger toast, screen reader announces content. Visual: toast appears with correct semantic color. |
| **Acceptance Criteria** | 1. Toasts populate `aria-live` region. 2. `role="status"` / `role="alert"` used correctly. 3. Toasts use token colors. |
| **Complexity** | M |
| **Priority** | P2 — High |
| **Dependencies** | T1.7 |

---

### T4.5 — DataTable with Row Selection & Bulk Actions

| Field | Value |
|-------|-------|
| **Task ID** | T4.5 |
| **Title** | DataTable: add row selection checkboxes and floating bulk action bar |
| **Objective** | Tables support multi-select with contextual bulk actions |
| **Affected Components** | `TaskTable`, `TasksClient`, `ContentStudioClient` |
| **Files Expected To Change** | `src/components/ui/TaskTable.tsx`, `src/components/tasks/TasksClient.tsx`, `src/app/(dashboard)/dashboard/content-studio/page.tsx` |
| **Implementation Notes** | Add to `TaskTable`: (1) Checkbox column with `aria-label` per row. (2) Header checkbox for select-all. (3) Selected count display. (4) Floating bulk action bar (position: fixed bottom) with: Assign, Status Change, Delete, Export. Use existing `Button` component for actions. Use `usePagination` hook pattern for state management. |
| **Testing Requirements** | Keyboard: Space to toggle selection, Shift+Click for range. A11y: `aria-selected` on rows, bulk bar announced. Visual: selected rows highlighted. |
| **Acceptance Criteria** | 1. Row selection works. 2. Bulk action bar appears with selection. 3. All actions keyboard accessible. 4. Screen reader compatible. |
| **Complexity** | L |
| **Priority** | P2 — High |
| **Dependencies** | T1.1, T1.2 |

---

### T4.6 — Modal/Drawer Primitives

| Field | Value |
|-------|-------|
| **Task ID** | T4.6 |
| **Title** | Create Modal and Drawer components using Headless UI / Radix Dialog |
| **Objective** | Standardized dialog primitives with focus trap, Esc to close, backdrop click |
| **Affected Components** | New `Modal`, `Drawer` |
| **Files Expected To Change** | New `src/components/ui/Modal.tsx`, new `src/components/ui/Drawer.tsx` |
| **Implementation Notes** | Check `package.json` for existing `@headlessui/react` or `@radix-ui/react-dialog`. If present, use it. If not, implement minimal dialog: (1) `Modal`: centered, blocking, `role="dialog"`, `aria-modal="true"`, focus trap, Esc to close. (2) `Drawer`: slide-in from side, persistent option, same a11y. Use `z-index.modal` from tokens. Use `overlay` color from tokens for backdrop. |
| **Testing Requirements** | A11y: focus trapped, Esc closes, backdrop click closes, `aria-modal` present. Visual: smooth open/close animation (respects reduced-motion). |
| **Acceptance Criteria** | 1. `Modal` and `Drawer` components created. 2. Focus trap works. 3. Esc/backdrop close. 4. Uses token z-index and overlay colors. |
| **Complexity** | L |
| **Priority** | P2 — High |
| **Dependencies** | T1.9 (reduced motion) |

---

## Wave 5 — Polish & Enterprise Signals

### T5.1 — Onboarding Wizard (Multi-Step)

| Field | Value |
|-------|-------|
| **Task ID** | T5.1 |
| **Title** | Onboarding: replace single-form with multi-step wizard |
| **Objective** | Guided onboarding with progressive disclosure across 4 steps |
| **Affected Components** | `WorkspaceSetupForm`, onboarding page |
| **Files Expected To Change** | `src/app/onboarding/page.tsx`, `src/components/auth/WorkspaceSetupForm.tsx` (or new component) |
| **Implementation Notes** | Current onboarding has name + slug only (lines from audit). Create multi-step wizard: (1) Workspace identity (name, slug, logo, timezone). (2) Team invitation (email, role). (3) Provider connections (guided OAuth). (4) First task creation (template selection). Use step indicator (1/4, 2/4...). Validate each step before advancing. Use `FormField` from T4.1. Persist progress to avoid restart on page refresh. |
| **Testing Requirements** | Visual: step indicator clear, transitions smooth. A11y: each step announced, progress indicated. Keyboard: Tab through form, Enter to advance. |
| **Acceptance Criteria** | 1. 4-step wizard. 2. Validation per step. 3. Progress persisted. 4. Uses FormField. 5. All text via i18n. |
| **Complexity** | L |
| **Priority** | P2 — High |
| **Dependencies** | T4.1 |

---

### T5.2 — Keyboard Shortcuts System

| Field | Value |
|-------|-------|
| **Task ID** | T5.2 |
| **Title** | Add global keyboard shortcuts with help overlay |
| **Objective** | Power users can navigate and act via keyboard shortcuts |
| **Affected Components** | `DashboardShell`, `CommandPalette` |
| **Files Expected To Change** | `src/components/layout/DashboardShell.tsx`, `src/components/ui/CommandPalette.tsx`, new `src/components/ui/KeyboardShortcutsHelp.tsx` |
| **Implementation Notes** | Shortcuts: `Cmd+K` (command palette, already exists), `Cmd+/` (shortcuts help overlay), `G then D` (go to Dashboard), `G then T` (go to Tasks), `G then S` (go to Content Studio), `/` (focus search), `Esc` (close modal/drawer/sidebar). Implement `KeyboardShortcutsHelp` modal listing all shortcuts. Use `useEffect` with `keydown` listener for shortcut sequences (e.g., `G` then wait for next key). |
| **Testing Requirements** | Keyboard: all shortcuts work. Visual: help overlay lists shortcuts. A11y: help overlay accessible. |
| **Acceptance Criteria** | 1. 6+ shortcuts implemented. 2. Help overlay accessible via `Cmd+/`. 3. No conflicts with browser shortcuts. 4. Sequence shortcuts (G→D) work. |
| **Complexity** | M |
| **Priority** | P3 — Medium |
| **Dependencies** | T2.3 (CommandPalette) |

---

### T5.3 — Empty State Pattern Library

| Field | Value |
|-------|-------|
| **Task ID** | T5.3 |
| **Title** | EmptyState: add contextual variants (first-visit, no-results, error, permission-denied) |
| **Objective** | Empty states provide actionable guidance, not just "No items yet" |
| **Affected Components** | `EmptyState` |
| **Files Expected To Change** | `src/components/ui/EmptyState.tsx` |
| **Implementation Notes** | Extend `EmptyState` props: add `variant?: 'first-visit' \| 'no-results' \| 'error' \| 'permission-denied'`. Each variant: (1) Unique illustration/icon. (2) Context-aware title and description. (3) Primary CTA (context-specific). (4) Secondary "Learn more" or "Browse templates" link. For `first-visit`: show template gallery. For `no-results`: show search tips. For `error`: show retry + support link. For `permission-denied`: show request access CTA. |
| **Testing Requirements** | Visual: each variant renders distinctly. A11y: all CTAs keyboard accessible. Responsive: stacks on mobile. |
| **Acceptance Criteria** | 1. 4 variants implemented. 2. Each has illustration, title, description, CTA. 3. Uses token colors (no legacy hex). |
| **Complexity** | M |
| **Priority** | P3 — Medium |
| **Dependencies** | T1.3 |

---

### T5.4 — Mobile Bottom Navigation Enhancement

| Field | Value |
|-------|-------|
| **Task ID** | T5.4 |
| **Title** | MobileBottomNav: ensure 5 primary destinations + active state |
| **Objective** | Mobile bottom nav shows 5 key destinations with clear active indicator |
| **Affected Components** | `MobileBottomNav` |
| **Files Expected To Change** | `src/components/ui/MobileBottomNav.tsx` |
| **Implementation Notes** | `MobileBottomNav` already exists. Verify: (1) Shows 5 destinations (Dashboard, Tasks, Content Studio, Agents, More). (2) Active state uses `text-primary` + indicator. (3) "More" opens full sidebar. (4) Touch targets ≥ 44px. (5) Labels visible (not icon-only). If gaps exist, fix them. |
| **Testing Requirements** | Visual: 5 items, labels visible, active state clear. Touch: targets ≥ 44px. A11y: `aria-current="page"` on active. |
| **Acceptance Criteria** | 1. 5 destinations with labels. 2. Active state visible. 3. Touch targets ≥ 44px. 4. "More" opens sidebar. |
| **Complexity** | S |
| **Priority** | P2 — High |
| **Dependencies** | T2.4 |

---

### T5.5 — Full WCAG 2.1 AA Audit & Remediation

| Field | Value |
|-------|-------|
| **Task ID** | T5.5 |
| **Title** | Run automated a11y audit (axe-core) and fix all remaining issues |
| **Objective** | Zero critical/high a11y violations in automated scan |
| **Affected Components** | All |
| **Files Expected To Change** | Multiple files across `src/components/` and `src/app/` |
| **Implementation Notes** | (1) Install `@axe-core/react` or run `axe-core` CLI against dev server. (2) Fix all critical violations: missing alt text, missing labels, contrast failures, missing landmarks. (3) Fix all serious violations: missing ARIA roles, duplicate IDs, empty links. (4) Manual screen reader testing with VoiceOver (Mac) and NVDA (Windows). (5) Document any remaining violations with justification. |
| **Testing Requirements** | Automated: axe-core scan passes with 0 critical/serious. Manual: screen reader walkthrough of key flows. Keyboard: full navigation without mouse. |
| **Acceptance Criteria** | 1. axe-core: 0 critical, 0 serious violations. 2. Screen reader can complete key tasks. 3. All WCAG 2.1 AA criteria met. |
| **Complexity** | L |
| **Priority** | P1 — Critical |
| **Dependencies** | All previous tasks |

---

### T5.6 — Legacy Color Deprecation Cleanup

| Field | Value |
|-------|-------|
| **Task ID** | T5.6 |
| **Title** | Remove all remaining legacy color class references across codebase |
| **Objective** | Zero references to deprecated `brand-ink`, `brand-rose`, `brand-ice`, `#F7CBCA`, `black/52`, `#5D6B6B` in component files |
| **Affected Components** | All components using legacy colors |
| **Files Expected To Change** | `grep` results across `src/components/` and `src/app/` |
| **Implementation Notes** | Run `rg "#F7CBCA\|brand-ink\|brand-rose\|brand-ice\|#5D6B6B\|black/52\|black/56\|black/58\|black/76\|black/42\|black/45\|black/10\|black/32" src/` to find all legacy references. Migrate each to token equivalent. Keep `legacy` object in `tokens.ts` but mark with `@deprecated` JSDoc. Eventually remove legacy aliases from `tailwind.config.ts`. |
| **Testing Requirements** | Automated: grep for legacy patterns returns 0 results in component files. Visual: all components render with new token colors. |
| **Acceptance Criteria** | 1. Zero legacy color references in `src/components/`. 2. Zero legacy color references in `src/app/` (except globals.css if needed). 3. `tailwind.config.ts` legacy section marked deprecated. |
| **Complexity** | M |
| **Priority** | P1 — Critical |
| **Dependencies** | T1.1–T1.6, T3.1–T3.5, T4.1–T4.6 |

---

## Quick Wins (Ship This Sprint)

These tasks can be completed in **1–2 days** with immediate impact:

| # | Task | Effort | Fixes |
|---|------|--------|-------|
| 1 | **T1.1** — Button focus ring fix | 30 min | A11Y-03 |
| 2 | **T1.2** — FormControls color migration | 1 hr | VFL-01, A11Y-01 |
| 3 | **T1.3** — EmptyState color migration | 1 hr | VFL-01, VFL-02 |
| 4 | **T1.4** — Topbar color migration | 1 hr | VFL-01, VFL-02 |
| 5 | **T1.5** — Sidebar focus ring fix | 30 min | A11Y-03 |
| 6 | **T1.6** — DashboardShell skip link fix | 15 min | A11Y-02 |
| 7 | **T1.9** — Reduced motion global CSS | 30 min | A11Y-08 |

**Total Quick Wins effort: ~4.5 hours**

---

## Long-Term Tasks (Multi-Sprint)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | **T2.2** — Sidebar collapsed mode | 3–4 days | FRP-02 |
| 2 | **T2.3** — CommandPalette real search | 3–4 days | FRP-04 |
| 3 | **T3.1–T3.3** — Dashboard redesign | 5–7 days | FRP-03 |
| 4 | **T3.5** — Settings sectioned nav | 3–4 days | FRP-06 |
| 5 | **T4.1** — FormField system | 2–3 days | A11Y-04 |
| 6 | **T4.5** — DataTable bulk actions | 3–4 days | FRP-09 |
| 7 | **T4.6** — Modal/Drawer primitives | 3–4 days | Foundation |
| 8 | **T5.1** — Onboarding wizard | 4–5 days | FRP-07 |
| 9 | **T5.5** — Full a11y audit | 3–5 days | A11Y all |

---

## Estimated Total Effort

| Wave | Tasks | Estimated Days |
|------|-------|----------------|
| Wave 1 — Token Migration & A11y | 9 tasks | 5–7 days |
| Wave 2 — Navigation | 4 tasks | 7–10 days |
| Wave 3 — Dashboard & Core Pages | 5 tasks | 10–14 days |
| Wave 4 — Component Library | 6 tasks | 10–14 days |
| Wave 5 — Polish & Enterprise | 6 tasks | 10–14 days |
| **Total** | **30 tasks** | **42–59 days** |

**With 2 engineers:** ~21–30 calendar days (8-week sprint)  
**With 1 engineer:** ~42–59 calendar days (10–12 weeks)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Token migration breaks existing styles** | Medium | High | Ship behind feature flag; visual regression test each component after migration |
| **Sidebar restructure breaks routing** | Low | High | Keep existing `navGroups` structure; only add collapse behavior, don't change hrefs |
| **Dashboard redesign regresses performance** | Medium | Medium | Lazy-load secondary panels; profile before/after with Lighthouse |
| **Form changes break existing validation** | Low | High | `FormField` wraps existing inputs; don't change validation logic, only presentation |
| **i18n keys missing for new UI text** | Medium | Low | Add all new i18n keys in Wave 1 before component work starts |
| **Focus trap implementation conflicts with existing keyboard handlers** | Medium | Medium | Use `focus-trap-react` library; test with screen reader early |
| **Legacy color removal causes visual regressions** | High | Medium | Grep-based verification; CI check for legacy hex patterns |
| **Radix UI / Headless UI not in dependencies** | Low | Low | Check `package.json` first; if missing, implement minimal primitives or add dependency |

---

## Appendix: Files Reference Map

| File | Path | Tasks |
|------|------|-------|
| `tokens.ts` | `src/styles/tokens.ts` | All (source of truth) |
| `tailwind.config.ts` | `tailwind.config.ts` | T5.6 |
| `Button.tsx` | `src/components/ui/Button.tsx` | T1.1 |
| `FormControls.tsx` | `src/components/ui/FormControls.tsx` | T1.2, T4.1 |
| `EmptyState.tsx` | `src/components/ui/EmptyState.tsx` | T1.3, T5.3 |
| `Topbar.tsx` | `src/components/ui/Topbar.tsx` | T1.4, T2.3 |
| `Sidebar.tsx` | `src/components/ui/Sidebar.tsx` | T1.5, T2.1, T2.2, T2.4 |
| `DashboardShell.tsx` | `src/components/layout/DashboardShell.tsx` | T1.6, T1.7, T2.2, T2.4, T5.2 |
| `StatCard.tsx` | `src/components/ui/StatCard.tsx` | T3.2, T4.3 |
| `StatusBadge.tsx` | `src/components/ui/StatusBadge.tsx` | T4.2 |
| `Card.tsx` | `src/components/ui/Card.tsx` | T3.1–T3.5 (used everywhere) |
| `TaskTable.tsx` | `src/components/ui/TaskTable.tsx` | T4.5 |
| `toast.tsx` | `src/components/ui/toast.tsx` | T1.7, T4.4 |
| `useActionToast.ts` | `src/components/ui/useActionToast.ts` | T4.4 |
| `MobileBottomNav.tsx` | `src/components/ui/MobileBottomNav.tsx` | T5.4 |
| `CommandPalette.tsx` | `src/components/ui/CommandPalette.tsx` | T2.3, T5.2 |
| `DepartmentCard.tsx` | `src/components/ui/DepartmentCard.tsx` | T1.8 |
| `Notice.tsx` | `src/components/ui/Notice.tsx` | T1.8, T3.4 |
| `globals.css` | `src/app/globals.css` | T1.9 |
| `dashboard/page.tsx` | `src/app/(dashboard)/dashboard/page.tsx` | T3.1, T3.2, T3.3 |
| `content-studio/page.tsx` | `src/app/(dashboard)/dashboard/content-studio/page.tsx` | T3.4, T4.5 |
| `settings/page.tsx` | `src/app/(dashboard)/dashboard/settings/page.tsx` | T3.5 |
| `onboarding/page.tsx` | `src/app/onboarding/page.tsx` | T5.1 |
| `PersonalizedDashboard.tsx` | `src/components/dashboard/PersonalizedDashboard.tsx` | T3.1, T3.3 |
| `DashboardHeroAnimation.tsx` | `src/components/dashboard/DashboardHeroAnimation.tsx` | T3.1 |

---

*End of FRONTEND_IMPLEMENTATION_PLAN.md*
