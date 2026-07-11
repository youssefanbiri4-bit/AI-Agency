# AgentFlow-AI — Implementation Workflow

**سير العمل:** تنفيذ المهام  
**المسؤول:** Backend/Frontend/Database Agents  
**المشاركون:** Architect Agent (مراجعة)، QA Agent (اختبار)  
**المدة المقدرة:** حسب حجم المهمة

---

## 1. الهدف

تنفيذ التغييرات المطلوبة في الكود مع الالتزام بمعايير الجودة والأمان والأداء، وإنتاج كود نظيف ومختبر وموثق.

## 2. المخرجات

1. **Code Changes** — التغييرات في الكود
2. **Unit Tests** — اختبارات الوحدة للكود الجديد
3. **Build Pass** — `npm run build` ينجح
4. **Tests Pass** — `npm test` ينجح

## 3. الخطوات

### الخطوة 1: الإعداد
- قراءة Requirements Document من PM Agent
- قراءة Architecture Review من Architect Agent
- فهم التصميم والتأثير على الكود الحالي
- تحديد الملفات التي سيتم تعديلها

### الخطوة 2: التنفيذ
- كتابة الكود وفقاً للـ conventions
- اتباع المبادئ التالية:
  - **DRY** (Don't Repeat Yourself)
  - **KISS** (Keep It Simple, Stupid)
  - **SOLID** (للـ OOP)
  - **YAGNI** (You Ain't Gonna Need It)
- إضافة التعليقات JSDoc للدوال الجديدة
- إضافة i18n labels للـ UI

### الخطوة 3: الاختبار
- كتابة اختبارات وحدة للتغييرات الجديدة
- التأكد من أن جميع الاختبارات الحالية لا تزال تمر
- اختبار edge cases
- اختبار error scenarios

### الخطوة 4: التحقق
```
✅ npm run build → PASS
✅ npm run test → PASS
✅ npm run lint → NO ERRORS
✅ npm run typecheck → NO ERRORS
```

### الخطوة 5: رفع التغييرات
- إنشاء Pull Request مع وصف واضح
- تضمين قائمة الملفات المتأثرة
- تضمين نتائج الاختبارات
- إسناد الـ PR إلى Architect Agent للمراجعة

## 4. قالب Pull Request

```markdown
## Description
[وصف التغيير]

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Improvement
- [ ] Documentation

## Files Changed
- file1.ts: [وصف التغيير]
- file2.ts: [وصف التغيير]

## Test Coverage
- Unit tests: XX new, XX modified
- Coverage: XX%

## Verification
- [ ] Build passes
- [ ] Tests pass
- [ ] Lint passes
- [ ] Typecheck passes

## Related Issues
Closes #XXX
```

## 5. قواعد التنفيذ

1. لا تبدأ التنفيذ قبل اكتمال Architecture Review
2. اكتب الاختبارات قبل الكود (TDD) حيثما أمكن
3. لا تترك تعليقات قديمة أو debug code
4. لا تكرر الكود الموجود
5. استخدم المكتبات الموجودة بدلاً من إضافة مكتبات جديدة
6. أضف error handling لكل possible failure point
7. استخدم logging بدلاً من console.log
