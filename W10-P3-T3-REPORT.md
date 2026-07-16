# W10-P3-T3 — AI Agent Builder + Templates Marketplace Foundation

**Role:** Senior AI + Frontend Engineer
**Status:** ✅ Complete

## Overview

Built a no-code **AI Agent Builder**, a **Templates Gallery + Marketplace**, plus
**Save as Template** / **Share Template** flows, with a two-way link to the existing
**Prompt Library**. Everything follows the repo's established patterns (Server
Components + Server Actions + Supabase, Tailwind v4, RTL/i18n, RBAC).

---

## Changes

### New database layer
- `supabase/migrations/20260715000000_create_agent_builder_agents.sql`
  - New table `agent_builder_agents` (workspace-scoped) with: name, role,
    description, category, icon, accent_color, instructions (system prompt),
    inputs/outputs/review_checklist arrays, tags, `prompt_library_id` FK
    (link to Prompt Library), `is_template`, `visibility` (`workspace` |
    `marketplace`), unique `share_slug`, usage counters, `metadata` jsonb.
  - CHECK constraints on `safety_level` / `execution_mode` / `visibility`.
  - Indexes (workspace, category, marketplace partial, share_slug) + `updated_at` trigger.
  - RLS: workspace members CRUD; **any authenticated user can `SELECT` rows where
    `visibility = 'marketplace'`** (this is the Marketplace surface, cross-workspace).
- `src/types/database.ts`
  - Added `agent_builder_agents` table (Row/Insert/Update) + types
    `AgentBuilderSafetyLevel`, `AgentBuilderExecutionMode`, `AgentBuilderVisibility`,
    and `AgentBuilderAgentRecord`.

### New data access layer
- `src/lib/data/agent-builder.ts`
  - `listAgentBuilderAgents`, `listMarketplaceAgents`, `getAgentBuilderAgent`,
    `getAgentBuilderAgentBySlug`, `createAgentBuilderAgent`, `updateAgentBuilderAgent`,
    `deleteAgentBuilderAgent`, `publishAgentBuilderAgent` (sets `is_template` +
    `share_slug`), `markAgentBuilderUsed`, `cloneMarketplaceAgent`,
    `saveAgentToPromptLibrary` (creates a Prompt Library entry), `generateUniqueShareSlug`.

### New server actions (`'use server'`)
- `src/app/(dashboard)/dashboard/agent-builder/actions.ts`
  - `createAgentAction`, `updateAgentAction`, `deleteAgentAction` (owner/admin),
    `publishTemplateAction` (Save as Template / Publish to Marketplace),
    `saveAgentToPromptLibraryAction` (link → Prompt Library),
    `createAgentFromTemplateAction` (use a built-in template),
    `cloneSharedAgentAction` (clone a shared Marketplace template into the workspace).
  - Mirrors prompt-library auth/RBAC: `editor` to create/edit/publish, owner/admin to delete.

### New UI
- `src/app/(dashboard)/dashboard/agent-builder/page.tsx` — server page (loads agents + prompts).
- `src/app/(dashboard)/dashboard/agent-builder/AgentBuilderClient.tsx` — orchestrates builder.
- `src/app/(dashboard)/dashboard/agent-builder/AgentBuilderForm.tsx` — no-code form (controlled:
  name, role, category, icon, accent color, instructions, inputs/outputs, safety, execution,
  review checklist, tags, **Linked prompt** select).
- `src/app/(dashboard)/dashboard/agent-builder/AgentPreview.tsx` — live preview card.
- `src/app/(dashboard)/dashboard/agent-builder/AgentCard.tsx` — saved-agent card with
  Edit / Publish–Unpublish / **Share Template** (copies share link) / **Save to Prompt Library** /
  Copy Instructions / Delete.
- `src/app/(dashboard)/dashboard/agent-builder/gallery/page.tsx` + `GalleryClient.tsx` —
  **Templates Gallery + Marketplace** with 3 tabs: Marketplace (published, cross-workspace),
  Built-in (Agent Library templates), My Workspace.
- `src/app/(dashboard)/dashboard/agent-builder/shared/[slug]/page.tsx` + `SharedTemplateView.tsx`
  — read-only **shared template** view (copy instructions / clone to workspace / open in builder).

### Navigation & i18n
- `src/components/ui/Sidebar.tsx` — added **Agent Builder** + **Templates Marketplace** (AI Agents group).
- `src/components/ui/Topbar.tsx` — page titles for builder / gallery / shared.
- `src/components/ui/CommandPalette.tsx` — quick-open entries.
- `src/i18n/locales/en.json` + `ar.json` — `dashboardI18n.agentBuilder`, `dashboardI18n.marketplace`,
  `nav.agentBuilder`, `nav.templatesMarketplace`, and `topbar.pageTitles` keys (bilingual).

### Link with Prompt Library (existing feature)
1. **Load from Prompt Library** → select a saved prompt to populate the agent's instructions and store `prompt_library_id`.
2. **Save to Prompt Library** → exports the agent's instructions as a new Prompt Library entry (category `agents`).

---

## Verification

- `npx tsc --noEmit` — no type errors in any `agent-builder` / `agent_builder` files.
- `npx eslint` on the new route + data file — **0 errors, 0 warnings**.
- SQL migration follows the exact pattern of `20260510180000_create_prompt_library.sql`
  (same trigger `set_updated_at`, `is_workspace_member` / `is_workspace_admin` RLS helpers).
- UI mirrors the existing Agent Library / Prompt Library styling, RTL, and i18n conventions.

> Note: A pre-existing, unrelated typecheck drift exists elsewhere in the repo
> (`src/lib/data/tasks.ts`, `content-studio.ts`, `usage/analytics.ts`, `tests/…`), not touched
> by this task. This feature's files compile and lint cleanly in isolation.

### How to apply the migration
```bash
supabase db push            # or: supabase migration up
```
Then visit `/dashboard/agent-builder` (builder) and `/dashboard/agent-builder/gallery` (marketplace).

---

## Status: ✅ Complete
