# RISK REGISTER — AgentFlow-AI

**Last Updated:** 2026-07-13 (Wave 8 Complete — Accessibility + Nav IA + Design Tokens)

---

## Risk Table

| ID | Risk | Likelihood | Impact | Status | Mitigation | Owner |
|----|------|:----------:|:------:|:------:|------------|-------|
| R1 | Real secrets leakage | Medium | Critical | **Closed** | .env.example clean, .gitignore hardened, scan clean | Security |
| R2 | Broken quality gates | Low | High | **Closed** | ESLint exit code fixed | — |
| R3 | God components (reports 619 lines) | Medium | High | **Mitigated** | Reports split in Wave 4; analytics split to 491 lines | Maintainability |
| R4 | Missing composite indexes | High | High | **Closed** | `tasks(workspace_id, status)` added | Performance |
| R5 | Dual RBAC systems | Medium | Medium | **Closed** | All call sites migrated, legacy file deleted | Backend |
| R6 | Billing scaffold drift | Low | Low | **Closed** | Stripe removed W5; billing UI replaced with Usage & Limits | — |
| R7 | Orphaned billing utilities | Medium | Low | **Closed** | Code deleted W5; `billing_customers`/`subscriptions` tables inert | — |
| R8 | 3 test failures (2 test files) | Low | Medium | **Closed** | Fixed in Wave 4: timeout + mock issues resolved | Backend |
| R9 | 179 ESLint warnings | Low | Low | **Closed** | Eliminated W6: 165→0 warnings across 41 files | DX |
| R17 | Shared utils duplicated across dashboard/reports | Low | Low | **Closed** | Consolidated in Wave 4 | Maintainability |
| R10 | Dual n8n callback | Low | Low | **Closed** | Deprecated wrapper | Backend |
| R11 | Health endpoint info disclosure | Low | High | **Closed** | Two-tier auth gate | Security |
| R12 | CSP report-uri missing endpoint | Low | Medium | **Closed** | Directives removed | Security |
| R13 | API error envelope inconsistency | Low | Medium | **Closed** | Standardized across 7+ routes | Backend |
| R14 | Billing ambiguity | Low | Medium | **Closed** | Documented, then resolved in W5 | Architecture |
| R15 | No Stripe integration | N/A | N/A | **Closed** | Not a risk — internal platform has no billing requirement | — |
| R16 | No organization/enterprise layer | N/A | N/A | **Closed** | Not a risk — platform serves a single team | — |
| R18 | Flat sidebar navigation hurts daily usability | Medium | Low | **Closed** | Nav IA groups added: 7 collapsible groups, localStorage persistence, 32 items organized | UX |
| R19 | Pre-WCAG color contrast (a11y audit fail) | Medium | Medium | **Mitigated** | Design tokens: 90%+ WCAG AA compliance, 6 components migrated, 32 legacy mappings preserved | Design |
| R20 | Sidebar merge drift (agents 1-3) | Low | Medium | **Closed** | Merge verify completed: all 5 behaviors in one component | — |
| R21 | No mobile bottom navigation | Low | Low | **Closed** | 5-slot MobileBottomNav added in W8-T5 | UX |
| R22 | Remaining a11y debt (non-core pages) | Low | Low | **Mitigated** | Form labels batch; debt documented. Not claiming full WCAG certification | A11y |

---

## Risk Trend

| Wave | Open Critical | Open High | Open Medium | Open Low | Total Open |
|:----:|:-------------:|:---------:|:-----------:|:--------:|:----------:|
| Wave 0 | 3 | 7 | 12 | — | 22 |
| Wave 1.2 | 3 | 6 | 10 | — | 19 |
| Wave 2 | 0 | 4 | 0 | — | 4 |
| Stable (Wave 3) | 0 | 3 | 1 | 2 | 6 |
| Wave 4 | 0 | 2 | 0 | 1 | 3 |
| Wave 5 | 0 | 0 | 0 | 1 | 1 |
| **Wave 6** | **0** | **0** | **0** | **0** | **0** |
| **Wave 7** | **0** | **0** | **0** | **0** | **0** |
| **Wave 8** | **0** | **0** | **0** | **0** | **0** |
| **Final** | **0** | **0** | **0** | **0** | **0** |

---

## Key Observations

- **All risks closed or mitigated** across Waves 2–8: R1–R22
- **Zero open risks** maintained — cleanest risk posture since project inception
- **SaaS risks removed:** Stripe (R15) and org layer (R16) are N/A for an internal platform
- **Code quality debt cleared:** ESLint 165→0 warnings, code-splitting added, pagination added
- **Team UX polished:** Per-member attribution, usage history, audit UI, copy consistency delivered in Wave 7
- **Nav IA improved:** Flat 32-item sidebar → 7 groups (R18 closed)
- **Accessibility foundation laid:** Design tokens bring 90%+ WCAG AA contrast (R19 mitigated)
- **Sidebar merge verified:** Agent 1-3 work coherent in single component (R20 closed)
- **Mobile bottom nav added:** Primary destinations one tap away (R21 closed)
- **A11y debt honest:** Not claiming full WCAG certification; remaining gaps documented (R22 mitigated)
