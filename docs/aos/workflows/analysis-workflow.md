# AgentFlow-AI — Analysis Workflow

**سير العمل:** تحليل المتطلبات  
**المسؤول:** Product Manager Agent  
**المشاركون:** CTO Agent, Architect Agent  
**المدة المقدرة:** 1-4 ساعات

---

## 1. الهدف

تحليل طلب المستخدم وتحويله إلى متطلبات واضحة ومفهومة للفريق التقني، مع تحديد الأولويات والنطاق والتقديرات الزمنية.

## 2. المخرجات

1. **Requirements Document** — وثيقة المتطلبات الكاملة
2. **Task Breakdown** — تقسيم المهمة إلى مهام فرعية
3. **Effort Estimation** — تقدير الجهد والوقت
4. **Priority Assessment** — تقييم الأولوية

## 3. الخطوات

### الخطوة 1: استلام الطلب
- استلام الطلب من المستخدم
- توثيق الطلب في قالب موحد
- تحديد نوع الطلب (ميزة جديدة، إصلاح خطأ، تحسين)

### الخطوة 2: تحليل أولي
- تحديد النطاق (Scope)
- تحديد التأثير على الميزات الحالية
- تحديد المخاطر المحتملة
- تصنيف الأولوية (Critical, High, Medium, Low)

### الخطوة 3: توضيح المتطلبات
- التواصل مع المستخدم لتوضيح أي غموض
- كتابة Acceptance Criteria
- تحديد حالات الاستخدام (Use Cases)

### الخطوة 4: تقسيم المهمة
- تقسيم المهمة إلى مهام أصغر قابلة للتنفيذ
- تحديد التبعيات بين المهام
- تقدير وقت كل مهمة

### الخطوة 5: تقييم الأولوية
```
Impact (Business Value):
  1-5: How much value does this add?
Effort (Implementation Cost):
  1-5: How much effort is required?
Priority Score = Impact - Effort
  High: Score >= 2
  Medium: Score 0-1
  Low: Score < 0
```

### الخطوة 6: تسليم Requirements Document
- توثيق جميع النتائج في Requirements Document
- تسليم الوثيقة إلى Architect Agent للمراجعة
- انتظار الموافقة من CTO Agent

## 4. معايير القبول

- ✅ جميع المتطلبات موثقة وواضحة
- ✅ النطاق محدد بدقة
- ✅ الأولويات محددة بناءً على Impact vs Effort
- ✅ تقدير الوقت معقول ومدعوم بأسباب
- ✅ المخاطر محددة وموثقة
- ✅ جميع الأسئلة من المستخدم تم توضيحها

## 5. قالب Requirements Document

```markdown
# Requirements Document: [Feature Name]

## Summary
[1-2 جمل تلخص الميزة]

## Business Value
[ما القيمة التي تضيفها هذه الميزة للمستخدم؟]

## Acceptance Criteria
- [ ] AC1: [Description]
- [ ] AC2: [Description]
- [ ] AC3: [Description]

## Technical Notes (optional)
[ملاحظات تقنية من PM]

## Affected Areas
- [Area 1]
- [Area 2]

## Dependencies
- [Dependency 1]
- [Dependency 2]

## Estimated Effort
- **Backend:** X hours
- **Frontend:** X hours
- **Database:** X hours
- **Total:** X hours

## Priority
- **Score:** [Impact - Effort]
- **Level:** [High|Medium|Low]
```

## 6. قواعد التحليل

1. لا تبدأ التنفيذ قبل اكتمال التحليل
2. توثيق كل افتراض مع علامة (Assumption)
3. استخدام لغة واضحة خالية من الغموض
4. تحديد الأولويات بناءً على بيانات وليس تخمين
5. مراجعة المتطلبات مع المستخدم قبل التسليم
