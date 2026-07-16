<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:global-skills -->
# Global Skills

This project uses the global OpenCode skills system at `~/.config/opencode/skills/`.

Available skills:
- `safe-code-change` — minimal, verified edits
- `uiux-polish` — visual/layout/accessibility improvements
- `security-review` — security/privacy audit and fixes
- `i18n-fix` — translations, RTL/LTR, multilingual UX
- `deployment-check` — pre-deployment verification
- `database-migration-safe` — safe schema migrations
- `debug-build-errors` — diagnose and fix build/type/runtime errors
- `documentation-release` — README, guides, release notes

OpenCode automatically loads matching skills based on your request. You can also request a skill by name: "Use the security-review skill."
<!-- END:global-skills -->

<!-- BEGIN:tailwind-build-guard -->
# ⚠️ CRITICAL: Tailwind CSS Build Guard (DO NOT CHANGE)

These rules are enforced for **permanent Vercel compatibility**. Breaking them will cause `Cannot find module '@tailwindcss/postcss'` and `Module not found: @/` errors on Vercel.

## Rules

1. **`@tailwindcss/postcss` MUST remain in `dependencies`** (never `devDependencies`). Vercel's `npm ci` installs both, but `--production` mode only installs `dependencies`. Keep it here.

2. **`tailwindcss` MUST remain in `dependencies`** for the same reason.

3. **`postcss.config.js` MUST be CJS format** (`module.exports`), NOT `.mjs`. PostCSS internally loads plugins via `require()`, and CJS eliminates ESM resolution differences.

4. **No `postcss.config.mjs` file** — only `postcss.config.js` should exist. If a tool regenerates `.mjs`, delete it immediately.

5. **`tsconfig.json` MUST have `baseUrl: "."` and `paths: { "@/*": ["./src/*"] }`** — Next.js webpack/Turbopack resolve `@/` from tsconfig paths.

6. **`postcss` override in `package.json`** (`"overrides": { "postcss": "8.5.14" }`) is intentional — prevents multiple postcss versions.

## Quick Fix If Build Breaks Again

```bash
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

Then on Vercel: **Redeploy without cache** (Dashboard → Project → ... → Redeploy without cache).
<!-- END:tailwind-build-guard -->
