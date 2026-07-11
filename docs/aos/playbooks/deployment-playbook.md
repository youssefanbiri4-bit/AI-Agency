# Deployment Playbook

**دليل:** نشر التغييرات إلى production  
**المسؤول:** DevOps Agent  
**التكرار:** مع كل إصدار

---

## 1. قبل النشر

### التحقق من الشروط
```bash
# 1. التأكد من أن الاختبارات تمر
npm run build
npm test
npm run lint
npm run typecheck

# 2. التأكد من أن جميع المراجعات مكتملة
# تحقق من GitHub: جميع PRs المعنية have ✅ reviews

# 3. التأكد من الفرع
git checkout main
git pull origin main
git log --oneline -5  # تحقق من آخر commits
```

### قائمة التحقق
- [ ] جميع Code Reviews: ✅
- [ ] جميع QA Reviews: ✅
- [ ] جميع Security Reviews: ✅
- [ ] جميع Performance Reviews: ✅
- [ ] CTO Approval: ✅
- [ ] CI/CD pipeline أخضر
- [ ] Rollback plan جاهز
- [ ] النشر في الوقت المسموح
- [ ] إشعار الفريق قبل 15 دقيقة

## 2. أثناء النشر

```bash
# 1. Merge إلى main
git checkout main
git merge feature-branch
git push origin main

# 2. انتظر Vercel deploy (مراقبة GitHub Actions)
# أو استخدم Vercel CLI:
vercel --prod

# 3. مراقبة logs
vercel logs
```

## 3. بعد النشر

### Smoke Tests
```bash
# 1. فحص الصفحات الرئيسية
curl -I https://agentflow-ai-sigma.vercel.app
curl -I https://agentflow-ai-sigma.vercel.app/api/health
curl -I https://agentflow-ai-sigma.vercel.app/auth/login

# 2. فحص Sentry
# افتح Sentry Dashboard: لا errors جديدة؟

# 3. فحص Vercel logs
# لا 500 errors؟
```

### قائمة التحقق بعد النشر
- [ ] Smoke tests: ✅
- [ ] Sentry: لا errors جديدة ✅
- [ ] Vercel: لا أخطاء ✅
- [ ] المسار الجديد يعمل ✅
- [ ] API يعمل ✅
- [ ] UI سليم ✅

## 4. في حالة الفشل

```bash
# Rollback فوري
vercel rollback

# أو revert git commit
git revert HEAD
git push origin main

# إشعار الفريق
# فتح bug report
# بدء post-mortem
```

## 5. الإشعارات

| المرحلة | إلى من | المحتوى |
|---------|--------|---------|
| قبل النشر بـ 15 دقيقة | جميع الوكلاء | "Deploying [feature] to production" |
| بعد النشر الناجح | جميع الوكلاء | "Deploy successful. Smoke tests passed." |
| في حالة الفشل | جميع الوكلاء | "Deploy failed. Rollback initiated." |
