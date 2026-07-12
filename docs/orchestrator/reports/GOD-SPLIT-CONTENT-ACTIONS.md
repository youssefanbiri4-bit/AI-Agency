# GOD-SPLIT-CONTENT-ACTIONS

## Summary

Split the 2,477-line `src/app/(dashboard)/dashboard/content-studio/actions.ts` "god file" into 6 focused domain modules under an `actions/` directory, preserving all exports via a barrel `index.ts`.

## Result

- **Typecheck**: Clean (no new errors)
- **Build**: Passes (`next build` succeeds)
- **Business logic**: Untouched — all function signatures, parameters, and return types preserved exactly
- **`ContentStudioClient.tsx`**: Not modified (forbidden)

## Module Breakdown

| Module | Lines | Functions |
|--------|-------|-----------|
| `shared.ts` | 221 | Types, initial states, utility functions, `getWorkspaceContext`, `createContentStudioNotification` |
| `content-crud.ts` | 539 | `createContentStudioItemAction`, `updateContentStudioItemAction`, `removeCreativeAssetFromDraftAction`, `linkCreativeAssetToDraftAction` + internal: `persistItem`, `buildItemMetadata`, `resolveProviderState` |
| `publishing.ts` | 603 | `executeContentStudioProviderActionAction` + internal: `loadLinkedAssets`, `getProviderActionType`, `getProviderName`, `isPublishedContentType`, `readItemCampaign*`, `readItemMetaAds*` |
| `content-generation.ts` | 290 | `generateContentStudioFieldAction` + internal: `generationFieldFromKind`, `generationMessageFromKind`, `checkGenerationLimit` |
| `scheduler-actions.ts` | 230 | `createContentStudioTaskAction` + internal: `getTaskAgentPreferences`, `getTaskAgentId`, `buildTaskTitle`, `buildTaskDescription` |
| `campaign-planner.ts` | 694 | `generateCampaignPlanAction`, `createCampaignPlanDraftsAction` + internal: all planner helpers (`readCampaignPlannerInput`, `buildPlannerUserPrompt`, `parsePlannerJson`, `buildDraftsFromPlan`, etc.) |
| `index.ts` | 24 | Barrel re-export of all public functions and types |
| **Total** | **2,601** | — |

All modules are under 700 lines.

## Architecture

- `shared.ts` has **no** `'use server'` directive — it's a pure utility/types module
- Each domain module (`content-crud.ts`, `publishing.ts`, etc.) has `'use server'` at the top
- `index.ts` has **no** `'use server'` — it's a pure re-export barrel (Next.js requires only async functions in `'use server'` files)
- All modules import shared utilities from `./shared`
- The `../shared` import from the parent directory (`content-studio/shared.ts`) is preserved for constants like `contentStudioStatusOptions`, `inferPlatformFromContentType`, etc.

## Import Compatibility

All existing `./actions` imports from `ContentStudioClient.tsx` and `CampaignPlanner.tsx` resolve correctly through the barrel `index.ts`. No consumer changes needed.

## Build Note

Two pre-existing typecheck errors exist in `settings/actions/` (unrelated to this split):
- `providers.ts(39,3): error TS2459: Module '"./_shared"' declares 'CONTENT_STUDIO_SCHEDULER_ROUTE_PATH' locally, but it is not exported.`
- `theme.ts(37,26): error TS2304: Cannot find name 'createSupabaseServerClient'.`

These were present before this change and are not introduced by the split.
