# W11-T3 — Public API + Documentation + Advanced Permissions

**Role:** Senior AI + Frontend Engineer
**Status:** ✅ Complete

## Overview

Exposed a versioned **public REST API** (`/api/v1/*`) authenticated with
workspace-scoped **API keys** (`af_pub_…`), documented via an interactive
**Scalar / OpenAPI** reference page, protected by **per-key rate limiting**,
and gated by an **RBAC → API-scope** bridge that improves team permissions.
Everything reuses the repo's existing patterns (`src/lib/api-response.ts`,
`src/lib/rate-limit.ts`, `@/lib/auth/rbac`, Supabase service-role client).

---

## Changes

### New database layer
- `supabase/migrations/20260716000000_create_api_keys.sql`
  - New table `api_keys` (workspace-scoped): `name`, `key_prefix`, `key_hash`
    (SHA-256, **raw secret never stored**), `scopes text[]`, `rate_limit`
    (req/min), `status` (`active`|`revoked`), `expires_at`, `last_used_at`,
    `created_by`.
  - Indexes on `workspace_id` + `key_hash`, `updated_at` trigger, RLS:
    members `SELECT`; **admins only** `INSERT`/`UPDATE`/`DELETE` via
    `is_workspace_member` / `is_workspace_admin` helpers.
- `src/types/database.ts`
  - Added `api_keys` table (Row/Insert/Update) + `ApiKeyRecord` and
    `ApiKeyScope` union type.

### API scopes + RBAC bridge
- `src/lib/auth/permissions.ts` (new)
  - `API_SCOPES`, `API_SCOPE_LABELS`, `isApiScope`, `hasApiScope`
    (write implies matching read), `requireApiScopes`.
  - **`scopesForRole(role)`** — maps a workspace RBAC role to the set of API
    scopes it may grant (owner/admin → all; editor → read/write agents+prompts
    + team/usage read; operator → read subset; viewer → read-only). This is the
    RBAC + Team Permissions improvement: team roles now govern API access.

### API key data layer
- `src/lib/data/api-keys.ts` (new)
  - `generateApiKey` (base64url secret + `af_pub_` prefix + SHA-256 hash),
    `hashApiKey`, `isValidApiKeyFormat`, `findApiKeyByRawKey` (admin lookup),
    `markApiKeyUsed`, `createApiKey`, `listApiKeys`, `revokeApiKey`,
    `getApiKeyById`.

### API authentication
- `src/lib/api/auth.ts` (new)
  - `authenticateApiKey(request)` — reads `Authorization: Bearer` or `x-api-key`,
    validates format, looks up + verifies hash, checks `status`/`expires_at`,
    enforces **per-key rate limiting** via `checkRateLimit({ key: apikey:<id>, … })`
    (reusing `src/lib/rate-limit.ts`), and stamps `last_used_at`.
  - `withApiAuth(requiredScopes, handler)` — wraps route handlers with key auth
    + **scope enforcement** (403 on missing scope), passing an `ApiAuthContext`.
  - `requireSessionAdmin(request)` — session-cookie guard (admin only) for the
    key-management endpoints.

### Public REST routes (`/api/v1/*`)
- `src/app/api/v1/agents/route.ts` — `GET` (agents:read), `POST` (agents:write).
- `src/app/api/v1/agents/[id]/route.ts` — `GET` (agents:read).
- `src/app/api/v1/prompts/route.ts` — `GET` (prompts:read), `POST` (prompts:write).
- `src/app/api/v1/prompts/[id]/route.ts` — `GET` (prompts:read).
- `src/app/api/v1/team/members/route.ts` — `GET` (team:read) — team permissions surface.
- `src/app/api/v1/usage/route.ts` — `GET` (usage:read) — agent/prompt/key counts.
- `src/app/api/v1/api-keys/route.ts` — `GET`/`POST` (session admin only; `POST`
  returns the **raw secret once**).
- `src/app/api/v1/api-keys/[id]/route.ts` — `DELETE` revoke (session admin only).

  All resource routes use the **service-role client** filtered by the key's
  `workspace_id`, so a key can only ever reach its own workspace's data.

### API documentation
- `src/app/api/openapi.json/route.ts` — serves an OpenAPI 3.1 spec (auth schemes,
  schemas, all v1 paths) with `no-store`.
- `src/app/api/docs/route.ts` — interactive **Scalar** reference UI (loads
  `@scalar/api-reference` from CDN, pointing at `/api/openapi.json`).

### Navigation & i18n
- `src/components/ui/Sidebar.tsx` — added **API Docs** in the Automation group
  (`nav.apiDocs`, `Code2` icon → `/api/docs`).
- `src/components/ui/CommandPalette.tsx` — "API Docs" quick-open entry.
- `src/i18n/locales/en.json` + `ar.json` — added `nav.apiDocs` (bilingual).

---

## Verification

- `npx tsc --noEmit` — **no new type errors** in any file added/changed by this task
  (confirmed via targeted grep on `src/lib/api/auth.ts`, `src/lib/data/api-keys.ts`,
  `src/lib/auth/permissions.ts`, `src/app/api/v1`, `src/app/api/openapi.json`,
  `src/app/api/docs`, `src/types/database.ts`, `Sidebar.tsx`, `CommandPalette.tsx`).
- `npx eslint` on the new routes + lib files — **0 errors, 0 warnings**.
- SQL migration follows the established pattern (`set_updated_at` trigger,
  `is_workspace_member` / `is_workspace_admin` RLS helpers, `on delete cascade`).
- Rate limiting reuses the existing `checkRateLimit` / `buildRateLimitExceededHeaders`
  contract; auth/response shapes reuse `src/lib/api-response.ts`.

> Note: A pre-existing, unrelated typecheck drift exists elsewhere in the repo
> (`src/lib/data/tasks.ts`, `content-studio.ts`, `usage/analytics.ts`, and some
> `tests/…`), not touched by this task. This feature's files compile and lint
> cleanly in isolation.

### How to apply the migration
```bash
supabase db push            # or: supabase migration up
```
Then open `/api/docs` for the interactive reference, or manage keys at any
authenticated admin session via `POST /api/v1/api-keys` (secret returned once).

### Example
```bash
# 1. Create a key (admin browser session) -> returns { secret: "af_pub_..." }
curl -X POST https://<host>/api/v1/api-keys \
  -H 'content-type: application/json' \
  -d '{"name":"ci","scopes":["agents:read","prompts:read"]}'

# 2. Use it
curl https://<host>/api/v1/agents \
  -H "Authorization: Bearer af_pub_xxxx"
```

---

## Status: ✅ Complete
