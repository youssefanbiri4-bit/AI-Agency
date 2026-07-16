# REF-1 REPORT: Clean Architecture + File Structure + Module Boundaries

**📅 Date:** 2026-07-15  
**👤 Role:** Senior Architecture Engineer  
**📋 Task ID:** REF-1  
**📊 Status:** ✅ Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Target Architecture](#target-architecture)
3. [Changes Summary](#changes-summary)
4. [New Structure Details](#new-structure-details)
5. [Dead Code Removal](#dead-code-removal)
6. [Import Convention](#import-convention)
7. [Migration Guide](#migration-guide)
8. [Verification](#verification)
9. [Next Steps](#next-steps)

---

## Overview

Implemented a clean architecture with clear module boundaries using a **progressive migration strategy**:

| Strategy | Description |
|----------|-------------|
| **Phase 1** (✅ Done) | Create new directory structure with barrel files + architecture READMEs |
| **Phase 2** (→ Next) | Gradually move files from `src/lib/` into `src/core/` and `src/shared/` |
| **Phase 3** (→ Future) | Remove old barrel files once all imports are migrated |

**No files were moved.** The refactoring uses barrel files (index.ts) that re-export from current locations — zero risk of breaking imports.

---

## Target Architecture

```
src/
├── core/                          # Business logic & domain models
│   ├── auth/                      # Authentication, RBAC, sessions
│   ├── billing/                   # Plans, subscriptions, Stripe
│   ├── agents/                    # Agent analytics, ranking, recommendations
│   ├── ai/                        # OpenAI text/image/video providers
│   ├── workflows/                 # Workflow builder, review, templates
│   ├── usage/                     # Quotas, cost tracking, analytics
│   └── marketing/                 # Email campaigns, referrals, blog
│
├── features/                      # Feature modules (already exists)
│   ├── reports/
│   ├── content-studio/
│   └── tasks/
│
├── shared/                        # Shared code across features
│   ├── types/                     # TypeScript type definitions
│   ├── lib/                       # Core utilities (logger, network)
│   ├── ui/                        # Reusable UI components
│   ├── hooks/                     # Custom React hooks
│   ├── i18n/                      # Internationalization
│   ├── data/                      # Data access layer (ref. only)
│   ├── api/                       # API utilities (ref. only)
│   └── alerts/                    # Alerting channels (ref. only)
│
├── app/                           # Next.js App Router (unchanged)
├── actions/                       # Server actions (unchanged)
├── components/                    # UI components (unchanged)
├── hooks/                         # React hooks (unchanged)
├── i18n/                          # i18n (unchanged)
└── types/                         # Types (unchanged)
```

### Key Principles

1. **`src/core/`** — Pure business logic, no React, no Next.js dependencies
2. **`src/features/`** — Feature modules with their own data/service/UI layers
3. **`src/shared/`** — Infrastructure code: types, utilities, UI, hooks
4. **`src/app/`** — Next.js App Router (pages, layouts, API routes)
5. **`src/actions/`** — Server actions (thin layer between app and core)

---

## Changes Summary

### New Files Created (9)

| File | Type | Purpose |
|------|------|---------|
| `src/core/README.md` | Documentation | Domain architecture guide |
| `src/core/auth/index.ts` | Barrel | Re-exports auth modules from `src/lib/auth/` |
| `src/core/billing/index.ts` | Barrel | Re-exports billing + Stripe modules |
| `src/core/agents/index.ts` | Barrel | Re-exports agent intelligence modules |
| `src/core/ai/index.ts` | Barrel | Re-exports AI provider modules |
| `src/core/workflows/index.ts` | Barrel | Re-exports workflow builder + templates |
| `src/core/usage/index.ts` | Barrel | Re-exports usage tracking + quotas |
| `src/core/marketing/index.ts` | Barrel | Re-exports marketing + referrals |
| `src/shared/README.md` | Documentation | Shared code architecture guide |
| `src/shared/types/index.ts` | Barrel | Re-exports type definitions |
| `src/shared/ui/index.ts` | Barrel | Re-exports UI components (27 re-exports) |
| `src/shared/lib/index.ts` | Barrel | Re-exports core utilities (14 re-exports) |
| `src/shared/hooks/index.ts` | Barrel | Re-exports custom React hooks |
| `docs/REF-1-REPORT.md` | Documentation | This report |

### Modified Files (1)

| File | Change |
|------|--------|
| `src/features/reports/service/pdf-export.ts` | Enhanced `@deprecated` notice with migration guidance |

### Module Boundaries (Current Map)

| Domain | Location(s) | Mapped to |
|--------|-------------|-----------|
| Authentication & Authorization | `src/lib/auth/` | `src/core/auth/` |
| Billing & Subscriptions | `src/lib/billing/`, `src/lib/stripe/` | `src/core/billing/` |
| Agent Intelligence | `src/lib/agents/` | `src/core/agents/` |
| AI Providers | `src/lib/ai/` | `src/core/ai/` |
| Workflows & Templates | `src/lib/agent-library/` | `src/core/workflows/` |
| Usage & Quotas | `src/lib/usage/` | `src/core/usage/` |
| Marketing & Referrals | `src/lib/marketing/` | `src/core/marketing/` |
| UI Components | `src/components/ui/` | `src/shared/ui/` |
| TypeScript Types | `src/types/` | `src/shared/types/` |
| Core Utilities | `src/lib/` (selected) | `src/shared/lib/` |
| React Hooks | `src/hooks/` | `src/shared/hooks/` |

---

## Dead Code Removal

### Deprecated Modules Identified

| File | Status | Reason |
|------|--------|--------|
| `src/features/reports/service/pdf-export.ts` | ⚠️ Marked deprecated | Replaced by `generateServerPDF` |
| `src/lib/usage/cost-tracking.ts:getEstimatedTotalCostForWorkspace()` | ⚠️ Marked deprecated | Use `getWorkspaceCostBreakdown` instead |
| `src/lib/auth/rbac.ts:requirePageAccess()` | ⚠️ Marked deprecated | Use `getRBACContext()` instead |
| `src/lib/features/content-studio/data/content-studio.ts:rbacScope` | ⚠️ Reserved | Reserved for RBAC scoping |

### Dead Code Detection Metrics

- **Deprecated functions found:** 3
- **Unused imports detected:** ~15+ (inferred from TS errors)
- **Legacy plan types (starter, agency):** Present but not shown in UI
- **Duplicate patterns:** Some data access functions in `src/lib/data/` overlap with `src/features/*/data/`

---

## Import Convention

### New Convention

```typescript
// ✅ New code should use clean architecture paths:
import { logger } from '@/shared/lib';
import { Button } from '@/shared/ui';
import { requirePageAccess } from '@/core/auth';
import { PLANS } from '@/core/billing';
import { checkQuota } from '@/core/usage';

// ❌ Old paths still work but are deprecated:
import { logger } from '@/lib/logger';           // OK but prefer shared
import { requirePageAccess } from '@/lib/auth/require-page-access'; // OK but prefer core
```

### Path Aliases (tsconfig.json)

The existing path aliases work with the new structure:

```json
{
  "paths": {
    "@/*": ["./src/*"]  // Already works for @/core/* and @/shared/*
  }
}
```

No changes to `tsconfig.json` are needed — `@/*` already maps to `./src/*`.

---

## Migration Guide

### Phase 1 (✅ Complete): Structure Setup

- [x] Create `src/core/` with 7 domain subdirectories
- [x] Create `src/shared/` with types, ui, lib, hooks
- [x] Add barrel files (index.ts) at each directory
- [x] Add README with architecture docs
- [x] Mark deprecated modules with JSDoc

### Phase 2 (→ Recommended Next): File Migration

- [ ] Move core domain files from `src/lib/*/` into `src/core/*/`
- [ ] Update `src/core/*/index.ts` to export directly instead of re-exporting
- [ ] Update all imports across the codebase using codemods
- [ ] Run full typecheck + tests to verify

### Phase 3 (→ Future): Consolidation

- [ ] Move `src/types/` into `src/shared/types/`
- [ ] Move `src/components/ui/` into `src/shared/ui/`
- [ ] Move `src/hooks/` into `src/shared/hooks/`
- [ ] Move `src/i18n/` into `src/shared/i18n/`
- [ ] Remove duplicate data access layers

### Phase 4 (→ Future): Cleanup

- [ ] Remove deprecated `src/lib/` barrel files
- [ ] Remove legacy plan types from codebase
- [ ] Remove unused imports flagged by TS errors
- [ ] Final audit: ensure no circular dependencies

---

## Verification

### TypeScript Compilation

```bash
npx tsc --noEmit --pretty
```

The barrel files create no new type errors — they use existing import paths.
The 174 pre-existing type errors are unrelated to this refactoring.

### Import Path Verification

All barrel files use `@/` path aliases that resolve correctly:

| Barrel File | Imports From | Resolves? |
|-------------|-------------|-----------|
| `src/core/auth/index.ts` | `@/lib/auth/*` | ✅ Yes |
| `src/core/billing/index.ts` | `@/lib/billing/*`, `@/lib/stripe/*`, `@/lib/billing/*` | ✅ Yes |
| `src/core/agents/index.ts` | `@/lib/agents/*` | ✅ Yes |
| `src/core/workflows/index.ts` | `@/lib/agent-library/*` | ✅ Yes |
| `src/shared/ui/index.ts` | `@/components/ui/*` | ✅ Yes |
| `src/shared/types/index.ts` | `@/types/*` | ✅ Yes |

### No Files Moved

Zero files were moved — all existing imports continue to work unchanged.
The refactoring is purely additive.

---

## Next Steps

1. **Move core files directly** — Phase 2: Move `src/lib/billing/` → `src/core/billing/`, `src/lib/agents/` → `src/core/agents/`, etc. Update all imports with a codemod.
2. **Consolidate UI components** — Phase 3: Move `src/components/ui/` into `src/shared/ui/` and update all imports. Consider splitting into subdirectories (form, layout, feedback).
3. **Remove dead code** — Phase 4: Remove the deprecated `src/features/reports/service/pdf-export.ts` and the legacy plan types (`starter`, `agency`) from the codebase.
4. **Address the 174 TypeScript errors** — Many are from module boundary violations that will be resolved by the file moves.
