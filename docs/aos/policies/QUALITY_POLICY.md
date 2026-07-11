# AgentFlow-AI — Quality Policy

**سياسة:** ضمان الجودة  
**تاريخ التفعيل:** 2026-07-11  
**المراجعة الدورية:** كل 3 أشهر

---

## 1. الهدف

ضمان أن جميع المخرجات (كود، وثائق، تقارير) تلبي معايير الجودة المتفق عليها قبل الوصول إلى المستخدم.

## 2. معايير الجودة

### 2.1 جودة الكود
| المعيار | المستوى المطلوب | القياس |
|---------|-----------------|--------|
| Test Coverage | >= 80% للكود الجديد | Vitest coverage |
| Build Success | 100% | npm run build |
| Lint Errors | 0 | ESLint |
| TypeScript Strict | لا `any` | tsc --noEmit |
| Duplication | < 5% | Code review |

### 2.2 جودة UI/UX
| المعيار | المستوى المطلوب | القياس |
|---------|-----------------|--------|
| Lighthouse Performance | >= 90 | Lighthouse |
| Accessibility | >= 90 (WCAG AA) | axe-core |
| Responsive Design | 3+ screen sizes | Manual check |
| i18n | 100% of UI strings | Review |
| RTL Support | All pages | Manual check |

### 2.3 جودة الوثائق
| المعيار | المستوى المطلوب | القياس |
|---------|-----------------|--------|
| API Documentation | 100% of new endpoints | Review |
| JSDoc Coverage | >= 80% of new functions | Review |
| README Updated | When needed | Review |
| Changelog Updated | Always | Review |

## 3. عملية ضمان الجودة

### 3.1 قبل الـ Sprint
- PM Agent يحدد Acceptance Criteria لكل مهمة
- QA Agent يراجع الـ criteria للتأكد من قابليتها للاختبار
- Architect Agent يؤكد أن الـ criteria واقعية

### 3.2 أثناء الـ Sprint
- الوكيل المنفذ يكتب اختبارات مع الكود
- الوكيل المنفذ يتحقق من الجودة محلياً
- QA Agent يراقب progress

### 3.3 بعد الـ Sprint
- QA Agent ينفذ full regression suite
- QA Agent يقدم تقرير الجودة النهائي
- CTO Agent يراجع التقرير

## 4. أنواع الاختبارات المطلوبة

| نوع الاختبار | التغطية المطلوبة | التكرار |
|-------------|------------------|---------|
| Unit Tests | جميع الدوال الجديدة | مع كل PR |
| Integration Tests | المسارات الحرجة | مع كل PR |
| Smoke Tests | المسارات الرئيسية | بعد كل deploy |
| Regression Tests | جميع الميزات | كل Sprint |
| Accessibility Tests | جميع الصفحات | شهرياً |
| Performance Tests | API endpoints | شهرياً |

## 5. معايير الرفض (Rejection Criteria)

يتم رفض أي تغيير إذا:
- ❌ اختبارات الوحدة فاشلة
- ❌ build فاشل
- ❌ ثغرات أمنية
- ❌ test coverage أقل من 80%
- ❌ lint errors موجودة
- ❌ UI لا يطابق التصميم

## 6. تحسين الجودة المستمر

- Retrospective بعد كل Sprint
- تحليل أسباب الأخطاء
- تحديث test suites بناءً على الأخطاء المكتشفة
- تحسين الـ CI/CD pipeline
- تحديث معايير الجودة بشكل دوري
