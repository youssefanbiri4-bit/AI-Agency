# AgentFlow-AI — Deployment Workflow

**سير العمل:** نشر التغييرات إلى production  
**المسؤول:** DevOps Agent  
**المشاركون:** جميع الوكلاء  
**المدة المقدرة:** 30 دقيقة - ساعة

---

## 1. الهدف

نشر التغييرات المعتمدة إلى البيئة الإنتاجية بأمان، مع التحقق من أن كل شيء يعمل بشكل صحيح بعد النشر.

## 2. المخرجات

1. **Deployment Report** — تقرير النشر
2. **Post-Deploy Verification** — تحقق من العمل بعد النشر
3. **Rollback Plan** — خطة التراجع في حالة الفشل (جاهزة دائماً)

## 3. شروط ما قبل النشر (Pre-Deployment Checklist)

قبل أي نشر إلى production، يجب التحقق من:

```
[ ] جميع مراجعات Code Review: PASS
[ ] جميع مراجعات QA: PASS
[ ] جميع مراجعات Security: PASS
[ ] جميع مراجعات Performance: PASS
[ ] جميع مراجعات Documentation: PASS
[ ] CTO Approval: GRANTED
[ ] جميع الاختبارات تمر في CI
[ ] الفرع محدّث مع main
[ ] rollback plan جاهز
[ ] النشر في الوقت المسموح (ليس بعد 8 مساءً)
```

## 4. الخطوات

### الخطوة 1: التحضير
- التأكد من أن الفرع (branch) محدّث
- تشغيل pre-deployment checks
- إعداد rollback plan
- إشعار الفريق بالنشر القادم

### الخطوة 2: النشر
```
# Merge to main (if not already)
git checkout main
git merge feature-branch
git push origin main

# Vercel deploy (automatic with GitHub integration)
# Or manual deploy:
vercel --prod
```

### الخطوة 3: التحقق بعد النشر (Post-Deploy)
- تشغيل smoke tests
- التحقق من أن الصفحات الرئيسية تتحمل
- التحقق من أن API endpoints تعمل
- مراجعة Sentry logs
- مراجعة Vercel logs

### الخطوة 4: التأكيد
- إشعار الفريق بنجاح النشر
- تحديث changelog
- إغلاق المهمة
- توثيق النشر

## 5. Post-Deployment Smoke Tests

```typescript
// Required smoke tests after every deployment

describe('Post-Deploy Smoke Tests', () => {
  test('Home page loads successfully', async () => { ... });
  test('Auth page loads successfully', async () => { ... });
  test('Dashboard page loads successfully', async () => { ... });
  test('API health check returns 200', async () => { ... });
  test('Task creation works', async () => { ... });
  test('No 500 errors on critical pages', async () => { ... });
});
```

## 6. خطة التراجع (Rollback Plan)

### متى نتراجع؟
- 500 errors على المسارات الحرجة
- خطأ في البيانات (data corruption)
- تدهور كبير في الأداء
- ثغرة أمنية

### إجراءات التراجع
```
1. إشعار الفريق فوراً: "Rollback in progress"
2. التراجع إلى الإصدار السابق:
   vercel rollback
   git revert HEAD
3. تشغيل smoke tests على الإصدار المسترجع
4. توثيق سبب التراجع
5. فتح bug report للتحقيق
```

## 7. قواعد النشر

1. لا نشر بعد الساعة 8 مساءً (إلا للطوارئ)
2. لا نشر في عطلة نهاية الأسبوع (إلا للطوارئ)
3. smoke tests إلزامية بعد كل نشر
4. إشعار الفريق قبل النشر بـ 15 دقيقة
5. rollback plan إلزامي لكل نشر
6. توثيق كل نشر في changelog
