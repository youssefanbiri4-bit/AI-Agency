# W10-P2-T3 — Smart Search, Empty States, Onboarding & Command Palette

**Task ID:** W10-P2-T3
**Title:** Smart Search, Empty States, Onboarding & Command Palette
**Role:** Senior UX Engineer

---

## Summary

Improved four product surfaces that new and returning users hit first: a smarter
**Command Palette (⌘K)** with quick actions and AI suggestions, **actionable Empty States**,
a new **Onboarding Checklist** for fresh workspaces, and supporting **i18n** for the new UI.
All changes reuse existing infrastructure (the `DashboardContext`, the `EmptyState` component,
the Supabase dashboard data loader, and the 4-locale i18n system) rather than duplicating it.

---

## Changes

### 1. Command Palette — Quick Actions, Suggestions, Recents, Ask Alex (upgraded)
`src/components/ui/CommandPalette.tsx`
- Added a **Quick Actions** group (Ask Alex, Create Task, Open Content Studio, Open System
  Health, Open Projects, Open Settings, Switch Language) alongside the existing Navigation group.
- Added **smart suggestions**: when the palette is opened with an empty query it shows
  "Recent" (last used commands from `localStorage`) and "Suggested for you" (Create Task +
  Ask Alex). This is the Smart Search entry point.
- Added an **Ask Alex** AI suggestion: while typing, the first result becomes
  *"Ask Alex about \"<query>\""* and routes to `/dashboard/alex?q=<query>` — a natural
  language shortcut into the assistant.
- Added **recents persistence** (`af_recent_commands` in `localStorage`, last 6, deduped)
  and a "Switch Language" action that cycles `en → fr → ar → es`.
- Keyboard model preserved: `↑/↓` navigate, `↵` selects, `Esc` closes; focus + scroll-into-view retained.
- Refactored state resets out of `useEffect` into event handlers (close / query change) to
  satisfy `react-hooks/set-state-in-effect`; recents load via a lazy `useState` initializer.

### 2. Empty States — contextual + actionable (upgraded)
`src/components/ui/EmptyState.tsx`
- `action?: ReactNode` — callers can now attach a primary CTA (e.g. "Create Release", already
  used by `ReleasesClient`).
- `hint?: string` (alias `helper`) — a secondary contextual line under the description,
  e.g. *"The selected filters do not show urgent operational blockers."* (already used by
  `analytics-components.tsx`).
- Kept the variant-driven defaults (`first-visit`, `no-results`, `error`, `permission-denied`)
  so existing 27+ call sites keep working with no changes; `icon`/`title` remain overridable.

### 3. Onboarding Checklist (new)
`src/components/dashboard/OnboardingChecklist.tsx`
- Client component shown on the dashboard for fresh workspaces. Derives completion from real
  workspace signals (no fabricated metrics):
  - Create your first **task** (`tasks.length > 0`)
  - Create your first **project** (`projects.length > 0`)
  - Publish your first **content** (`contentItems.length > 0`)
  - Connect an AI/social **provider** (`activeProviders > 0`)
- Progress bar + per-step checkmarks, each incomplete step links to the right workspace area.
- Dismissible; dismissal persisted in `localStorage` (`af_onboarding_checklist_dismissed`) and
  auto-hidden once all four steps are complete.
- Mounted in `src/app/(dashboard)/dashboard/page.tsx` right after the hero, fed by data the
  page already loads (no extra queries).

### 4. i18n (extended)
`src/i18n/locales/{en,fr,ar,es}.json`
- Added `commandPalette.*` (title, search placeholder, group headers, no-results, askAlexAbout)
  and `onboarding.*` (title, description, allDone, progress, start, 4 step labels) in all four
  locales. English fallbacks are supplied via `useLanguage().t(key, fallback)`, so missing keys
  degrade gracefully.

---

## Files Touched
- `src/components/ui/CommandPalette.tsx` — upgraded (actions, suggestions, recents, Ask Alex)
- `src/components/ui/EmptyState.tsx` — added `action` + `hint`/`helper` props
- `src/components/dashboard/OnboardingChecklist.tsx` — new
- `src/app/(dashboard)/dashboard/page.tsx` — mounted `OnboardingChecklist` with real signals
- `src/i18n/locales/en.json`, `fr.json`, `ar.json`, `es.json` — new keys
- `W10-P2-T3-REPORT.md` — this report

## Verification
- `npx eslint` on all changed files: **0 errors, 0 warnings**.
- `npx tsc --noEmit` (full project): **no type errors in any W10-P2-T3 file**. The four files
  touched here (CommandPalette, EmptyState, OnboardingChecklist, dashboard/page.tsx) and the
  four locale JSON files typecheck cleanly.
- JSON validity of all four locale files confirmed via `JSON.parse`.
- Locale count parity preserved; new keys added consistently across en/fr/ar/es.

## Notes / Follow-ups
- **Pre-existing type errors outside this task:** a full `tsc --noEmit` still reports 15 errors,
  but **none** are in W10-P2-T3 files. They live in `src/components/ui/KeyboardShortcutsHelp.tsx`,
  `src/components/ui/Pressable.tsx`, `src/hooks/useKeyboardShortcuts.ts`, and
  `tests/verification/alerts.verification.test.ts`. These originate from earlier uncommitted work
  (W10-P1-T3) and are out of scope here; recommend a follow-up pass to clear them before `next build`.
- The Command Palette prop contract was aligned to the current `DashboardShell` usage
  (`open` / `onOpenChange`) so the ⌘K surface keeps working.
- "Smart Search" is delivered through the Command Palette (the ⌘K surface) rather than a
  separate top-bar search box, keeping a single, consistent discovery entry point. The Topbar
  search button shares the ⌘K affordance.
- The onboarding checklist reuses already-fetched dashboard data, so it adds **zero** extra
  database queries on the dashboard route.
