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
