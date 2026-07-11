# Performance Review Template

---
report-id: PERF-YYYYMMDD-XXXXX
type: performance-review
author: performance-agent
status: [draft|final]
---

# Performance Review Report: [Change Name]

## Executive Summary
[2-3 جمل تلخص تأثير التغيير على الأداء]

## Scope of Review
| الحقل | القيمة |
|-------|--------|
| **Change** | [feature/change name] |
| **Endpoints Affected** | [endpoints] |
| **Queries Affected** | [queries] |
| **Components Affected** | [components] |

## API Performance
| Endpoint | Before | After | Change | Threshold | Status |
|----------|--------|-------|--------|-----------|--------|
| GET /api/example | XXms | XXms | +/-X% | +/-10% | ✅ / ⚠️ |
| POST /api/example | XXms | XXms | +/-X% | +/-10% | ✅ / ⚠️ |

## Database Performance
| Query | Before | After | Change | Status |
|-------|--------|-------|--------|--------|
| Query 1 | XXms | XXms | +/-X% | ✅ / ⚠️ |
| Query 2 | XXms | XXms | +/-X% | ✅ / ⚠️ |

## Frontend Performance
| Metric | Before | After | Change | Threshold | Status |
|--------|--------|-------|--------|-----------|--------|
| Bundle Size | XXKB | XXKB | +/-X% | +/-10KB | ✅ / ⚠️ |
| First Paint | X.Xs | X.Xs | +/-X% | +/-0.5s | ✅ / ⚠️ |
| Lighthouse Score | XX | XX | +/-X | +/-5 | ✅ / ⚠️ |

## Bottlenecks Identified
1. [Bottleneck 1]
2. [Bottleneck 2]

## Recommendations
1. **Priority 1:** [Immediate optimization needed]
2. **Priority 2:** [Should optimize in next sprint]
3. **Future:** [Nice to have optimization]

## Decision
- [ ] **APPROVE** — No performance concerns
- [ ] **APPROVE WITH NOTES** — Minor optimizations suggested
- [ ] **REJECT** — Performance regression unacceptable

---

*Performance reviewed by Performance Agent*
