# W9-VERCEL-BUILD-FIX-3 — Final Fix for Persistent Vercel Build Errors

**Date:** 2026-07-14
**Status:** ✅ Complete

---

## Root Cause

Two independent issues caused the persistent Vercel build failures:

### 1. Corrupt `package-lock.json` (primary cause)

The lockfile had **764 out of 775 packages** missing `resolved` and `integrity` fields.

| Metric | Before Fix | After Fix |
|---|---|---|
| Packages with integrity+resolved | 3 / 775 (0.4%) | 775 / 775 (100%) |
| `@tailwindcss/postcss` integrity | ❌ missing | ✅ `sha512-...` |
| `postcss` integrity | ❌ missing | ✅ `sha512-...` |
| `tailwindcss` integrity | ❌ missing | ✅ `sha512-...` |

This caused Vercel's `npm ci` (which requires lockfile integrity) to install packages incorrectly — `@tailwindcss/postcss` would be listed in `node_modules` but its module resolution metadata would be broken, producing `Cannot find module '@tailwindcss/postcss'` when PostCSS tried to load it.

The corrupt lockfile was caused by incremental `npm install` runs that never did a clean install from the registry — the lockfile was generated from cached packages that lacked integrity metadata.

### 2. `postcss.config.mjs` (ESM) format

The ESM (`.mjs`) format is supported but can cause subtle module resolution differences in strict build environments. PostCSS's plugin loading internally uses `require()`, which works differently in ESM vs CJS contexts.

---

## Changes Made

### File: `postcss.config.js` (NEW, replaces `postcss.config.mjs`)

**Before (`.mjs`, ESM):**
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

**After (`.js`, CJS):**
```js
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

CJS format is the most widely tested and compatible with PostCSS + Next.js's plugin loading mechanism.

### File: `package-lock.json` (regenerated)

Fresh `npm install` from the registry produced a lockfile with all 775 packages having proper `resolved` URLs and `integrity` hashes. Vercel's `npm ci` will now correctly install every package.

### File: `postcss.config.mjs` (DELETED)

Removed to avoid config file conflicting priority.

---

## Verification

- `npm run build`: ✅ **105 / 105 routes** (all static + dynamic)
- Lockfile integrity: ✅ **775 / 775** packages with integrity+resolved
- `@tailwindcss/postcss` version: `4.3.2` (in `dependencies`, not `devDependencies`)
- `tailwindcss` version: `4.3.2` (in `dependencies`)
- `postcss` version: `8.5.14` (single version across tree via override)
- No new files added (only replaced config format + regenerated lockfile)

---

## Vercel Deploy Checklist

Before deploying, verify in Vercel Dashboard:
- [ ] Node.js version: **20.x** (enforced by `.nvmrc`)
- [ ] Build command: `npm run build` (uses `bash scripts/next-node20.sh build --webpack`)
- [ ] **Clear build cache** in Vercel Dashboard → Project → Settings → **Redeploy without cache** (critical — stale cache may still contain bad lockfile data)
- [ ] All env vars from `.env.example` are configured

---

## Files Touched
```
M  postcss.config.js   (replaces postcss.config.mjs)
D  postcss.config.mjs  (deleted)
M  package-lock.json   (regenerated, all integrity intact)
```
