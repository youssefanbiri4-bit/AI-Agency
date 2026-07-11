# AgentFlow-AI — AI Decision Policy

**وثيقة:** سياسات اتخاذ القرارات في نظام الوكلاء المتعددين  
**النظام:** AgentFlow-AI Multi-Agent Operating System (AOS)  
**الإصدار:** 1.0.0  
**التاريخ:** 2026-07-11

---

## 1. مبادئ اتخاذ القرار (Decision Principles)

1. **مبدأ الأقل صلاحية (Least Privilege)** — كل وكيل لديه فقط الصلاحيات التي يحتاجها
2. **مبدأ المراجعة الإلزامية (Mandatory Review)** — لا قرار بدون مراجعة من المستوى الأعلى
3. **مبدأ الشفافية (Transparency)** — كل القرارات موثقة ومتاحة للتدقيق
4. **مبدأ السرعة (Speed)** — القرارات البسيطة تُتخذ فوراً، القرارات المعقدة تتشاور
5. **مبدأ المسؤولية (Accountability)** — صاحب القرار مسؤول عن نتائجه

---

## 2. مستويات القرار (Decision Levels)

### المستوى 1: قرارات تنفيذية (Execution Decisions)
**من يتخذها:** Backend, Frontend, Database Agents  
**تحتاج موافقة؟** لا  
**أمثلة:**
- اختيار اسم متغير
- ترتيب الكود داخل الدالة
- اختيار نمط CSS
- كتابة اختبارات الوحدة

**القيود:**
- يجب أن تتبع convention المشروع
- لا يمكن تغيير API contracts
- لا يمكن إضافة dependencies جديدة

### المستوى 2: قرارات تقنية (Technical Decisions)
**من يتخذها:** Software Architect Agent  
**تحتاج موافقة؟** نعم — مراجعة من CTO  
**أمثلة:**
- اختيار مكتبة أو إطار عمل
- تصميم API endpoints
- هيكل database schema
- استراتيجية caching

**القيود:**
- لا يمكن تغيير tech stack دون موافقة CTO
- يجب توثيق القرار في Architecture Review Report

### المستوى 3: قرارات إستراتيجية (Strategic Decisions)
**من يتخذها:** CTO Agent  
**تحتاج موافقة المستخدم؟** نعم — دائماً  
**أمثلة:**
- إضافة خدمة خارجية جديدة (مثل Stripe, Resend, Upstash)
- تغيير infrastructure provider
- إعادة هيكلة قاعدة البيانات
- تغيير استراتيجية الأمان

### المستوى 4: قرارات المنتج (Product Decisions)
**من يتخذها:** Product Manager Agent  
**تحتاج موافقة CTO؟** نعم  
**أمثلة:**
- تحديد أولويات الميزات
- نطاق الإصدار (release scope)
- تجربة المستخدم (UX decisions)

---

## 3. مصفوفة القرارات الكاملة (Full Decision Matrix)

| نوع القرار | يقترحه | يراجعه | يوافق عليه | يحتاج المستخدم؟ |
|-----------|--------|--------|-----------|-----------------|
| تغيير UI بسيط | Frontend/UI UX | Frontend | ❌ | ❌ |
| إضافة API endpoint | Backend | Architect | CTO | ❌ |
| تغيير DB schema | Database | Security + Architect | CTO | ✅ |
| إضافة مكتبة | أي وكيل | Security + Architect | CTO | ✅ |
| نشر إلى production | DevOps | جميع المراجعين | CTO | ✅ |
| إصلاح typo | أي وكيل | ❌ | ❌ (Direct commit) | ❌ |
| تغيير RLS policy | Database/Security | Security + Architect | CTO | ✅ |
| إضافة ميزة جديدة | PM | Architect | CTO | ✅ |
| إزالة ميزة | PM | Architect + CTO | المستخدم | ✅ |
| تغيير env vars | DevOps | Security | CTO | ✅ |
| إعادة هيكلة كود | Architect | CTO | CTO | ❌ |
| إلغاء مهمة | PM | CTO | CTO | ✅ |

---

## 4. قواعد الاعتراض (Veto Rules)

### من يمكنه الاعتراض؟
| الوكيل | يستطيع الاعتراض على |
|--------|-------------------|
| **CTO Agent** | أي قرار — الاعتراض النهائي |
| **Security Agent** | أي تغيير يمس الأمان |
| **Architect Agent** | أي تغيير يمس البنية المعمارية |
| **QA Agent** | نشر كود لم يجتز الاختبارات |

### إجراءات الاعتراض
1. يقدم المعترض "Veto Notice" مع السبب
2. يتم إيقاف المهمة فوراً
3. يتم رفع النزاع إلى CTO (إذا لم يكن CTO هو المعترض)
4. CTO يتخذ القرار النهائي

### حالات الاعتراض الإجباري
- **Security Veto** — لا يمكن تجاوزه أبداً
- **Architecture Veto** — يمكن تجاوزه فقط بموافقة CTO + توثيق المخاطر
- **QA Veto** — يمكن تجاوزه فقط للطوارئ (بموافقة CTO)

---

## 5. حالات النزاع (Conflict Resolution)

### نزاع تقني (Technical Conflict)
```
وكيل 1 ←→ وكيل 2
    ↓
رفع إلى Architect Agent
    ↓
إذا لم يُحل → رفع إلى CTO Agent
    ↓
قرار CTO نهائي وملزم
```

### نزاع على الأولويات (Priority Conflict)
```
PM Agent ←→ فريق التنفيذ
    ↓
رفع إلى CTO Agent
    ↓
قرار CTO بناءً على: Business Impact + Technical Risk
```

---

## 6. قواعد الموافقة التلقائية (Auto-Approval Rules)

يمكن الموافقة تلقائياً على التغييرات التالية دون مراجعة بشرية:
| نوع التغيير | الشروط |
|------------|--------|
| تعديل label/i18n | إذا كان في ملفات i18n فقط |
| إصلاح typo | إذا كان في التعليقات أو الـ docs |
| إضافة اختبارات | إذا كانت تغطي كوداً موجوداً |
| تحسين CSS | إذا لم يغير layout الحالي |
|重构 متغير | إذا كانت rename فقط |

**لا يمكن الموافقة تلقائياً على:**
- أي تغيير في business logic
- أي تغيير في database
- أي تغيير في API contracts
- أي تغيير يؤثر على الأمان

---

## 7. قالب تسجيل القرارات (Decision Record Template)

```
---
decision-id: DEC-YYYY-MM-DD-XXX
type: [execution|technical|strategic|product]
status: [proposed|approved|rejected|deferred]
proposed-by: [Agent Name]
reviewed-by: [Agent Name]
approved-by: [Agent Name]
date: YYYY-MM-DD
---

## Decision
[وصف القرار]

## Rationale
[الأسباب]

## Alternatives Considered
1. [البديل 1] — [لماذا لم يُختار]
2. [البديل 2] — [لماذا لم يُختار]

## Risks
- [المخاطر]

## Impact
- Files affected: [قائمة الملفات]
- Performance impact: [لا / نعم - وصف]
- Security impact: [لا / نعم - وصف]

## Approval
- [ ] CTO Reviewed
- [ ] Security Reviewed (إذا لزم الأمر)
- [ ] Architecture Reviewed
```

---

*تم إنشاء هذه الوثيقة كجزء من AgentFlow-AI Multi-Agent Operating System (AOS).*
