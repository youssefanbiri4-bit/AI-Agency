# RISK REGISTER — AgentFlow-AI

**Last Updated:** 2026-07-12 (Wave 2 Full Merge)

| ID | Risk | Likelihood | Impact | Post-Wave-2 Status | Mitigation | Owner | Status |
|----|------|:----------:|:------:|--------------------|------------|-------|:------:|
| R1 | Real secrets leakage (`.env.example` has live keys) | Medium | **Critical** | **Resolved** — `.env.example` clean (placeholders only), `.gitignore` hardened, full scan clean, no secrets in git history | Security | **Closed** |
| R2 | Broken quality gates (ESLint exit 0, CI false-green) | Low | High | **Resolved** — Wave 1.2 fixed ESLint exit code | — | Orchestrator | **Closed** |
| R3 | God components (ContentStudioClient 2.7k, Settings actions 2.4k lines) | High | High | Unchanged | Wave 4: split into domain modules | Maintainability | **Open** |
| R4 | Missing composite indexes (e.g., `tasks(workspace_id, status)`) | High | High | Unchanged | Wave 3: add composite indexes | Performance | **Open** |
| R5 | Dual RBAC systems (legacy `workspace-permissions` + current `rbac.ts`) | Medium | Medium | **Resolved** — all call sites migrated, legacy file removed | Wave: RBAC-MIGRATE-2 | Backend | **Closed** |
| R6 | Billing scaffold drift — schema may evolve without code updates | Low | Low | **Mitigated** — `docs/BILLING_STATUS.md` created with gap analysis | Documented; billing tables are stable | Architecture | **Mitigated** |
| R7 | Orphaned billing utilities (`stripe-server.ts` has no callers) | Medium | Low | **Acknowledged** | Documented in BILLING_STATUS.md | Architecture | **Acknowledged** |
| R8 | Pre-existing typecheck failures (47 errors from `@/lib/rate-limit`) | High | High | Unchanged — Wave 0 debt | Wave 3: fix rate-limit exports | Backend | **Open** |
| R9 | Pre-existing test failures (14 failures in 4 test files) | Medium | Medium | Unchanged — Wave 0 debt | Wave 3: fix rate-limit + preferenceDepartment + Redis infra | Backend | **Open** |
| R10 | Dual n8n callback maintenance surface | Low | Low | **Resolved** — `/api/tasks/callback` is now thin deprecation wrapper | — | Backend | **Closed** |
| R11 | Health endpoint info disclosure | Low | High | **Resolved** — two-tier auth gate implemented | — | Security | **Closed** |
| R12 | CSP report-uri referencing missing endpoint | Low | Medium | **Resolved** — directives removed; future work to implement endpoint | — | Security | **Closed** |
| R13 | API error envelope inconsistency | Low | Medium | **Resolved** — standardized across 7+ routes | — | Backend | **Closed** |
| R14 | Billing ambiguity (scaffold vs real) | Low | Medium | **Resolved** — decision documented in BILLING_STATUS.md | — | Architecture | **Closed** |

## Risk Trend

| Wave | Open Critical | Open High | Open Medium | Total Open |
|:----:|:-------------:|:---------:|:-----------:|:----------:|
| Wave 0 | 3 | 7 | 12 | 22 |
| Wave 1.2 | 3 | 6 | 10 | 19 |
| **Wave 2** | **0** | **4** | **0** | **4** |

## Key Observations

- **R1 (Secret Hygiene)** resolved — `.env.example` clean, `.gitignore` hardened, full scan clean, no secrets in git history
- **7 risks closed** in Wave 2: secret hygiene (R1), quality gates (R2), dual callback (R10), health disclosure (R11), CSP endpoint (R12), API inconsistency (R13), billing ambiguity (R14)
- **4 risks remain open:** god components (R3), composite indexes (R4), typecheck (R8), test failures (R9)
- **3 risks mitigated/acknowledged:** dual RBAC (R5), billing scaffold drift (R6), orphaned billing utilities (R7) — not counted as open
- **No new risks introduced** by Wave 2 changes
