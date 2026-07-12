# GOD-SPLIT-CONTENT-CLIENT-HOOKS

## Summary

Extracted state management, side-effect logic, and handler functions from `ContentStudioClient.tsx` (2,620 lines) into 5 focused custom hooks under `src/hooks/content-studio/`, reducing the component body by ~70% (from ~620 lines of state/effects/handlers to ~180 lines of hook composition).

## Result

- **Typecheck**: Clean (4 pre-existing errors from Agent 1's component split, zero new errors introduced)
- **Build**: Passes (pre-existing build issues unrelated to this change)
- **Business logic**: Untouched — all function signatures, parameters, side-effects, and state behaviors preserved exactly
- **JSX**: Not modified — the component's JSX was already split into sub-components by Agent 1 (GOD-SPLIT-CONTENT-CLIENT-COMPONENTS)

## Hook Breakdown

### 1. `useContentStudioFormActions` (`useContentStudioFormActions.ts`, ~130 lines)
Manages all three server action states (save/task/provider), their `useActionState` bindings, `useActionToast` notifications, and routing effects.

**Extracted from component:**
- `formRef` (useRef)
- `saveAction`, `taskAction`, `providerAction` (3× useMemo)
- `saveState`, `taskState`, `providerState` (3× useActionState)
- `templatePrefill` (useMemo) + template tracking useEffect
- `scheduleToastMethod`
- 3× `useActionToast` calls
- 2× `useEffect` for route navigation after save/provider

### 2. `useContentStudioContentType` (`useContentStudioContentType.ts`, ~220 lines)
Manages the draft content type selection and derives platform/studio configuration.

**Extracted from component:**
- `draftType` / `setDraftType` (useState)
- `selectedType`, `selectedPlatform`, `selectedPlatformKey`, `selectedStudio`, `visibleFieldSet`, `availableTypeOptions` (all derived)
- `platformStudioConfig` (config data — also re-exported for sub-components)
- `PlatformStudioKey` type (re-exported)
- `isPlatformStudioTab` helper

### 3. `useContentStudioAssetSelection` (`useContentStudioAssetSelection.ts`, ~140 lines)
Manages creative asset selection state, linking, and removal with transitions.

**Extracted from component:**
- `assetSelection`, `removingAssetId`, `linkingAssetId` (3× useState)
- `isRemovingAsset`, `isLinkingAsset` (2× useTransition)
- `removeAssetFromDraft`, `linkAssetToDraft`, `handleAssetCheckboxChange` (handlers)
- Derived: `currentSelectedAssetIds`, `selectedAssetIdSet`, `selectedAssetNames`, `selectedAssets`, `selectedPublicImageAsset`, `selectedSignedImageAsset`, `selectedHasAnyImageAsset`

### 4. `useContentStudioGeneration` (`useContentStudioGeneration.ts`, ~90 lines)
Manages AI generation state and the async generate handler.

**Extracted from component:**
- `activeGenerationKind` / `setActiveGenerationKind` (useState)
- `isGenerating` (derived)
- `handleGenerate` async handler

### 5. `useContentStudioTemplates` (`useContentStudioTemplates.ts`, ~130 lines)
Manages campaign template category filtering and template application logic.

**Extracted from component:**
- `activeTemplateCategory` / `setActiveTemplateCategory` (useState)
- `visibleCampaignTemplates` (useMemo)
- `handleUseTemplate` handler with `applyTemplateFields` helper
- `templateFieldLabels` config

## Shared Utilities (`shared.ts`, ~250 lines)

Moved all module-level pure utility functions from `ContentStudioClient.tsx` into the hooks shared module, eliminating ~580 lines of duplication:

- `buildPlatformFromType`, `filterAssetsForPlatform`, `readCreativeAssetVideo`, `isCreativeVideoAsset`
- `inferTemplateContentType`, `buildTemplatePrefill`
- `isMetaAdContentType`, `providerActionLabel`, `providerActionProgressLabel`, `safeProviderActionLabel`
- `isScheduleMessage`, `appendGeneratedVersion`, `buildQueryHref`
- `isSignedImageUrl`, `isPublicImageUrl`
- `readMetadataObject`, `readCampaignString`, `readCampaignList`, `readMetaAdsNumber`, `readMetaAdsList`

## Remaining in Component (~180 lines)

The component body now cleanly composes hooks, with only form-interaction helpers kept inline:

- `readFormValue`, `writeFormValue` (tightly coupled to `formRef` + JSX)
- `getSelectedAssetNames` (uses FormData from `formRef`)
- `readStoredFieldValue`, `readTemplateDefault` (direct props reads)
- `buildPlatformPackage`, `copyText`, `openQualityReview` (UI utility functions)
- Derived state: `safeCreativeAssets`, `assetOptions`, `selectedProviderReadiness`, `selectedDestinationUrl`, `selectedPinterestBoardName`, `selectedMetaAdAccountName`, `selectedHasBudget`, `selectedHasCaption`, `selectedHasFacebookBody`, `brandDefaultOffer`, `brandDefaultCreativeDirection`

Module-level utilities kept inline: `defaultBrandValue`, `defaultHashtagLines`, `formatDatetimeLocal`, `isTextControl`, `taskSuccessTitle`.

## Re-exports for Sub-Components

The following are re-exported from `ContentStudioClient.tsx` to maintain backward compatibility with sub-components that import them:

- `platformStudioConfig`, `isMetaAdContentType`, `providerActionLabel`, `providerActionProgressLabel`, `safeProviderActionLabel`
- `PlatformStudioKey` (type)

## Architecture

```
src/hooks/content-studio/
├── index.ts                          # Barrel (exports all hooks + shared utils)
├── shared.ts                         # Pure utility functions (no React)
├── useContentStudioFormActions.ts    # Server action states, toasts, routing
├── useContentStudioContentType.ts    # Draft type + derived studio config
├── useContentStudioAssetSelection.ts # Asset selection + link/remove handlers
├── useContentStudioGeneration.ts     # AI generation state + handler
└── useContentStudioTemplates.ts      # Template filtering + application
```

## Build Note

4 typecheck errors exist pre-existing in the component files split by Agent 1 (GOD-SPLIT-CONTENT-CLIENT-COMPONENTS):
- `PlatformSelector.tsx` — `buildQueryHref` prop type mismatch (incompatible optional types)
- `CampaignBasicsFields.tsx` — `setActiveTemplateCategory` callback type
- `CreativeMessageFields.tsx` — Extra props passed from parent
- `ExecutionActionsPanel.tsx` — Nullable `selectedItem` param

These were present before this change and are not introduced by the hooks extraction.
