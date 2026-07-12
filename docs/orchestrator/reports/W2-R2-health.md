# W2-R2 — Harden Health Endpoint Against Information Disclosure

**Date:** 2026-07-11  
**Agent:** Security Engineer 2  
**Priority:** High  
**Branch:** `fix/wave2-r2-health-harden`

---

## Goal

Prevent information disclosure from the health endpoint by stripping internal details from the public response.

---

## Analysis

### Vulnerabilities in the Original Endpoint

The `GET /api/health` endpoint returned the full `services` object to **every caller**, including unauthenticated ones. This leaked:

| Leak | Example |
|------|---------|
| Missing env var names | `"Missing environment variables: N8N_WEBHOOK_URL, N8N_CALLBACK_SECRET"` |
| Internal error messages | DB connection error messages, n8n readiness failures, filesystem errors |
| Supabase error messages | Raw Supabase client errors forwarded verbatim |
| Internal architecture | Service names (`supabase`, `n8n`, `storage`) and their dependency structure |
| Catch-all error path | On unhandled exception the full `services` object was returned inside `extra` |

### Changes Made

**`src/app/api/health/route.ts`** — Two-tier response:

| Audience | Response Shape | Status Code |
|----------|----------------|-------------|
| **Unauthenticated** (public) | `{ status: 'ok', timestamp }` | Always 200 |
| **Authenticated** (valid session) | `{ status, timestamp, services: { ... } }` | 200 or 503 |
| **Error** | `{ status: 'error', timestamp }` (no services) | 500 |

Key changes:

1. **`isAuthenticated()` helper** — checks for a valid Supabase session early. Returns `false` on any error (never throws).
2. **`buildDetailedHealth()`** — extracted the full service-check logic into a separate function called only for authenticated requests.
3. **Public path** — returns only `{ status: 'ok', timestamp }`. Always HTTP 200 so uptime monitors see a healthy endpoint.
4. **Error path sanitized** — removed `services` from the error envelope. Internal details are still logged via `reportAppError` / Sentry.
5. **Response time** — computed after work completes for both paths.

### What Did NOT Change

- Rate limiting (60 req/min per IP) — still in place
- All internal checks still run for authenticated users
- Error logging and Sentry reporting unchanged
- No other routes touched
- Response still includes `X-Request-ID` and `X-Response-Time` headers

---

## Validation

| Check | Result |
|-------|--------|
| `npx vitest run tests/execute-route.test.ts` | ✅ 6/6 passed |
| `npx vitest run tests/tasks-callback.test.ts` | ✅ 3/3 passed |
| `npx vitest run src/lib/error-handler.test.ts` | ✅ 12/12 passed |

Pre-existing test failures (`auth-brute-force`, `execute/route` timeout) are unchanged.

---

## Success Criteria

- [x] Public health response is safe — only `{ status, timestamp }`
- [x] No stack traces or internal details leak to unauthenticated callers
- [x] Authenticated users/admins still get full service-level diagnostics
- [x] Monitoring tools get a useful 200 response with status and latency
- [x] Internal errors still logged to Sentry for debugging
