# AgentFlow-AI — Review Workflow

**سير العمل:** مراجعة المخرجات  
**المسؤول:** Software Architect Agent  
**المشاركون:** Security Agent, QA Agent, Performance Agent, Documentation Agent, CTO Agent  
**المدة المقدرة:** 2-8 ساعات (حسب حجم التغيير)

---

## 1. الهدف

ضمان أن كل تغيير يمر بمراجعات جودة وأمان وأداء وتوثيق قبل الوصول إلى الإنتاج.

## 2. المخرجات

1. **Code Review Report** — تقييم الكود
2. **QA Report** — تقييم الجودة والاختبارات
3. **Security Review Report** — تقييم أمني
4. **Performance Review Report** — تقييم الأداء
5. **Documentation Report** — تقييم التوثيق
6. **Final Approval** — الموافقة النهائية من CTO

## 3. مراحل المراجعة

```
[PR Submitted] → [Architect Code Review]
                        ↓
             [PASS?] ───┴─── [FAIL] → العودة للتنفيذ
                        ↓
                  [QA Testing]
                        ↓
             [PASS?] ───┴─── [FAIL] → العودة للتنفيذ
                        ↓
              [Security Review]
                        ↓
             [PASS?] ───┴─── [BLOCKED] → العودة للتنفيذ
                        ↓
             [Performance Review]
                        ↓
             [PASS?] ───┴─── [FAIL] → العودة للتنفيذ
                        ↓
            [Documentation Check]
                        ↓
             [PASS?] ───┴─── [FAIL] → العودة للتنفيذ
                        ↓
             [CTO Final Approval]
                        ↓
             [PASS?] ───┴─── [REJECTED] → إلغاء المهمة
                        ↓
                   [Ready to Deploy]
```

## 4. تفصيل المراجعات

### 4.1 Code Review (Architect Agent)
**المدة:** 1-3 ساعات

**Checklist:**
- [ ] الكود يتبع ESLint rules
- [ ] TypeScript types صحيحة
- [ ] لا duplicated code
- [ ] error handling مناسب
- [ ] naming conventions صحيحة
- [ ] project structure صحيح
- [ ] لا debug code أو تعليقات قديمة

### 4.2 QA Review (QA Agent)
**المدة:** 2-4 ساعات

**Checklist:**
- [ ] جميع unit tests تمر
- [ ] integration tests تمر
- [ ] edge cases مغطاة
- [ ] test coverage >= 80%
- [ ] لا اختبارات مفقودة
- [ ] smoke tests تعمل

### 4.3 Security Review (Security Agent)
**المدة:** 1-2 ساعات

**Checklist:**
- [ ] لا secrets مكشوفة
- [ ] RLS policies صحيحة
- [ ] input validation موجود
- [ ] rate limiting مطبّق
- [ ] لا SQL injection
- [ ] لا XSS vulnerabilities
- [ ] CSP headers صحيحة

### 4.4 Performance Review (Performance Agent)
**المدة:** 1-2 ساعات

**Checklist:**
- [ ] لا N+1 queries
- [ ] API response time ضمن الحدود
- [ ] bundle size مناسب
- [ ] لا rendering غير ضروري
- [ ] database queries محسّنة

### 4.5 Documentation Review (Documentation Agent)
**المدة:** 30 دقيقة - ساعة

**Checklist:**
- [ ] API endpoints الجديدة موثقة
- [ ] JSDoc موجود للدوال الجديدة
- [ ] README محدّث (إذا لزم الأمر)
- [ ] ARCHITECTURE.md محدّث (إذا لزم الأمر)
- [ ] changelog محدّث

## 5. نتائج المراجعة

| النتيجة | المعنى | الإجراء |
|---------|--------|---------|
| ✅ PASS | جاهز للمرحلة التالية | الانتقال للمرحلة التالية |
| ⚠️ PASS WITH COMMENTS | مقبول مع ملاحظات غير حرجة | الانتقال مع معالجة الملاحظات لاحقاً |
| ❌ CHANGES REQUIRED | تغييرات مطلوبة قبل المتابعة | العودة إلى مرحلة التنفيذ |
| 🔴 BLOCKED | لا يمكن المتابعة أبداً | مراجعة CTO + إعادة تقييم |

## 6. قواعد المراجعة

1. كل مراجعة يجب أن تكون موضوعية ومدعومة بأدلة
2. النقد البنّاء مع اقتراحات للتحسين
3. احترام وقت الآخرين (المراجعة في أسرع وقت ممكن)
4. التركيز على الكود وليس على الشخص
5. توثيق كل finding مع location
6. في حالة disagreement، الرفع إلى المستوى الأعلى
