# AgentFlow-AI — AI Communication Protocol

**وثيقة:** بروتوكول التواصل الموحد بين الوكلاء  
**النظام:** AgentFlow-AI Multi-Agent Operating System (AOS)  
**الإصدار:** 1.0.0  
**التاريخ:** 2026-07-11

---

## 1. نظرة عامة (Overview)

بروتوكول التواصل الموحد (Unified Communication Protocol) هو اللغة الرسمية التي يتواصل بها جميع وكلاء AI في نظام AOS. كل رسالة، تقرير، أو طلب يجب أن يتبع هذا البروتوكول لضمان:
- **التوحيد** — جميع الوكلاء يتحدثون نفس اللغة
- **القابلية للتدقيق** — يمكن تتبع أي قرار أو توصية
- **الوضوح** — لا غموض في التواصل
- **الأتمتة** — يمكن معالجة التقارير آلياً

---

## 2. هيكل الرسالة الموحد (Unified Message Structure)

كل رسالة بين وكلاء AI يجب أن تتبع الهيكل التالي:

```
╔═══════════════════════════════════════════════════════════════╗
║                   MESSAGE ENVELOPE                           ║
╠═══════════════════════════════════════════════════════════════╣
║ message-id: MSG-YYYYMMDD-XXXXX                               ║
║ from: [Agent ID]                                             ║
║ to: [Agent ID | broadcast]                                   ║
║ type: [request|response|report|approval|rejection|alert]     ║
║ priority: [critical|high|normal|low]                         ║
║ timestamp: ISO-8601                                          ║
║ in-reply-to: MSG-YYYYMMDD-XXXXX (optional)                   ║
║ task-id: TASK-XXXX (optional)                                ║
╠═══════════════════════════════════════════════════════════════╣
║                    MESSAGE BODY                               ║
╠═══════════════════════════════════════════════════════════════╣
║ subject: [Brief subject line]                                ║
║ summary: [1-3 sentence summary]                              ║
║ findings: [Key findings]                                     ║
║ risks: [Identified risks]                                    ║
║ recommendation: [Recommended action]                         ║
║ confidence: [1-5]                                            ║
║ next-step: [What should happen next]                         ║
║ attachments: [List of related files/references]              ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 3. أنواع الرسائل (Message Types)

### 3.1 Request (طلب)
عندما يحتاج وكيل إلى مساعدة أو معلومة من وكيل آخر:
```yaml
message-id: MSG-20260711-00001
from: backend-agent
to: database-agent
type: request
priority: high
subject: Review migration for tasks table
summary: Need review on new migration adding status index
findings: Added composite index on (workspace_id, status, created_at)
risks: May lock table during migration on large datasets
recommendation: Use CONCURRENTLY if table exceeds 100k rows
confidence: 4
next-step: Please review and approve or suggest changes
```

### 3.2 Response (رد)
```yaml
message-id: MSG-20260711-00002
from: database-agent
to: backend-agent
type: response
priority: high
in-reply-to: MSG-20260711-00001
subject: Migration review complete
summary: Migration is safe for production. CONCURRENTLY recommended.
findings: Index will improve query performance by ~80%
risks: None identified for tables under 1M rows
recommendation: Approved with CONCURRENTLY
confidence: 5
next-step: Apply migration during low-traffic hours
```

### 3.3 Report (تقرير)
```yaml
message-id: MSG-20260711-00003
from: qa-agent
to: cto-agent
type: report
priority: normal
subject: QA Report for Sprint 12
summary: All 48 tests pass. 2 edge cases need documentation.
findings: - 48/48 unit tests pass
  - 12/12 integration tests pass
  - 5/5 smoke tests pass
  - Coverage: 87%
risks: None blocking
recommendation: Ready for production
confidence: 5
next-step: Awaiting CTO approval for deployment
attachments: [qa-report-sprint-12.md]
```

### 3.4 Approval (موافقة)
```yaml
message-id: MSG-20260711-00004
from: cto-agent
to: devops-agent
type: approval
priority: high
in-reply-to: MSG-20260711-00003
subject: Approval for Sprint 12 deployment
summary: All reviews passed. Approved for production deployment.
confidence: 5
next-step: Deploy to production and run smoke tests
```

### 3.5 Rejection (رفض)
```yaml
message-id: MSG-20260711-00005
from: security-agent
to: backend-agent
type: rejection
priority: critical
in-reply-to: MSG-20260711-00001
subject: Security review: MIGRATION BLOCKED
summary: Migration exposes user emails in unindexed query path
findings: The new query does not use RLS filters correctly
risks: Potential data leak across workspace boundaries
recommendation: Add workspace_id filter to all queries
confidence: 5
next-step: Fix RLS policy and resubmit for review
```

### 3.6 Alert (تنبيه)
```yaml
message-id: MSG-20260711-00006
from: devops-agent
to: broadcast
type: alert
priority: critical
subject: Production error rate spike
summary: Error rate increased to 5% in last 10 minutes
findings: POST /api/tasks/execute returning 500 errors
risks: Users cannot execute tasks
recommendation: Investigating now. Will update in 15 min.
confidence: 4
next-step: DevOps investigating. Stand by for update.
```

---

## 4. حقول الرسالة الإلزامية (Required Fields)

| الحقل | إلزامي؟ | الوصف |
|-------|---------|-------|
| `message-id` | ✅ | معرف فريد للرسالة (MSG-YYYYMMDD-XXXXX) |
| `from` | ✅ | معرف الوكيل المرسل |
| `to` | ✅ | معرف الوكيل المستلم أو `broadcast` |
| `type` | ✅ | نوع الرسالة (request, response, report, approval, rejection, alert) |
| `priority` | ✅ | الأولوية (critical, high, normal, low) |
| `timestamp` | ✅ | بصمة زمنية بصيغة ISO-8601 |
| `subject` | ✅ | موضوع مختصر (حد أقصى 100 حرف) |
| `summary` | ✅ | ملخص من 1-3 جمل |
| `findings` | ✅ | النتائج الرئيسية |
| `risks` | ✅ | المخاطر المحددة (أو "None" إذا لم توجد) |
| `recommendation` | ✅ | الإجراء الموصى به |
| `confidence` | ✅ | مستوى الثقة (1-5) |
| `next-step` | ✅ | الخطوة التالية المطلوبة |

### الحقول الاختيارية
| الحقل | الوصف |
|-------|-------|
| `in-reply-to` | معرف الرسالة التي يتم الرد عليها |
| `attachments` | قائمة الملفات المرتبطة |
| `task-id` | معرف المهمة المرتبطة |

---

## 5. مستوى الثقة (Confidence Level)

| المستوى | المعنى | المثال |
|---------|--------|--------|
| **5 — مؤكد (Certain)** | متأكد 100% | "هذه ثغرة أمنية" — أدلة قاطعة |
| **4 — عالي (High)** | متأكد مع بعض الشكوك | "على الأرجح هذا هو السبب" |
| **3 — متوسط (Medium)** | لدي أدلة ولكن غير كافية | "يبدو أن هذا هو الحل" |
| **2 — منخفض (Low)** | تخمين مدروس | "قد يكون هذا مرتبطاً" |
| **1 — غير متأكد (Uncertain)** | لا توجد أدلة كافية | "أحتاج إلى مزيد من المعلومات" |

---

## 6. قواعد التواصل (Communication Rules)

### 6.1 الردود الإلزامية (Mandatory Replies)
| نوع الرسالة | مطلوب رد؟ | المهلة |
|------------|-----------|--------|
| Request | ✅ نعم | خلال 4 ساعات |
| Alert | ✅ نعم | خلال 15 دقيقة |
| Approval Request | ✅ نعم | خلال 2 ساعة |
| Report | ❌ لا | — |

### 6.2 التصعيد (Escalation)
إذا لم يتم الرد خلال المهلة المحددة:
```
Request → [4h no reply] → Escalate to Architect
Alert → [15min no reply] → Escalate to CTO
```

### 6.3 قواعد البث (Broadcast Rules)
- يستخدم `broadcast` فقط للحالات العاجلة (Alert type)
- جميع الوكلاء يستلمون broadcast messages
- الرد على broadcast: فقط إذا كنت معنيّاً

### 6.4 أرشفة الرسائل (Message Archiving)
- جميع الرسائل تُخزّن في `logs/aos/communications/`
- فترة الاحتفاظ: 90 يوماً
- الرسائل الحرجة تُحتفظ بها لمدة سنة

---

## 7. صيغ التقارير المتخصصة (Specialized Report Formats)

### 7.1 تقرير المراجعة المعمارية (Architecture Review Report)
```yaml
type: architecture-review
subject: Architecture Review for [Feature Name]
alignment: [consistent|needs-adjustment|incompatible]
files-affected: [file1.ts, file2.ts, ...]
complexity: [low|medium|high]
risks:
  - risk: [Risk description]
    severity: [low|medium|high]
    mitigation: [Mitigation plan]
recommendation: [approve|changes-required|redesign]
```

### 7.2 تقرير المراجعة الأمنية (Security Review Report)
```yaml
type: security-review
subject: Security Review for [Change]
vulnerabilities:
  - type: [xss|sql-injection|ssrf|rls|secret-exposure|other]
    severity: [critical|high|medium|low]
    location: [file.ts:line]
    description: [Description]
    fix: [Suggested fix]
recommendation: [pass|changes-required|blocked]
```

### 7.3 تقرير الجودة (QA Report)
```yaml
type: qa-review
subject: QA Report for [Change/Milestone]
tests:
  unit:
    total: XX
    passed: XX
    failed: XX
    coverage: XX%
  integration:
    total: XX
    passed: XX
    failed: XX
  smoke:
    total: XX
    passed: XX
    failed: XX
edge-cases-tested: [List]
recommendation: [pass|changes-required]
```

### 7.4 تقرير الأداء (Performance Report)
```yaml
type: performance-review
subject: Performance Impact of [Change]
metrics:
  - metric: [api-response-time|bundle-size|query-time|render-time]
    before: [value]
    after: [value]
    change: [+X%|-X%|unchanged]
    threshold: [value]
    status: [pass|warning|fail]
recommendation: [approve|optimize-required]
```

---

## 8. أمثلة عملية (Practical Examples)

### مثال: طلب مراجعة كود من Backend Agent إلى Architect Agent

```yaml
message-id: MSG-20260711-00100
from: backend-agent
to: architect-agent
type: request
priority: normal
timestamp: 2026-07-11T14:30:00Z
subject: Code review: Add campaign export endpoint
summary: Implemented GET /api/campaigns/export returning CSV
findings:
  - New route in campaigns/export/route.ts
  - Uses streaming response for large datasets
  - Added Zod validation for query params
  - 12 unit tests, all passing
risks:
  - CSV export could be memory-heavy for >100k rows
  - No rate limiting on export endpoint
recommendation: Add rate limiting before production deploy
confidence: 4
next-step: Please review and approve
attachments:
  - src/app/api/campaigns/export/route.ts
  - tests/campaigns/export.test.ts
```

---

*تم إنشاء هذه الوثيقة كجزء من AgentFlow-AI Multi-Agent Operating System (AOS).*
