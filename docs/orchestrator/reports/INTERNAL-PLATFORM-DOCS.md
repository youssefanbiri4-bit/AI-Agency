# INTERNAL-PLATFORM-DOCS — Internal Platform Decision Report

**Date:** 2026-07-12
**Task:** INTERNAL-PLATFORM-DOCS
**Status:** **COMPLETE — All orchestrator files aligned**
**Branch:** docs/internal-platform-no-stripe

---

## Executive Summary

**AgentFlow-AI is now explicitly documented as an internal operating platform for the owner + team — not a commercial SaaS product.**

All commercial billing/Stripe references have been removed from the active roadmap. The platform's purpose is documented clearly: internal HQ for AI agent operations, task management, reporting, and workflow orchestration.

---

## What Was Done

### 1. `docs/BILLING_STATUS.md` — Rewritten

**Old position:** "Scaffolded for future Stripe integration, deliberately disabled for Beta."

**New position:** "Internal platform purpose. No Stripe. No commercial billing. Usage tracking = internal resource governance only."

Key changes:
- Added clear "Internal Platform Only" decision header
- Stripe client, routes, and plan mapping explicitly marked as **dead code — do not use**
- Usage tracking reframed as internal operational limits (prevent resource exhaustion, not billing enforcement)
- Removed "What Future Engineers Need to Build" Stripe roadmap
- Added "How to Think About Billing Going Forward" table mapping SaaS concepts → internal equivalents
- Added explicit action table: what to keep vs leave vs clean up
- Stripe env vars commented out to avoid confusion

### 2. Orchestrator Files — Updated

| File | Change |
|------|--------|
| `MERGE_REPORT.md` | SaaS Readiness score → Internal Platform Readiness (95); Stripe/org risks closed; Wave 5→6 reframed to internal-focus; "No Stripe"/"No org" removed from remaining tech debt |
| `PROJECT_HEALTH_REPORT.md` | SaaS Readiness (55) → Internal Platform Readiness (95); rationale updated |
| `RISK_REGISTER.md` | R15 (No Stripe) and R16 (No org) closed as "not applicable"; risk count drops to 1 open (R9 ESLint warnings) |
| `TASK_QUEUE.md` | Wave 5 SaaS tasks cancelled → replaced with "Internal Platform — Stability & Team UX" tasks; Wave 6 reframed with CI/CD and docs tasks |
| `MASTER_BACKLOG.md` | Wave 5 SaaS section replaced with internal-focused tasks; Wave 6 updated similarly |
| `AI_TEAM_STATUS.md` | "No Stripe" and "No org" moved from Open→Closed; new "Internal Platform" direction section; next waves reframed; agent allocations updated for ops/docs focus |
| `TECHNICAL_DEBT.md` | Stripe and org items removed from medium priority; orphaned billing utilities moved to low priority optional cleanup |

### 3. Historical Reports — Superseded Notes

| Report | Update |
|--------|--------|
| `W5-KICKOFF-STRIPE.md` | Added ⚠️ superseded banner — Stripe implementation is dead code, see BILLING_STATUS.md |
| `STABLE-BASELINE-DOCS.md` | SaaS Readiness → Internal Platform Readiness; remaining work and roadmap updated with reality notes |

### 4. Report Written

✅ This document — `docs/orchestrator/reports/INTERNAL-PLATFORM-DOCS.md`

---

## Files Modified / Created

| File | Action |
|------|--------|
| `docs/BILLING_STATUS.md` | **Rewritten** — internal platform, no Stripe |
| `docs/orchestrator/MERGE_REPORT.md` | **Updated** — scores, risks, waves, tech debt |
| `docs/orchestrator/PROJECT_HEALTH_REPORT.md` | **Updated** — Internal Platform Readiness |
| `docs/orchestrator/RISK_REGISTER.md` | **Updated** — Stripe/org risks closed |
| `docs/orchestrator/TASK_QUEUE.md` | **Updated** — new internal-focused waves |
| `docs/orchestrator/MASTER_BACKLOG.md` | **Updated** — new internal-focused waves |
| `docs/orchestrator/AI_TEAM_STATUS.md` | **Updated** — new direction, risks, waves |
| `docs/orchestrator/TECHNICAL_DEBT.md` | **Updated** — removed SaaS debt items |
| `docs/orchestrator/reports/STABLE-BASELINE-DOCS.md` | **Updated** — SaaS→Internal Platform Readiness |
| `docs/orchestrator/reports/W5-KICKOFF-STRIPE.md` | **Updated** — superseded banner added |
| `docs/orchestrator/reports/INTERNAL-PLATFORM-DOCS.md` | **Created** — this report |

---

## Success Criteria Verification

- [x] **BILLING_STATUS clearly says Internal / No Stripe** — Rewritten with explicit "Internal Platform Only" decision
- [x] **Roadmap no longer pushes commercial billing** — Wave 5 and 6 replaced with internal-focused tasks
- [x] **All orchestrator files consistent** — Verified across all 8 orchestrator files + 3 supporting reports
- [x] **Report written** — This document

---

## Consistency Check

All updated files have been verified for consistency:

| Check | Result |
|-------|:------:|
| BILLING_STATUS.md matches orchestrator direction | ✅ |
| MERGE_REPORT scores match PROJECT_HEALTH scores | ✅ |
| RISK_REGISTER closed risks match tech debt removal | ✅ |
| TASK_QUEUE waves match MASTER_BACKLOG waves | ✅ |
| AI_TEAM_STATUS aligns with new internal direction | ✅ |
| All 8 orchestrator files use consistent wave naming | ✅ |

---

## Proposed Forward Roadmap (Internal Focus)

### Wave 5: Internal Platform — Stability & Team UX

| Task | Agent | Priority | Effort |
|------|-------|----------|--------|
| ESLint warning cleanup (179 warnings) | Agent 1 | Medium | Small |
| Pagination on all list endpoints | Agent 2 | Medium | Medium |
| Team UX improvements (navigation, search, onboarding) | Agent 2 | High | Medium |
| Operational tooling (health dashboards, system status) | Agent 1 | High | Medium |

### Wave 6: Performance & Developer Experience

| Task | Agent | Priority | Effort |
|------|-------|----------|--------|
| Code-split top 5 largest client bundles | Agent 2 | Medium | Medium |
| PDF concurrency limits | Agent 1 | Low | Small |
| CI/CD pipeline hardening | Agent 1 | Medium | Medium |
| Documentation & runbook improvements | Agent 2 | Medium | Small |

---

## Recommendation

The documentation is now consistent across all orchestrator files. No further action required on the billing/internal-platform front. The next engineering focus should be **Wave 5 tasks** — starting with team UX improvements and operational tooling, which deliver the most internal value per effort.

**Documentation consistent.** All orchestrator files aligned. Ready for Wave 5.
