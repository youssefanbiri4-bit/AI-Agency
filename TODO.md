# AgentFlow AI - TODO

## ✅ Completed
- [x] Create Zod validator module for n8n structuredOutput payload (`src/lib/n8n-structured-output-validation.ts`)
- [x] Integrate validator into /api/n8n/callback route
- [x] On validation failure: log with task id, workspace id, validation error details, timestamp; store debugging payload under internal keys in tasks.result
- [x] Add operational metrics for validation failures/malformed frequency
- [x] Add tests for n8n callback idempotency
- [x] Fix task-worker.ts to actually execute tasks with executeTask + DLQ support
- [x] Remove code duplication between n8n.ts and n8n.worker.ts
- [x] Fix `reportAppError` used for successful operations (use logger.info instead)
- [x] Extract shared `isJsonObject` utility to src/lib/utils.ts
- [x] Replace console.* logs with structured logger in cache.ts and supabase-server.ts
- [x] Fix package.json scripts referencing removed pa11y package
- [x] Improve operational layout forbidden UI styling

## Future
- [ ] Add E2E tests with Playwright
- [ ] Add workspace_id field to Task type for type safety
- [ ] Split ContentStudioClient (2,734 lines) into sub-components
- [ ] Replace remaining console.* with logger in data layer files (tasks.ts, workspaces.ts, projects.ts, etc.)
- [ ] Create shared callback handler to deduplicate /api/n8n/callback and /api/tasks/callback
