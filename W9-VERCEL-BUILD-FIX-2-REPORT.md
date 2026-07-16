# W9-VERCEL-BUILD-FIX-2 — Report

**Status:** ✅ Complete  
**Date:** 2026-07-14  
**Engineer:** Senior Frontend Engineer

---

## Summary

Vercel build was failing with:
1. `Cannot find module '@tailwindcss/postcss'`
2. `Module not found: '@/components/ui/Button'`
3. `Module not found: '@/components/ui/toast'`
4. `Module not found: '@/lib/utils'`
5. Build hanging on Redis (BullMQ) connection during static generation

Root causes and fixes applied.

---

## Changes

### 1. `tsconfig.json` — explicit path resolution
- Added `"baseUrl": "."` so `@/*` path aliases resolve unambiguously
- Added `"typeRoots": ["./node_modules/@types"]`

### 2. `.nvmrc` — Node.js version enforcement
- Created `.nvmrc` with `20` so Vercel uses Node 20+

### 3. `src/lib/queue/queues.ts` — lazy Redis initialization
- **Root cause**: BullMQ `Queue` constructor calls `new Redis()` at module import time. During Vercel build (no Redis available), this caused `ECONNREFUSED` errors and hung the build indefinitely.
- **Fix**: Replaced eager `export const taskQueue = new Queue(...)` with lazy `export function getTaskQueue(): Queue` / `export function getDlqQueue(): Queue`
- Updated all consumers (`route.ts`, `maybe-dlq.ts`) and tests to use getter functions

### 4. Consumers updated
- `src/app/api/tasks/execute/route.ts` — `taskQueue` → `getTaskQueue()`
- `src/lib/queue/workers/maybe-dlq.ts` — `dlqQueue` → `getDlqQueue()`
- `tests/execute-route.test.ts` — mock updated to `getTaskQueue`
- `tests/queue/dlq.test.ts` — mock updated to `getDlqQueue`
- `src/lib/queue/workers/maybe-dlq.test.ts` — mock updated to `getDlqQueue`

### 5. Already verified (no change needed)
- `@tailwindcss/postcss` ✅ in `dependencies` (already done)
- `tailwindcss` ✅ in `dependencies`
- `postcss.config.mjs` ✅ correct
- `tailwind.config.ts` ✅ content globs correct
- `tsconfig.json` paths ✅ `@/*` → `./src/*`
- All exports from `@/components/ui/Button`, `@/components/ui/toast`, `@/lib/utils` ✅ exist

---

## Verification

### Local Build
```
✓ Compiled successfully in 2.6min
✓ Finished TypeScript in 101s
✓ Generating static pages (105/105) in 3.1s
✓ Finalizing page optimization
```
**No Redis errors during build** (lazy init works)

### Tests
```
Test Files  36 passed (36)
Tests       286 passed (286)
```

### Vercel Readiness
- `.nvmrc` ensures Node 20
- No eager Redis connections at build time
- All module imports verified
- Package lockfile up to date

---

## Status: ✅ Complete
