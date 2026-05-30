# Observability Hardening TODO (Incremental / Production-Safe)

## Step 1: Standardize IDs & Context
- [ ] Add traceId/correlationId/requestId typed injection helpers
- [ ] Ensure inbound requests reuse `X-Request-ID` when present; otherwise generate once
- [ ] Stop per-route `Math.random` requestId generation where feasible

## Step 2: Logger / Error Logging Improvements
- [ ] Ensure `logger.child()` and `reportAppError/reportAppEvent` can include traceId/requestId/correlationId consistently
- [ ] Add stricter structured shape for error/event context (no sensitive data)

## Step 3: Error Tracking Bridging (Sentry + Logger)
- [ ] Extend `ErrorContext` with `traceId`, `correlationId`
- [ ] Populate Sentry tags/contexts with IDs for correlation

## Step 4: API Handler Context Injection
- [ ] Update `src/lib/api-handler.ts`:
  - [ ] reuse `X-Request-ID` if present
  - [ ] add `{ requestId, traceId, correlationId, endpoint, method }` to logs/errors
  - [ ] propagate IDs to `createErrorResponse`

## Step 5: Replace Console Logging in Route Boundary
- [ ] Update `src/lib/error-boundaries/route-error-boundary.tsx`:
  - [ ] replace `console.error` with structured `reportAppError` / `logger.error`
  - [ ] include componentStack safely

## Step 6: Async Diagnostics (Follow-up after core ID wiring)
- [ ] Review `src/lib/network/safeFetch.ts` and retry/timeout utilities
- [ ] Ensure async events/errors include traceId/requestId

## Step 7: Verification
- [ ] Run unit tests
- [ ] Smoke test key failure scenarios (API / scheduler / provider / supabase / auth)
