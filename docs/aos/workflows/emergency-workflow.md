# AgentFlow-AI — Emergency Workflow

**سير العمل:** حالات الطوارئ  
**المسؤول:** Security Agent (للأمن) / DevOps Agent (للإنتاج)  
**المشاركون:** CTO Agent, الوكلاء المعنيون  
**المدة المقدرة:** فورية

---

## 1. الهدف

الاستجابة السريعة للحوادث الحرجة (ثغرة أمنية، فشل إنتاجي، فقدان بيانات) مع تقليل وقت التعطل وحماية البيانات.

## 2. المخرجات

1. **Incident Report** — تقرير الحادثة
2. **Post-Mortem** — تحليل ما بعد الحادثة (خلال 24 ساعة)
3. **Fix Implementation** — إصلاح المشكلة

## 3. أنواع الطوارئ

| النوع | الوصف | المسؤول | وقت الاستجابة |
|-------|-------|---------|--------------|
| **P0 — Critical** | ثغرة أمنية، فقدان بيانات، تعطل كامل | CTO + Security + DevOps | فوري (< 15 دقيقة) |
| **P1 — High** | تعطل ميزة رئيسية، تدهور أداء حاد | DevOps + الوكلاء المعنيون | < 30 دقيقة |
| **P2 — Medium** | تعطل ميزة ثانوية، مشكلة في UI | الوكلاء المعنيون | < 4 ساعات |
| **P3 — Low** | مشكلة تجميلية، خطأ في النصوص | Backlog | < 1 أسبوع |

## 4. سير عمل الطوارئ (للـ P0/P1)

```
[Emergency Detected]
    ↓
[Immediate Action] (تعطيل الميزة / rollback)
    ↓
[Notification] (إشعار CTO + جميع الوكلاء المعنيين)
    ↓
[Hotfix Implementation] (أسرع حل آمن)
    ↓
[Expedited Review] (Security + Architect فقط)
    ↓
[CTO Approval] (موافقة عاجلة)
    ↓
[Emergency Deploy] (DevOps ينشر فوراً)
    ↓
[Verification] (QA يتحقق من الإصلاح)
    ↓
[Post-Mortem] (خلال 24 ساعة - تحليل كامل)
```

## 5. إجراءات الطوارئ التفصيلية

### 5.1 اكتشاف الحادثة
- أي وكيل يمكنه الإبلاغ عن حادثة
- استخدام قناة الطوارئ المخصصة
- تقديم معلومات واضحة: ما الخطأ؟ متى بدأ؟ ما التأثير؟

### 5.2 الإجراء الفوري
```
If Security Incident:
  - تعطيل الميزة المصابة فوراً (Security Agent)
  - إشعار CTO خلال 5 دقائق
  
If Production Failure:
  - rollback إلى آخر إصدار مستقر (DevOps Agent)
  - إشعار CTO خلال 5 دقائق
  
If Data Issue:
  - freeze على الجدول المصاب (Database Agent)
  - إشعار CTO خلال 5 دقائق
```

### 5.3 Hotfix Implementation
- أسرع إصلاح آمن (ليس أفضل إصلاح)
- التركيز على إيقاف الضرر فقط
- يمكن تخطي QA و Performance و Documentation
- Security Review مطلوب دائماً

### 5.4 Expedited Review
- **Security Agent:** مراجعة سريعة (أمنية فقط)
- **Architect Agent:** مراجعة سريعة (معمارية فقط)
- **CTO Agent:** موافقة فورية
- لا حاجة لـ QA و Performance و Documentation في هذه المرحلة

## 6. قالب Post-Mortem

```markdown
# Post-Mortem: [Incident Title]

## Summary
[1-2 جمل تصف الحادثة]

## Timeline
- YYYY-MM-DD HH:MM — Detection
- YYYY-MM-DD HH:MM — Notification
- YYYY-MM-DD HH:MM — Fix applied
- YYYY-MM-DD HH:MM — Verification

## Root Cause
[السبب الجذري]

## Impact
- Users affected: X
- Downtime: X minutes
- Data loss: Yes/No (details)

## Resolution
[كيف تم إصلاح المشكلة]

## Preventive Measures
1. [إجراء وقائي 1] — Assigned to: [Agent]
2. [إجراء وقائي 2] — Assigned to: [Agent]

## Lessons Learned
1. [درس 1]
2. [درس 2]
```

## 7. قواعد الطوارئ

1. **السرعة قبل الكمال** — في الطوارئ، السرعة أهم من الجودة (مع الحفاظ على الأمان)
2. **التواصل المستمر** — تحديث الفريق كل 15 دقيقة
3. **التوثيق اللاحق** — post-mortem إلزامي خلال 24 ساعة
4. **منع التكرار** — إجراءات وقائية بعد كل حادثة
5. **عدم إلقاء اللوم** — التركيز على تحسين النظام وليس على الأفراد

## 8. الإشعارات (Notifications)

| الحالة | من يرسل | إلى من | خلال |
|--------|---------|--------|------|
| P0 detected | أي وكيل | CTO + Security + DevOps | فوري |
| Rollback بدأ | DevOps | جميع الوكلاء | 5 دقائق |
| Fix applied | أي وكيل | CTO + المعنيون | فوري |
| Post-mortem جاهز | CTO | جميع الوكلاء | 24 ساعة |
