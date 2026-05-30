**Executive Summary**
- **Scope:** Complete code audit focused on task execution, queueing, workers, n8n integration, idempotency, RLS, SSRF, observability, reliability, and disaster readiness.
- **High-level conclusion:** The codebase implements a deliberate, production-focused task execution path using BullMQ + Redis, strong SSRF protections for n8n webhooks, and a dedicated callback idempotency table. Key gaps remain around where tasks transition to `processing` (race surface), persistence/uniqueness of `taskExecutionId`, and explicit dead-letter / DLQ handling for unrecoverable jobs.

**Architecture Overview**
- **Task execution path:** API enqueues jobs to BullMQ `task-queue` (see [src/app/api/tasks/execute/route.ts](src/app/api/tasks/execute/route.ts#L100-L120)) which are processed by a single worker implementation in [src/lib/queue/workers/task-worker.ts](src/lib/queue/workers/task-worker.ts#L130-L160). Worker invokes `executeTask()` from the n8n worker module [src/lib/n8n.worker.ts](src/lib/n8n.worker.ts#L164).
- **n8n integration:** Task payloads are sent to n8n via a server-side webhook call implemented in [src/lib/n8n.worker.ts](src/lib/n8n.worker.ts#L92-L116) (and mirrored in [src/lib/n8n.ts](src/lib/n8n.ts#L101-L126) for API-surface usage).
- **Queue & Redis:** Queue created in [src/lib/queue/queues.ts](src/lib/queue/queues.ts#L1-L12) and Redis connection in [src/lib/queue/redis.ts](src/lib/queue/redis.ts#L13).

**Task Execution Audit**
- **`executeTask()` (worker entry):**
  - File: [src/lib/n8n.worker.ts](src/lib/n8n.worker.ts#L164)
  - Purpose: Compose execution payload and call `executeN8nWorkflow()` which posts to the n8n webhook.
  - Risk assessment: Low-medium. Function includes readiness checks (`getN8nReadiness`) and uses `safeFetch` (retries/timeouts) [src/lib/network/safeFetch.ts](src/lib/network/safeFetch.ts#L1-L40), but it relies on caller (worker/API) to ensure correct task lifecycle state before sending.
- **`executeN8nWorkflow()` (HTTP call to n8n):**
  - File: [src/lib/n8n.worker.ts](src/lib/n8n.worker.ts#L92) and [src/lib/n8n.ts](src/lib/n8n.ts#L101)
  - Purpose: POST to configured n8n webhook using `safeFetch`, with retry/backoff and per-call timeout.
  - Risk assessment: Low. Uses `safeFetch` with retry/backoff (configurable) [src/lib/network/safeFetch.ts](src/lib/network/safeFetch.ts#L1-L120). SSRF/host validation occurs before using webhook URL via `validateN8nWebhookUrl` [src/lib/network/ssrf.ts](src/lib/network/ssrf.ts#L140).
- **`taskExecutionId` usage:**
  - Seen in: request validation ([src/app/api/tasks/execute/route.ts](src/app/api/tasks/execute/route.ts#L20-L28)), job data ([src/lib/queue/workers/task-worker.ts](src/lib/queue/workers/task-worker.ts#L9-L16)), and payload to n8n ([src/lib/n8n.worker.ts](src/lib/n8n.worker.ts#L166-L176)).
  - Purpose: a caller-provided UUID used for logging and payload correlation.
  - Risk assessment: MEDIUM — `taskExecutionId` is not persisted to the primary `tasks` table on enqueue (no evidence of a unique column or constraint for this value). This means duplicate job submissions with the same or different `taskExecutionId` are possible and not prevented at the DB level.
- **Execution status tracking & state machine:**
  - DB model: `tasks.status` exists and allowed values include `pending`, `processing`, `needs_review`, `failed`, `completed` ([supabase migration](supabase/migrations/20260502030000_phase_a_schema.sql#L28-L50)).
  - Callback transitions: `api/n8n/callback` and `api/tasks/callback` enforce a guarded transition only when current status === `processing` (see [src/app/api/n8n/callback/route.ts](src/app/api/n8n/callback/route.ts#L150-L172) and [src/app/api/tasks/callback/route.ts](src/app/api/tasks/callback/route.ts#L160-L190)).
  - Where `processing` is set: DOCUMENTED GAP — I found no authoritative call in the primary `src/app/api/tasks/execute/route.ts` that sets the task status to `processing` before enqueue; some worktree variants (.kilo) show such transitions, but the current canonical source used by the API route that enqueues the job does not update the DB status to `processing` (see [src/app/api/tasks/execute/route.ts](src/app/api/tasks/execute/route.ts#L100-L120)).
  - Risk assessment: CRITICAL to HIGH (operational) — if `processing` is not set atomically at enqueue-time, callbacks will commonly be ignored (callback handler ignores non-`processing` tasks). This produces silent drops or `stale_ignored` outcomes ([src/app/api/n8n/callback/route.ts](src/app/api/n8n/callback/route.ts#L206-L226)).

**Queue Audit**
- **BullMQ usage:** `bullmq` is a dependency ([package.json](package.json#L24)). Queue creation: [src/lib/queue/queues.ts](src/lib/queue/queues.ts#L1-L12).
- **Queue names:** `task-queue` ([src/lib/queue/queues.ts](src/lib/queue/queues.ts#L1)).
- **Default job options (evidence):**
  - `attempts: 3`, `backoff: { type: 'exponential', delay: 1000 }`, `removeOnComplete: true`, `removeOnFail: true` ([src/lib/queue/queues.ts](src/lib/queue/queues.ts#L3-L12)).
- **Worker(s):**
  - Worker implementation: [src/lib/queue/workers/task-worker.ts](src/lib/queue/workers/task-worker.ts#L130-L160).
  - Worker creation: `new Worker(queueName, processor, { connection: redisConnection })` — no explicit concurrency/backoff/lockDuration provided in the Worker options (worker instantiation at [src/lib/queue/workers/task-worker.ts](src/lib/queue/workers/task-worker.ts#L130-L140)).
  - Queue events subscription implemented in [src/lib/queue/events.ts](src/lib/queue/events.ts#L1-L12).
- **Redis usage:** `ioredis` client in [src/lib/queue/redis.ts](src/lib/queue/redis.ts#L13-L40). Redis connection config exported as `redisConnection` ([src/lib/queue/redis.ts](src/lib/queue/redis.ts#L13)).
- **Scheduling:** No evidence of cron/repeatable jobs for the `task-queue` in primary sources; scheduling appears event-driven via the API enqueue route. (Search results show no `repeat` or `cron` settings for `task-queue`.)

**Idempotency Audit**
- **Callback idempotency table:** `n8n_callback_events` is created with `callback_key text not null unique` and `payload_hash` fields ([supabase/migrations/20260516090000_create_n8n_callback_events.sql](supabase/migrations/20260516090000_create_n8n_callback_events.sql#L1-L12)). This table is the canonical duplicate protection mechanism for webhook callbacks.
- **Callback dedup code:** `recordN8nCallback()` inserts into `n8n_callback_events` and treats Postgres unique constraint error `23505` as duplicate ([src/lib/n8n-callback-idempotency.ts](src/lib/n8n-callback-idempotency.ts#L143-L160)).
- **Execution identifier basis:** `buildN8nCallbackKey()` prefers an explicit `n8n_execution_id` (and several known fields) as `executionIdentifier` — otherwise it falls back to timestamp or payload hash ([src/lib/n8n-callback-idempotency.ts](src/lib/n8n-callback-idempotency.ts#L1-L32)).
- **Is `taskExecutionId` unique / persisted?:** UNKNOWN/WEAK — `taskExecutionId` is validated as a UUID on the API request ([src/app/api/tasks/execute/route.ts](src/app/api/tasks/execute/route.ts#L18-L24)) but there is NO evidence that this `taskExecutionId` is written to the `tasks` table or given a UNIQUE constraint at the DB level. The DB schema has `n8n_execution_id` (text) on `tasks` but not `taskExecutionId` ([supabase/migrations/20260502030000_phase_a_schema.sql](supabase/migrations/20260502030000_phase_a_schema.sql#L36-L40)).
- **Duplicate execution risk:** POSSIBLE — duplicates can arise from multiple API calls or queue re-deliveries. Callback dedup is robust, but duplicate side-effects before callback/state update are not fully prevented. `updateTaskExecutionState()` contains a check to avoid marking a task `processing` if it's already `processing`, which helps if `processing` is set atomically elsewhere ([src/lib/data/tasks.ts](src/lib/data/tasks.ts#L100-L116)).

IDEMPOTENCY_SCORE: 6/10
- Rationale: Callback-side idempotency is strong (DB unique constraint + insert-time duplicate handling). However, the initial producer-side uniqueness and persistence of `taskExecutionId` are missing (no DB uniqueness), and worker-side idempotency checks are limited — duplicates or double-enqueue of tasks can cause duplicate external effects before the callback dedupe runs.

**Database Audit**
- **Key tables found:** `tasks`, `task_events`, `task_reviews`, `n8n_callback_events`, etc. See canonical schema: [supabase/migrations/20260502030000_phase_a_schema.sql](supabase/migrations/20260502030000_phase_a_schema.sql#L1-L20) and [supabase/migrations/20260516090000_create_n8n_callback_events.sql](supabase/migrations/20260516090000_create_n8n_callback_events.sql#L1-L20).
- **Unique constraints & indices:**
  - `tasks.id` primary key (uuid) ([phase_a schema](supabase/migrations/20260502030000_phase_a_schema.sql#L28-L36)).
  - `n8n_callback_events.callback_key` UNIQUE (dedupe) ([n8n callback migration](supabase/migrations/20260516090000_create_n8n_callback_events.sql#L6)).
  - Standard workspace-scoped indices: `tasks_workspace_id_idx`, `task_events_task_id_idx`, etc. ([phase_a schema](supabase/migrations/20260502030000_phase_a_schema.sql#L130-L140)).
- **RLS / Policies:** RLS is enabled on `tasks` and related tables and policies are created to limit access to workspace members (see [phase_a schema RLS policies](supabase/migrations/20260502030000_phase_a_schema.sql#L328-L360)).

**Reliability Audit**
- **Retry behavior:**
  - Queue-level: default job options set `attempts: 3` and exponential backoff starting at 1000ms ([src/lib/queue/queues.ts](src/lib/queue/queues.ts#L3-L12)).
  - HTTP-level: `safeFetch()` implements retry/backoff/jitter for calling n8n (defaults: maxRetries=3, baseDelayMs=1000, maxDelayMs=15000) ([src/lib/network/safeFetch.ts](src/lib/network/safeFetch.ts#L1-L60)).
- **Timeout behavior:** `safeFetch` enforces per-request `timeoutMs` defaulting to 8000ms (configurable) and supports total retry budget ([src/lib/network/safeFetch.ts](src/lib/network/safeFetch.ts#L40-L90)).
- **Worker crash recovery & graceful shutdown:** Worker registers `SIGINT`/`SIGTERM` handlers and uses time-bounded close operations for worker, queue events, and Redis ([src/lib/queue/workers/task-worker.ts](src/lib/queue/workers/task-worker.ts#L170-L230)).
- **Dead-letter queue:** NO evidence of a dedicated dead-letter queue or explicit DLQ policy. `removeOnFail: true` means failed jobs are removed rather than retained for investigation (see [src/lib/queue/queues.ts](src/lib/queue/queues.ts#L3-L12)).
- **Replay safety:** Callback dedupe reduces risk of duplicate processing at the callback stage, and the callback code enforces an expected current status (`expectedCurrentStatus: 'processing'`) for updates ([src/app/api/n8n/callback/route.ts](src/app/api/n8n/callback/route.ts#L246-L258)). However, because the path that marks a task `processing` before enqueue is not clearly present, replay safety is incomplete.

RELIABILITY_SCORE: 7/10
- Rationale: Good retry/backoff strategies at both queue and HTTP levels, and graceful shutdown handling. Missing DLQ and incomplete task lifecycle (atomic set to `processing`) reduce score.

**Security Audit**
- **SSRF protections:** `validateN8nWebhookUrl()` enforces host allowlist, blocks non-HTTPS, rejects localhost/IP literals, resolves DNS and blocks private IPs, and rejects unsafe redirect-like query params ([src/lib/network/ssrf.ts](src/lib/network/ssrf.ts#L140-L220)).
- **Webhook authentication:** Callback endpoints validate a server-side shared secret using timing-safe compare: [src/app/api/n8n/callback/route.ts](src/app/api/n8n/callback/route.ts#L10-L32) and [src/app/api/tasks/callback/route.ts](src/app/api/tasks/callback/route.ts#L10-L36).
- **Supabase RLS & tenant isolation:** RLS is enabled on `tasks`, `creative_assets`, `storage.objects`, etc., with helper functions `public.is_workspace_member()` used in policies (see [phase_a schema RLS policies](supabase/migrations/20260502030000_phase_a_schema.sql#L328-L360) and `creative_assets` migration [supabase/migrations/20260507100000_create_creative_assets.sql](supabase/migrations/20260507100000_create_creative_assets.sql#L100-L112)).
- **Outbound URL allowlist / redirect protections:** `N8N_WEBHOOK_HOST_ALLOWLIST` is required to permit webhook execution; when not configured validation fails (see [`readAllowedHosts()` and disallow path](src/lib/network/ssrf.ts#L1-L18)).
- **Other controls:** Request-rate limiting at API entry (`checkRateLimit`) is enforced for task enqueue requests ([src/app/api/tasks/execute/route.ts](src/app/api/tasks/execute/route.ts#L40-L70)).

SECURITY_SCORE: 8/10
- Rationale: Strong protections for SSRF and callbacks, and RLS configured for Supabase tables. Remaining items: ensure service-role secrets are stored securely in deployment, and confirm allowlist env is configured in production (if not configured, `validateN8nWebhookUrl` will reject all webhooks — a safe default but operationally blocking).

**Observability Audit**
- **Logging & structured errors:** `logger` provides structured logs with `requestId` and optional `traceId` fields; `reportAppError` consistently used across execution and callback flows ([src/lib/logger.ts](src/lib/logger.ts#L1-L36) and usage in `n8n` and callbacks). Example: `log.info('Job started', { jobId: job.id, taskExecutionId, workspaceId, requestId })` ([src/lib/queue/workers/task-worker.ts](src/lib/queue/workers/task-worker.ts#L149-L152)).
- **Tracing propagation:** `safeFetch` supports `traceId` injection and attaches `traceId` to retry events ([src/lib/network/safeFetch.ts](src/lib/network/safeFetch.ts#L1-L20)). However, there is no global OpenTelemetry instrumentation in the codebase that I can find; Sentry is included as a dependency and client-side initialization exists ([src/lib/sentry-client.tsx](src/lib/sentry-client.tsx#L1-L16)), but server-side Sentry init or distributed tracing wiring is not evident.
- **Audit logs:** Supabase migrations include `security_audit_logs` creation (migration exists: [supabase/migrations/20260511190000_create_security_audit_logs.sql], but I did not inspect its contents in-depth).

OBSERVABILITY_SCORE: 6/10
- Rationale: Good structured logging and traceId support at call-sites. Lacks full end-to-end distributed tracing and clear Sentry server-side initialization. Consider adding correlation propagation across queue/job/callback boundaries and instrumenting server Sentry/OTel.

**Failure Recovery & Disaster Readiness**
- **Worker shutdown:** Graceful shutdown implemented with timeouts and resource close attempts ([src/lib/queue/workers/task-worker.ts](src/lib/queue/workers/task-worker.ts#L170-L230)).
- **Automatic redis reconnect:** `ioredis` configured with `reconnectOnError` and `retryStrategy` ([src/lib/queue/redis.ts](src/lib/queue/redis.ts#L1-L40)).
- **Backups & migrations:** A `create_backup_records` migration exists ([supabase/migrations/20260511210000_create_backup_records.sql]) — indicates some DR planning; details not validated here.
- **Gaps:** No explicit DLQ; failed jobs removed on fail (`removeOnFail: true`) reducing visibility into persistent failures. No documented runbook for restoring queue state or reprocessing removed failed jobs.

**Production Readiness Assessment**
- Strong items: SSRF defense, callback deduplication, retry/backoff at HTTP and queue levels, Redis resilience config, RLS enforcement.
- Primary operational risks:
  - Missing/unclear place where `tasks.status` transitions to `processing` (CRITICAL).
  - `taskExecutionId` not persisted/unique in DB (HIGH) — producer-side dedupe absent.
  - No DLQ or retained failed-job visibility (HIGH/OPERATIONAL).

**Open Risks (evidence-backed)**
- CRITICAL: Callback handlers only accept updates if task `status === 'processing'`, but the primary enqueue route (`src/app/api/tasks/execute/route.ts` #L100-L120) does not atomically set the task to `processing` before enqueue. If `processing` is not set elsewhere, callbacks will be `stale_ignored` ([src/app/api/n8n/callback/route.ts](src/app/api/n8n/callback/route.ts#L206-L226)).
- HIGH: `taskExecutionId` is not stored with a UNIQUE constraint in the DB; duplicates can occur before callback dedupe runs ([src/app/api/tasks/execute/route.ts](src/app/api/tasks/execute/route.ts#L100-L120); schema missing a corresponding column). 
- HIGH: Failed jobs are removed on fail (`removeOnFail: true`) hiding the DLQ — reduces forensics and manual retry options ([src/lib/queue/queues.ts](src/lib/queue/queues.ts#L3-L12)).
- MEDIUM: Worker options omit explicit concurrency/lock/limiter settings at Worker instantiation; default behavior is unclear from code and should be made explicit ([src/lib/queue/workers/task-worker.ts](src/lib/queue/workers/task-worker.ts#L130-L140)).
- LOW: Sentry/telemetry server-side setup not evident — client side exists but server-side instrumentation would improve incident response ([src/lib/sentry-client.tsx](src/lib/sentry-client.tsx#L1-L16)).

**Missing Controls**
- Producer DB-unique idempotency: `taskExecutionId` not persisted or constrained in `tasks` table.
- Dead-letter queue / failed-job retention for manual inspection.
- Explicit, documented atomic state transition to `processing` at enqueue time (or worker claiming lock and updating status atomically).
- Explicit distributed tracing (OTel) or server-side Sentry init to correlate API → queue → worker → callback traces.

**Recommended Fixes (concise, prioritized)**
1. Add an atomic state transition when starting execution: set `tasks.status = 'processing'` and persist `taskExecutionId` in the same transaction that enqueues the job (or make enqueue a DB transaction + queue add) — prevents callback mis-ignores. Evidence: callback ignores when not `processing` ([src/app/api/n8n/callback/route.ts](src/app/api/n8n/callback/route.ts#L206-L226)).
2. Persist `taskExecutionId` on `tasks` (new column + UNIQUE index OR unique index on (workspace_id, taskExecutionId)) to provide producer-side dedupe and audit trail.
3. Replace `removeOnFail: true` with retention + DLQ or archive failed jobs for investigation; implement alerting for repeated failures ([src/lib/queue/queues.ts](src/lib/queue/queues.ts#L3-L12)).
4. Add a server-side Sentry/OTel initialization file and propagate `traceId` across API→queue→worker→callback (use existing `traceId` support in `safeFetch`).
5. Make worker concurrency, lockDuration, and maxStalledCount explicit in `new Worker(...)` options and document expected throughput ([src/lib/queue/workers/task-worker.ts](src/lib/queue/workers/task-worker.ts#L130-L140)).
6. Add end-to-end integration tests for: duplicate job enqueue with same `taskExecutionId`, callback replay, and `processing`-status transitions.
7. Implement DLQ-to-table reprocessor script to re-enqueue or surface failed jobs for manual inspection.
8. Add operational runbooks for restoring queue/DB after a partial outage (covering Redis failure, job loss, and supabase restore steps).
9. Validate that production env sets `N8N_WEBHOOK_HOST_ALLOWLIST` and `N8N_CALLBACK_SECRET` and document deployment checklist (these envs are required by code: [ssrf](src/lib/network/ssrf.ts#L1-L18) and [n8n readiness](src/lib/n8n.ts#L1-L20)).
10. Add a small monitoring dashboard: queue depth, failed-job rate, callback dup rate (use `n8n_callback_events` stats).

**Prioritized Action Plan**
- **1:** Implement atomic `processing` transition + persist `taskExecutionId` (see Recommended fixes #1-2). (CRITICAL)
- **2:** Add DLQ/failed-job retention and alerting (#3). (HIGH)
- **3:** Add server-side Sentry/OTel instrumentation and ensure `traceId` flows across API→queue→worker→callback. (HIGH)
- **4:** Make worker options explicit (concurrency, locks) (#5). (MEDIUM)
- **5:** Add integration tests for duplicates/callbacks/runbook (#6). (MEDIUM)
- **6:** Implement DLQ reprocessor script (#7). (MEDIUM)
- **7:** Create operational runbook and test restore steps (#8). (MEDIUM)
- **8:** Confirm production env allowlist & secret set, add checklist (#9). (LOW)
- **9:** Add queue/worker metrics (depth, failed count, ack latency) to monitoring dashboards. (LOW)
- **10:** Periodic security review of DNS/DNS-rebinding checks and allowlist maintenance. (LOW)

CURRENT_PRODUCTION_READINESS_SCORE: 7/10

TOP_10_NEXT_ACTIONS
1. Persist `taskExecutionId` and atomically set `tasks.status='processing'` at enqueue (or make enqueue transactional). (CRITICAL)
2. Stop removing failed jobs on fail — retain and feed to a DLQ/alerting pipeline. (HIGH)
3. Add server-side Sentry/OTel initialization and ensure `traceId` flows across API→queue→worker→callback. (HIGH)
4. Make worker concurrency and lock settings explicit; run capacity tests. (MEDIUM)
5. Implement automatic DLQ reprocessor for manual/retry workflows. (MEDIUM)
6. Add integration tests for duplicate requests, callback replay, and idempotency enforcement. (MEDIUM)
7. Add runbook for Redis and Supabase outage and test restore procedure. (MEDIUM)
8. Ensure `N8N_WEBHOOK_HOST_ALLOWLIST` and `N8N_CALLBACK_SECRET` are set in production and documented. (LOW)
9. Add queue/worker metrics (depth, failed count, ack latency) to monitoring dashboards. (LOW)
10. Periodic security review of DNS/DNS-rebinding checks and allowlist maintenance. (LOW)

Notes and Evidence Directory (selected files referenced above):
- [src/lib/n8n.worker.ts](src/lib/n8n.worker.ts#L92-L116) — n8n HTTP call and `executeTask`
- [src/lib/n8n.ts](src/lib/n8n.ts#L101-L126) — API-side n8n wrapper
- [src/lib/queue/queues.ts](src/lib/queue/queues.ts#L1-L12) — queue creation & defaultJobOptions
- [src/lib/queue/workers/task-worker.ts](src/lib/queue/workers/task-worker.ts#L130-L160) — worker processing
- [src/lib/queue/redis.ts](src/lib/queue/redis.ts#L13) — Redis connection and client
- [src/lib/network/safeFetch.ts](src/lib/network/safeFetch.ts#L1-L60) — HTTP retry/backoff & traceId support
- [src/lib/network/ssrf.ts](src/lib/network/ssrf.ts#L140) — webhook URL validation and DNS checks
- [src/lib/n8n-callback-idempotency.ts](src/lib/n8n-callback-idempotency.ts#L143-L160) — callback dedupe insert/unique handling
- [supabase/migrations/20260516090000_create_n8n_callback_events.sql](supabase/migrations/20260516090000_create_n8n_callback_events.sql#L1-L12) — callback table + unique `callback_key`
- [supabase/migrations/20260502030000_phase_a_schema.sql](supabase/migrations/20260502030000_phase_a_schema.sql#L28-L40) — `tasks` schema & RLS policies

If you want, I can now:
- Run a targeted code-change PR to add `taskExecutionId` persistence + atomic `processing` transition (I will not modify code unless you ask). 
- Generate a short remediation PR plan with exact file patches and tests to implement items 1–3 above.
