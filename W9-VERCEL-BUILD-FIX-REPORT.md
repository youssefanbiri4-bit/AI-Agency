# W9-VERCEL-BUILD-FIX-REPORT

**Task ID:** W9-VERCEL-BUILD-FIX
**Title:** Fix Vercel Deployment Build (Tailwind + Module Not Found)
**Status:** ✅ Complete

## Root Cause

`@tailwindcss/postcss` and `tailwindcss` were declared in **`devDependencies`** only.
On Vercel, the build environment may set `NODE_ENV=production` during `npm install`,
causing npm to skip `devDependencies`. This produces:

```
Cannot find module '@tailwindcss/postcss'
```

When the PostCSS plugin is missing, Tailwind v4 cannot process the CSS pipeline. This
can cascade into secondary `Module not found` errors for `@/components/ui/Button`,
`@/components/ui/toast`, and `@/lib/utils` — files that depend on the build pipeline
or whose imports fail resolution in a misconfigured builder state.

## Changes Made

### `package.json`

Moved two build-required packages out of `devDependencies` into `dependencies`:

| Package | Before | After |
|---------|--------|-------|
| `@tailwindcss/postcss` | `devDependencies` | `dependencies` |
| `tailwindcss` | `devDependencies` | `dependencies` |

These packages are **required at build time** by `postcss.config.mjs` and
`tailwind.config.ts`. They are not dev-only tooling — they are active build
dependencies that must survive any `NODE_ENV=production` pruning on Vercel.

## Files modified

| File | Change |
|------|--------|
| `package.json` | Moved `@tailwindcss/postcss` and `tailwindcss` from `devDependencies` → `dependencies` |
| `package-lock.json` | Auto-updated by `npm install` after dependency reclassification |

No other files were modified.

## Configs verified (unchanged, already correct)

| Config | Verdict |
|--------|---------|
| `tsconfig.json` → `paths["@/*"] = ["./src/*"]` | ✅ correct |
| `next.config.ts` → no alias override | ✅ relies on tsconfig paths (Next.js auto-resolves) |
| `postcss.config.mjs` → `plugins["@tailwindcss/postcss"]` | ✅ correct ESM format |
| `tailwind.config.ts` → `content` globs cover `src/` | ✅ correct |

## Verification (local)

| Check | Result |
|-------|--------|
| `npm install` | ✅ 0 vulnerabilities |
| `npm run build` (clean — `.next` removed) | ✅ `BUILD_EXIT=0`, `✓ Compiled successfully (4.8min)` |
| Module-not-found scan in build log | ✅ zero matches |
| Tailwind/PostCSS errors in build log | ✅ zero matches |

## Why this fixes Vercel

Vercel runs `npm install` (or `npm ci`) to install dependencies before building.
Some Vercel project configurations / Node.js versions apply `NODE_ENV=production`,
which tells npm to skip `devDependencies`. By moving the build-critical PostCSS and
Tailwind packages to `dependencies`, they are installed **regardless** of the
environment variable state, ensuring the PostCSS plugin can load and the `@/` path
aliases resolve correctly.

## Status: ✅ Complete
