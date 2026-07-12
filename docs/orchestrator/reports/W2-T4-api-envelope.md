# W2-T4 — Standard API Error Envelope & Request ID Propagation

**Date:** 2026-07-11  
**Agent:** Backend Engineer 1  
**Wave:** 2  
**Branch:** `fix/wave2-t4-api-envelope`

---

## Goal

Make all critical API routes return a consistent error format with `{ success: false, error, requestId, timestamp }` and ensure request IDs are present on every response.

---

## Analysis

### Existing Infrastructure

The codebase already had useful helpers in `src/lib/api-response.ts`:
- `getRequestId(req)` — generates or propagates `X-Request-ID`
- `createApiSuccess(data, options)` — standard success envelope
- `createApiError(error, options)` — standard error envelope
- `createOperationalSuccess` / `createOperationalError` — convenience wrappers

However, several routes bypassed these helpers:

| Route | Error Shape | Request ID |
|-------|-------------|------------|
| `auth/login` | `{ error }` or `{ success: true }` | ❌ Missing |
| `auth/signup` | `{ error }` or `{ success: true, requiresEmailConfirmation }` | ❌ Missing |
| `auth/refresh` | `{ error }` or `{ success: true }` | ❌ Missing |
| `auth/logout` | `{ error }` or `{ success: true, scope }` | ❌ Missing |
| `tasks/execute` | via `createErrorResponse` → `{ error, requestId, timestamp }` | ✅ Present |
| `tasks/fail-stale` | `{ success: false, error, requestId, timestamp }` (local `jsonError`) | ✅ Present |
| `n8n/callback` | Mix: local `jsonError` + inline `NextResponse.json` | ✅ Present |
| `health` | via `createApiError` / `createApiSuccess` | ✅ Present |
| `api-handler` (rate limit) | inline `{ error, retryAfter }` | ❌ Missing |

Additionally, `createErrorResponse` in `src/lib/error-handler.ts` was missing `success: false` from its output, making it inconsistent with the `api-response.ts` envelope.

---

## Changes Made

### 1. `src/lib/error-handler.ts` — Add `success: false` to error envelope

- Added `success: false` and `message` fields to the JSON body returned by `createErrorResponse`
- Now returns: `{ success: false, error, message, requestId, timestamp }`
- All downstream callers (e.g., `api-handler.ts`, `tasks/execute`) automatically benefit

### 2. `src/lib/api-handler.ts` — Standardize rate limit error response

- Replaced inline `new Response(JSON.stringify({ error, retryAfter }))` with `createApiError()`
- Rate limit errors now return the standard envelope with `success: false`, `requestId`, and rate-limit headers
- Added import of `createApiError` from `api-response`

### 3. Auth Routes — Full conversion

**`src/app/api/auth/login/route.ts`**
- Added `getRequestId(request)` to extract/generate `X-Request-ID`
- Replaced `new Response(JSON.stringify({ error }))` → `createApiError()`
- Replaced `Response.json({ success: true })` → `createApiSuccess(null, { requestId })`
- Added `meta: { retryAfter }` to rate limit errors

**`src/app/api/auth/signup/route.ts`**
- Same pattern as login; preserves `requiresEmailConfirmation` via `extra` field

**`src/app/api/auth/refresh/route.ts`**
- Added `request: Request` parameter to access headers
- Same conversion pattern as login

**`src/app/api/auth/logout/route.ts`**
- Same conversion pattern; preserves `scope` via `extra` field

### 4. `src/app/api/n8n/callback/route.ts` — Standardize error responses

- Replaced local `jsonError` function body: now calls `createApiError()` instead of constructing `NextResponse.json` inline
- Replaced two inline `NextResponse.json` error responses (rate limit, missing secret) with `createApiError()`
- Removed unused `nowISO` import

### 5. `src/app/api/tasks/fail-stale/route.ts` — Use shared helper

- Replaced local `jsonError` function body: now calls `createApiError()` instead of inline `NextResponse.json`

---

## Files Modified

| File | Change Type |
|------|-------------|
| `src/lib/error-handler.ts` | Added `success: false` to error envelope |
| `src/lib/api-handler.ts` | Standardized rate-limit error response |
| `src/app/api/auth/login/route.ts` | Added request ID + envelope |
| `src/app/api/auth/signup/route.ts` | Added request ID + envelope |
| `src/app/api/auth/refresh/route.ts` | Added request ID + envelope |
| `src/app/api/auth/logout/route.ts` | Added request ID + envelope |
| `src/app/api/n8n/callback/route.ts` | Use `createApiError` for errors |
| `src/app/api/tasks/fail-stale/route.ts` | Use `createApiError` for errors |

---

## Validation

| Check | Result |
|-------|--------|
| `npx vitest run tests/execute-route.test.ts` | ✅ 6/6 passed |
| `npx vitest run tests/tasks-callback.test.ts` | ✅ 3/3 passed |
| `npx vitest run src/lib/error-handler.test.ts` | ✅ 12/12 passed |

Pre-existing failures (`auth-brute-force.test.ts`, `execute/route.test.ts` timeout) are unchanged.

---

## Success Criteria

- [x] Consistent error shape `{ success: false, error, message, requestId, timestamp }` on all key routes
- [x] Request IDs present on every error and success response
- [x] No behavior change for success cases (existing response shapes preserved via `extra`)
- [x] Tests still pass (pre-existing failures unchanged)
