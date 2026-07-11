# Code Review Template

---
report-id: CR-YYYYMMDD-XXXXX
type: code-review
author: architect-agent
status: [draft|final]
---

# Code Review Report

## Change Summary
| الحقل | القيمة |
|-------|--------|
| **Feature** | [feature name] |
| **Author** | [agent-id] |
| **Files Changed** | [count] |
| **Lines Added** | [count] |
| **Lines Removed** | [count] |
| **Build** | ✅ PASS / ❌ FAIL |
| **Tests** | ✅ PASS / ❌ FAIL |
| **Lint** | ✅ PASS / ❌ FAIL |

## Files Reviewed
| File | Lines | Quality Score | Notes |
|------|-------|---------------|-------|
| file1.ts | XX | ⭐⭐⭐⭐⭐ | [notes] |
| file2.ts | XX | ⭐⭐⭐⭐ | [notes] |

## Review Checklist
| Check | Status | Notes |
|-------|--------|-------|
| Code quality | ⭐⭐⭐⭐⭐ | |
| TypeScript types correct | ✅ / ❌ | |
| Error handling appropriate | ✅ / ❌ | |
| Tests included & passing | ✅ / ❌ | |
| No dead/commented code | ✅ / ❌ | |
| No debug/logging leftovers | ✅ / ❌ | |
| Follows conventions | ✅ / ❌ | |
| No duplication | ✅ / ❌ | |
| JSDoc added for new functions | ✅ / ❌ | |
| i18n labels added | ✅ / ❌ | |

## Comments

### What was done well
- [Positive aspect 1]
- [Positive aspect 2]

### Must Fix (blocking)
1. [ ] **File:line** — [Description of issue]
2. [ ] **File:line** — [Description of issue]

### Should Fix (non-blocking)
1. [ ] **File:line** — [Description]
2. [ ] **File:line** — [Description]

### Nice to Have (suggestions)
1. [ ] **File:line** — [Suggestion]

## Final Verdict
- [ ] **APPROVE** — Ready for merge
- [ ] **APPROVE WITH COMMENTS** — Address non-blocking issues in next sprint
- [ ] **CHANGES REQUIRED** — Fix blocking issues first
- [ ] **BLOCKED** — Requires redesign or architecture review

---

*Code reviewed by Architect Agent*
