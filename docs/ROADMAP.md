# Roadmap

Date updated: 2026-05-05
Project: AgentFlow AI

## Current Baseline

Phase 6A is the stable production baseline. It includes working production URL, Supabase/Auth/workspace flows, 18 agents, task creation, n8n v5 production webhook execution, working callback payload handling, structured output rendering, Client-ready Report, Copy Report, and review transitions.

Phase 6B is a lock phase. Its goal is not to add features. Its goal is to preserve the stable working state, clean up git safely, and document the contracts that must not drift.

## Phase 6B: Stable Lock

Goals:

- Confirm repository root and git state.
- Classify changed, deleted, and untracked files.
- Document the current stable production behavior.
- Document n8n v5 contract, `callbackPayload`, and `structuredOutput`.
- Document frontend report behavior.
- Run lint and build.
- Do not deploy.
- Do not commit until approved.

Non-goals:

- No Supabase schema changes.
- No Auth changes.
- No Workspace changes.
- No Task creation changes.
- No status flow changes.
- No Approve or Request Changes changes.
- No n8n callback API changes.
- No environment variable changes.
- No n8n workflow changes.
- No Vercel setting changes.

## Next Phases

### Phase 7: Safe QA Expansion

Add confidence around existing behavior without changing the product flow.

- Add focused tests or checklists for task creation, execution, callback, report rendering, and review actions.
- Add manual production smoke-test documentation.
- Verify mobile and desktop task detail/report screens.
- Verify failure callback behavior.
- Keep current API and database contracts stable.

### Phase 8: Operations Hardening

Improve observability and supportability around the existing working system.

- Review server logs and remove temporary debug logging only after approval.
- Add lightweight operational runbooks for n8n callback failures and Supabase errors.
- Define incident checks for failed tasks, stuck `processing` tasks, and missing callback secrets.
- Document deployment verification without changing Vercel settings.

### Phase 9: Client Delivery Polish

Improve client-facing delivery while preserving the stable contract.

- Refine report copy and export formats.
- Add safe report download or share behavior if approved.
- Add review history visibility improvements.
- Keep `structuredOutput` backward compatible.

### Phase 10: Feature Expansion

Only after the lock is committed and verified, plan new features.

- Additional agent capabilities.
- More advanced task inputs.
- Saved report templates.
- Workspace team roles and permissions.
- Richer analytics and operational metrics.

## Commit Strategy Recommendation

Use separate commits after approval:

1. Stable application state: production app files, package files, Supabase migrations, scripts, and required assets.
2. Documentation: Phase 6A stable state, n8n v5 contract, and roadmap.
3. Safe cleanup: ignore-file additions or artifact removal, only after explicit approval.

This keeps the working production lock easy to inspect and rollback.

## Stable Contract References

- `docs/STABLE_STATE_PHASE_6A.md`
- `docs/N8N_V5_CONTRACT.md`

These documents are the reference before changing task execution, callback handling, report rendering, or review status transitions.
