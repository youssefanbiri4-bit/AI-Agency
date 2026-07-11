# Architecture Review Template

---
report-id: ARCH-YYYYMMDD-XXXXX
type: architecture-review
author: architect-agent
status: [draft|final]
---

# Architecture Review Report: [Feature/Change Name]

## Executive Summary
[2-3 جمل تلخص التغيير المعماري وتأثيره]

## Change Description
| الحقل | القيمة |
|-------|--------|
| **Feature** | [feature name] |
| **Complexity** | [low|medium|high] |
| **Files Affected** | [count] |
| **Lines Changed** | [count] |
| **Estimated Impact** | [low|medium|high] |

## Architecture Alignment
| المعيار | الحالة | الملاحظات |
|---------|--------|-----------|
| Consistent with existing patterns | ✅ / ⚠️ / ❌ | [notes] |
| Follows project conventions | ✅ / ⚠️ / ❌ | [notes] |
| No breaking changes | ✅ / ⚠️ / ❌ | [notes] |
| Scalable design | ✅ / ⚠️ / ❌ | [notes] |
| Testable | ✅ / ⚠️ / ❌ | [notes] |
| Maintainable | ✅ / ⚠️ / ❌ | [notes] |

## Risk Analysis
| Risk | Severity | Probability | Impact | Mitigation |
|------|----------|-------------|--------|------------|
| [Risk 1] | H/M/L | H/M/L | H/M/L | [Mitigation plan] |
| [Risk 2] | H/M/L | H/M/L | H/M/L | [Mitigation plan] |

## Recommendations
1. **Must Do:** [Critical recommendation before proceeding]
2. **Should Do:** [Important but not blocking]
3. **Nice to Have:** [Suggestion for future]

## Alternatives Considered
| البديل | المميزات | العيوب | لماذا لم يُختار |
|--------|---------|--------|----------------|
| Alternative 1 | [pros] | [cons] | [reason] |
| Alternative 2 | [pros] | [cons] | [reason] |

## Decision
- [ ] **Approve** — Architecture is sound, ready for implementation
- [ ] **Changes Required** — Address recommendations before proceeding
- [ ] **Redesign Needed** — Fundamental issues, requires new design

## Dependencies
- [Dependency 1]
- [Dependency 2]

---

*Architecture reviewed by Architect Agent*
