# AgentFlow AI — Agent Guide

## Commands
- `npm run dev` — starts dev via `scripts/next-node20.sh` (requires Node >=20.9)
- `npm run build` — production build (uses webpack; use `--turbopack` variant for local)
- `npm test` — vitest, runs **208+ tests** across `tests/` and `src/**/*.test.ts`
- `npm run lint` — ESLint (exit 0 even with errors — **gate is weak**)
- `npm run typecheck` — `tsc --noEmit` (must pass before build)
- `npm run security:audit` — regex-based secret scan

## Tests
- Vitest config at `vitest.config.ts`; aliases `@` → `src/`, `server-only` → `tests/mocks/server-only.ts`
- Test files in `tests/` (preferred) and `src/` adjacent to code
- Run single test: `npx vitest run tests/report-generator.test.ts`

## Architecture
- **Next.js 16** App Router (not Pages Router) — breaking changes possible. Check `node_modules/next/dist/docs/` before writing code.
- **Supabase** for auth, DB, storage. Server client: `src/lib/supabase-server.ts`. Client: `src/lib/supabase-client.ts`.
- **RBAC** — 3-tier protection: `src/middleware.ts` (edge) → `src/app/(dashboard)/layout.tsx` (server) → `requirePageAccess()` in pages.
- **PDF reports** — server-side via `generateServerPDF()` (puppeteer-core primary, pdf-lib fallback). Set `PUPPETEER_EXECUTABLE_PATH` for branded output.
- **Task lifecycle**: Create → Execute (via n8n) → Callback → Review → Complete. Queue: BullMQ + ioredis + Redis (local or Upstash).

## Key files & their roles
| File | Role |
|---|---|
| `scripts/next-node20.sh` | Ensures Node >=20.9 before running Next.js CLI |
| `src/lib/reports/generate-server-pdf.ts` | Dual-renderer PDF engine (puppeteer + pdf-lib) |
| `src/lib/auth/require-page-access.ts` | Shared RBAC evaluation for edge + server |
| `supabase/migrations/20260703000000_full_clean_schema.sql` | Consolidated schema (31 tables, RLS, triggers, seed data) |
| `docs/FINAL_LAUNCH_CHECKLIST.md` | Source of truth for production launch |

## Important conventions
- `server-only` boundary: use `import 'server-only'` in server code; vitest dev mock at `tests/mocks/server-only.ts`
- `console.*` discouraged — use `logger` from `src/lib/logger.ts` (structured, auto-redacts secrets)
- API route files go in `src/app/api/`; server actions in `src/actions/`
- All dashboard routes are behind `middleware.ts` + layout defense-in-depth
- The proxy at `src/proxy.ts` was merged into middleware (not present in current tree)

## Gotchas
- **Lint passes with errors** — `npm run lint` returns exit 0 even with 17+ errors. Always run `npm run typecheck` and `npm test` too.
- **Middleware file** — Next.js 16 uses `middleware.ts` at root, NOT under `src/`. Check root if it's missing.
- **PDF on serverless** — puppeteer-core requires a chromium binary at runtime. Without it, falls back to plain pdf-lib (text only, no CSS branding).
- **Billing API is unimplemented** — `/api/billing/*` directories exist but are empty.
- **Secrets in `.env.example`** — this file contains what appear to be real keys. Do NOT commit. Rotate and replace with placeholders before any push.

## Environment
- Copy `.env.example` → `.env.local`, fill real values
- Minimum: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- For PDF: `PUPPETEER_EXECUTABLE_PATH` (path to chromium)
- For tasks: `TASK_EXECUTION_ENABLED=true`, `N8N_WEBHOOK_URL`, `N8N_CALLBACK_SECRET`

## Global Skills
OpenCode skills at `~/.config/opencode/skills/`: `safe-code-change`, `uiux-polish`, `security-review`, `i18n-fix`, `deployment-check`, `database-migration-safe`, `debug-build-errors`, `documentation-release`. Auto-loaded by OpenCode based on request.

## Project identity
- `package.json` name is `agentflow-ai` (was `ai-agency-temp`)
- Production URL: https://agentflow-ai-sigma.vercel.app
- GitHub: https://github.com/youssefanbiri4-bit/AI-Agency
