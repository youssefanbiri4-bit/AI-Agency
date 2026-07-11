# Security Review Template

---
report-id: SEC-YYYYMMDD-XXXXX
type: security-review
author: security-agent
status: [draft|final]
---

# Security Review Report: [Change Name]

## Executive Summary
[2-3 جمل تلخص المراجعة الأمنية]

## Scope
| الحقل | القيمة |
|-------|--------|
| **Target** | [files/routes/features reviewed] |
| **Review Type** | [full|targeted|quick] |
| **Risk Level** | [low|medium|high|critical] |

## Vulnerability Assessment

### Critical (0)
| ID | Vulnerability | Location | Description | Fix |
|----|--------------|----------|-------------|-----|
| — | None found | — | — | — |

### High
| ID | Vulnerability | Location | Description | Fix |
|----|--------------|----------|-------------|-----|
| — | — | — | — | — |

### Medium
...

### Low
...

## Security Checklist
| Check | Status | Notes |
|-------|--------|-------|
| RLS policies correct | ✅ / ❌ | [notes] |
| No secret exposure | ✅ / ❌ | [notes] |
| Input validation (Zod) | ✅ / ❌ | [notes] |
| Rate limiting applied | ✅ / ❌ | [notes] |
| CSP headers present | ✅ / ❌ | [notes] |
| SSRF protection | ✅ / ❌ | [notes] |
| Secure cookie config | ✅ / ❌ | [notes] |
| No SQL injection vectors | ✅ / ❌ | [notes] |
| No XSS vectors | ✅ / ❌ | [notes] |

## Recommendation
- [ ] **PASS** — No security concerns
- [ ] **PASS WITH NOTES** — Minor issues documented for future
- [ ] **CHANGES REQUIRED** — Fix before deployment
- [ ] **BLOCKED** — Critical vulnerabilities found

## Next Steps
1. [Action item 1] — Assigned to: [Agent]
2. [Action item 2] — Assigned to: [Agent]
3. [Re-review required if changes made]

---

*Security reviewed by Security Agent*
