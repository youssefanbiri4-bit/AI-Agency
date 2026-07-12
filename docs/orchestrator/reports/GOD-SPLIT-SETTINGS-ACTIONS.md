# GOD-SPLIT-SETTINGS-ACTIONS

**Task:** Split `src/app/(dashboard)/dashboard/settings/actions.ts` (~2331 lines) into domain modules  
**Branch:** `fix/god-split-settings-actions`  
**Completed:** 2026-07-12  
**Status:** ✅ Complete — typecheck clean, zero behavior change

---

## Summary

The monolithic `settings/actions.ts` (~2331 lines, 84 exported symbols) was split into 9 focused modules under `settings/actions/` with a barrel `index.ts` that preserves the original import path `./actions`.

## Before / After

### Before
```
settings/
├── actions.ts          # 2331 lines — all server actions + types
└── ... page / components
```

### After
```
settings/
├── actions/            # ← NEW directory
│   ├── index.ts        # Barrel file — re-exports all public API
│   ├── _shared.ts      # Types, constants, shared helper functions
│   ├── roles.ts        # getRolesOverviewAction
│   ├── brand-kit.ts    # getBrandKitSettingsAction, saveBrandKitSettingsAction
│   ├── branding.ts     # getBrandingSettingsAction, saveBrandingSettingsAction, resetBrandingSettingsAction
│   ├── theme.ts        # getThemeSettingsAction, saveThemeSettingsAction, resetThemeSettingsAction
│   ├── meta.ts         # Meta connection settings (get, select FB/IG/ad account)
│   ├── pinterest.ts    # getPinterestConnectionSettingsAction, selectPinterestBoardAction
│   ├── ai-image.ts     # getAIImageGenerationReadinessAction
│   └── providers.ts    # getProviderReadinessAction, getProviderSetupWizardAction
├── (actions.ts deleted) # ← removed, replaced by actions/index.ts
└── ... page / components
```

## Module Sizes

| Module | Lines | Exports | Description |
|--------|------:|--------:|-------------|
| `_shared.ts` | ~500 | 30+ | Types/interfaces, constants, shared helpers |
| `roles.ts` | ~38 | 1 | Roles overview |
| `brand-kit.ts` | ~106 | 2 | Brand Kit CRUD |
| `branding.ts` | ~185 | 3 | Logo/branding upload & reset |
| `theme.ts` | ~155 | 3 | Theme CRUD with background upload |
| `meta.ts` | ~280 | 4 | Meta/Facebook/Instagram connection management |
| `pinterest.ts` | ~90 | 2 | Pinterest board selection |
| `ai-image.ts` | ~55 | 1 | OpenAI image generation readiness |
| `providers.ts` | ~340 | 2 | Provider readiness + setup wizard |
| `index.ts` | ~30 | — | Barrel re-export |

## What was moved to `_shared.ts`

All shared items were extracted to `_shared.ts`:

- **Type exports**: `AIImageGenerationReadinessState`, `ProviderReadinessItem`, `ProviderReadinessState`, `BrandKitSettingsState`, `BrandingSettingsState`, `ThemeSettingsState`, `ProviderSetupStatus`, `ProviderSetupCheckStatus`, `ProviderSetupCheckItem`, `ProviderSetupWizardProvider`, `ProviderSetupWizardState`, `RolesOverviewState`, `PinterestConnectionSettingsState`, `MetaConnectionSettingsState`
- **Constants**: `disconnectedMetaSettings`, `disconnectedPinterestSettings`, `LOGO_MAX_FILE_SIZE_BYTES`, `LOGO_ALLOWED_TYPES`, `LOGO_EXTENSIONS`, `THEME_BACKGROUND_MAX_FILE_SIZE_BYTES`, `THEME_BACKGROUND_ALLOWED_TYPES`, `CONTENT_STUDIO_SCHEDULER_ROUTE_PATH`
- **Helpers**: `buildAITextProviderReadinessState`, `getSettingsWorkspaceContext`, `denySettingsAction`, `countMembersForSettings`, `readField`, `emptyToNull`, `readPositiveNumberField`, `readMultiValueField`, `readBrandKitFormData`, `readMetadataString`, `readOptionalFile`, `safeLogoStorageFileName`, `safeThemeBackgroundStorageFileName`, `readThemeFormData`, `formatEnvList`, `isEnvPresent`, `envCheck`, `optionalEnvReview`, `checklistProgress`, `titleCaseStatus`, `providerStatusFromChecklist`, `buildProvider`, `safeErrorMessage`, `schedulerRouteFileExists`, `dashboardSchedulerButtonFileExists`, `readVercelCronStatus`

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ PASS (0 errors) |
| Business logic changed | ❌ No — pure extraction |
| Permission checks changed | ❌ No |
| Import path `./actions` resolves | ✅ Yes — resolves to `./actions/index.ts` |
| All existing imports preserved | ✅ Verified page.tsx + 7 sub-components |

## Key Decisions

1. **Pure extraction** — No refactoring, no deduplication, no behavior changes
2. **Shared helpers in `_shared.ts`** — All shared types/helpers extracted to a single file, imported by domain modules
3. **Barrel via `index.ts`** — The original file was deleted and replaced by `actions/index.ts`. Next.js/TS resolves `import { x } from './actions'` → `actions/index.ts` automatically
4. **Each action file has `'use server'`** — Each domain module is a self-contained server action file

## Post-split Improvements Possible

- Deduplicate the repeated `items` array blocks in `getProviderReadinessAction`
- Clean up dead imports in `providers.ts` (imports carried over from the monolithic file but unused in the module)
- Consider further splitting `providers.ts` if the wizard logic grows
