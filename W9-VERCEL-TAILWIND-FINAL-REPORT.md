# W9-VERCEL-TAILWIND-FINAL — Force @tailwindcss/postcss on Vercel

**Date:** 2026-07-14
**Status:** ✅ Complete

---

## Changes Made

### `package.json`

| Change | Value |
|--------|-------|
| Added `postinstall` script | `"npm install @tailwindcss/postcss tailwindcss postcss"` |
| Added `postcss` to `dependencies` | `"^8.5.14"` |
| Removed `overrides.postcss` | No longer needed (direct dep replaces override) |

### `postcss.config.js`
CJS format — `module.exports` with `@tailwindcss/postcss` string plugin name. No `.mjs` file exists.

### `tsconfig.json`
Already correct: `baseUrl: "."`, `paths: { "@/*": ["./src/*"] }`.

---

## Why `postinstall` Fixes Vercel

Vercel runs `npm install` then `next build`. Sometimes `@tailwindcss/postcss` resolves into a nested `node_modules` instead of the top-level one. PostCSS's `require("@tailwindcss/postcss")` only searches up from the config directory — it won't find nested copies.

The `postinstall` script forces a second `npm install` of the exact packages PostCSS needs. This guarantees they exist at the top level of `node_modules` where `require("@tailwindcss/postcss")` will find them.

---

## Verification

### Commands Run
```bash
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

### Results
| Check | Result |
|-------|--------|
| `npm install` | ✅ 642 packages, 0 vulnerabilities |
| Lockfile integrity | ✅ **776/776** packages with `resolved` + `integrity` |
| `@tailwindcss/postcss` in `node_modules` | ✅ `4.3.2` |
| `tailwindcss` in `node_modules` | ✅ `4.3.2` |
| `postcss` in `node_modules` | ✅ `8.5.19` |
| `npm run build` | ✅ **105/105** static + dynamic routes |
| `postcss.config.js` | ✅ CJS, string plugin name |
| `tsconfig.json` | ✅ `baseUrl` + `paths` correct |
| `@tailwindcss/postcss` in `dependencies` | ✅ (not devDependencies) |
| `tailwindcss` in `dependencies` | ✅ (not devDependencies) |
| `postcss` in `dependencies` | ✅ (not devDependencies) |
| `postinstall` script | ✅ forces reinstall of all 3 packages |

---

## Files Modified
```
M  package.json         (postinstall script + postcss dep + removed override)
M  package-lock.json    (regenerated)
```

---

## If Build Breaks on Vercel Again

1. Clear Vercel build cache: Dashboard → Project → ... → **Redeploy without cache**
2. Verify env vars from `.env.example` are set
3. Check Vercel Node.js version is 20.x (`.nvmrc`)
