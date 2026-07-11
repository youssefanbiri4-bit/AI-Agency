# Rollback Playbook

**دليل:** التراجع عن النشر الفاشل  
**المسؤول:** DevOps Agent  
**الهدف:** استعادة الاستقرار في أقل وقت ممكن

---

## 1. متى نتراجع؟

يتم التراجع إذا ظهر أي من الأعراض التالية بعد النشر:
- 🔴 500 errors على المسارات الحرجة
- 🔴 خطأ في البيانات (data corruption)
- 🔴 تدهور كبير في الأداء (> 50%)
- 🔴 ثغرة أمنية مكشوفة
- 🔴 تعطل ميزة رئيسية بالكامل

## 2. الإجراءات

### الخطوة 1: الإشعار الفوري
```
🚨 ROLLBACK IN PROGRESS
Reason: [سبب التراجع]
Time: [الوقت الحالي]
Assigned: DevOps Agent
Expected Duration: 5-10 minutes
```

### الخطوة 2: التراجع (Rollback)

```bash
# الطريقة 1: Vercel Rollback (موصى بها)
vercel rollback
# هذا يعيد آخر deploy ناجح

# الطريقة 2: Git Revert
git revert HEAD
git push origin main
# انتظر Vercel deploy

# الطريقة 3: Manual Revert
git checkout <last-stable-commit>
git checkout -b hotfix/rollback-YYYYMMDD
git push origin hotfix/rollback-YYYYMMDD
# ثم merge إلى main
```

### الخطوة 3: التحقق بعد التراجع
```bash
# 1. فحص health endpoint
curl https://agentflow-ai-sigma.vercel.app/api/health

# 2. فحص الصفحات الرئيسية
curl -I https://agentflow-ai-sigma.vercel.app

# 3. فحص Sentry
# هل توقف influx of errors؟

# 4. فحص Vercel logs
# هل عادت الأمور إلى طبيعتها؟
```

### الخطوة 4: الإشعار بالاستقرار
```
✅ ROLLBACK COMPLETE
Previous version: [الإصدار السابق]
Current version: [الإصدار المسترجع]
Time to restore: X minutes
Status: Stable
Next: Post-mortem scheduled
```

## 3. بعد التراجع

### Post-Mortem (خلال 24 ساعة)
1. ما سبب الفشل؟
2. لماذا لم يتم اكتشافه قبل النشر؟
3. ما الإجراءات الوقائية لمنع التكرار؟
4. هل نحتاج تحديث CI/CD أو smoke tests؟

### إصلاح المشكلة
1. التحقيق في سبب الفشل
2. إصلاح المشكلة في فرع منفصل
3. اختبار شامل (unit + integration + smoke)
4. المراجعة الكاملة (مع الاهتمام بالسبب الأصلي)
5. النشر مرة أخرى

## 4. الدروس المستفادة

توثيق الدروس المستفادة من كل rollback:
```
Rollback #X
──────────
Date: YYYY-MM-DD
Feature: [اسم الميزة]
Cause: [السبب الجذري]
Detection: [كيف تم اكتشاف المشكلة؟]
Duration: [مدة التعطل]
Impact: [التأثير على المستخدمين]
Prevention: [الإجراءات الوقائية]
```

## 5. المقاييس

| المقياس | الهدف |
|---------|-------|
| Rollback Time | < 5 دقائق |
| Time to Detect | < 5 دقائق |
| Time to Notify | فوري |
| Post-Mortem | < 24 ساعة |
| Rollback Rate | < 5% من النشرات |
