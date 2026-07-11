# AgentFlow-AI — AI Operating Manual

**وثيقة:** دليل التشغيل الشامل لنظام AOS  
**النظام:** AgentFlow-AI Multi-Agent Operating System (AOS)  
**الإصدار:** 1.0.0  
**التاريخ:** 2026-07-11

---

## 1. مقدمة (Introduction)

دليل التشغيل الشامل (Operating Manual) هو المرجع النهائي لكيفية عمل نظام AgentFlow-AI AOS. يشرح هذا الدليل كيفية بدء استخدام النظام، وكيفية تنفيذ المهام، وكيفية التعامل مع الحالات المختلفة.

---

## 2. بدء الاستخدام (Getting Started)

### 2.1 متطلبات التشغيل

- Node.js >= 20.9.0
- Supabase project مع migrations مطبّقة
- n8n instance (للتنفيذ)
- Redis / Upstash (للـ queues)
- Vercel account (للنشر)

### 2.2 الخطوات الأولى

```
1. Clone the repository
2. npm install
3. Copy .env.example to .env.local
4. Fill in required environment variables
5. supabase start (local) or use production project
6. npm run dev
```

### 2.3 التحقق من التشغيل

```bash
npm run build      # يجب أن ينجح بدون أخطاء
npm test           # يجب أن تمر جميع الاختبارات
npm run lint       # يجب أن يكون بدون أخطاء
npm run dev        # يجب أن يعمل التطبيق محلياً
```

---

## 3. دورة حياة المهمة (Task Lifecycle)

### 3.1 إنشاء مهمة جديدة

1. **PM Agent** يستلم الطلب من المستخدم
2. **PM Agent** يحلل المتطلبات وينشئ Requirements Document
3. **Architect Agent** يراجع المتطلبات وينشئ Architecture Review
4. **CTO Agent** يوافق على التصميم
5. **Architect Agent** يعين المهمة للوكيل المناسب (Backend/Frontend/Database)

### 3.2 تنفيذ المهمة

1. الوكيل المنفذ يقرأ المتطلبات والتصميم
2. الوكيل ينفذ التغييرات
3. الوكيل يكتب اختبارات
4. الوكيل يتأكد من أن `npm run build` و `npm test` يمران
5. الوكيل يرفع Pull Request

### 3.3 مراجعة المهمة

1. **Architect Agent** يراجع الكود
2. **QA Agent** يختبر الجودة
3. **Security Agent** يراجع الأمان
4. **Performance Agent** يراجع الأداء
5. **Documentation Agent** يتحقق من التوثيق
6. **CTO Agent** يعطي الموافقة النهائية

### 3.4 نشر المهمة

1. **DevOps Agent** ينشر إلى production
2. **QA Agent** يتحقق من العمل بعد النشر
3. **CTO Agent** يؤكد نجاح النشر

---

## 4. كيفية استخدام النظام (How to Use the System)

### 4.1 للمستخدمين (للتحدث مع وكلاء AI)

عند التحدث مع نظام AOS، استخدم الصيغة التالية:

```
أحتاج إلى [المهمة] في [المنطقة]
المتطلبات:
- [متطلب 1]
- [متطلب 2]
الأولوية: [عالية/متوسطة/منخفضة]
الموعد النهائي: [التاريخ]
```

**مثال:**
```
أحتاج إلى إضافة ميزة تصدير التقارير بصيغة CSV في صفحة التقارير
المتطلبات:
- تصدير كل التقارير في workspace
- دعم الفلاتر الحالية
الأولوية: عالية
الموعد النهائي: 2026-07-18
```

### 4.2 للوكلاء (للوكلاء AI)

عند بدء مهمة جديدة، يجب على الوكيل:

1. **قراءة** جميع الوثائق المرتبطة بالمهمة
2. **تحليل** تأثير التغيير على النظام الحالي
3. **التواصل** مع الوكلاء الآخرين حسب الحاجة
4. **التنفيذ** مع الالتزام بالسياسات والقواعد
5. **التوثيق** لكل ما تم تغييره
6. **رفع** التقرير النهائي

---

## 5. حالات الاستخدام الشائعة (Common Use Cases)

### 5.1 إضافة API endpoint جديد

```
1. PM Agent: تحليل المتطلبات
2. Architect Agent: مراجعة التصميم (RESTful، توافق مع endpoints الحالية)
3. CTO Agent: الموافقة
4. Backend Agent: تنفيذ الـ route + Zod validation + اختبارات
5. Backend Agent: التأكد من build + test
6. Architect Agent: مراجعة الكود
7. QA Agent: اختبار الـ endpoint
8. Security Agent: مراجعة أمنية (input validation, rate limiting)
9. Performance Agent: اختبار الأداء
10. Documentation Agent: توثيق API
11. CTO Agent: موافقة نهائية
12. DevOps Agent: نشر
```

### 5.2 تغيير قاعدة البيانات (Database Migration)

```
1. Database Agent: كتابة migration SQL
2. Architect Agent: مراجعة الـ schema
3. Security Agent: مراجعة RLS policies
4. Performance Agent: مراجعة indexes
5. CTO Agent: موافقة
6. DevOps Agent: تطبيق migration
7. Database Agent: التحقق من البيانات
```

### 5.3 إصلاح خطأ عاجل (Hotfix)

```
1. Security/DevOps Agent: اكتشاف الخطأ
2. إشعار CTO Agent (خلال 15 دقيقة)
3. Backend/Frontend Agent: تنفيذ الإصلاح
4. Security Agent: مراجعة سريعة
5. CTO Agent: موافقة عاجلة
6. DevOps Agent: نشر عاجل
7. QA Agent: تحقق بعد النشر
8. Documentation Agent: post-mortem خلال 24 ساعة
```

---

## 6. أدوات النظام (System Tools)

### 6.1 القوالب (Templates)

جميع القوالب موجودة في `docs/aos/templates/`:
| القالب | الاستخدام |
|--------|-----------|
| `AGENT_REPORT_TEMPLATE.md` | تقارير الوكلاء العامة |
| `ARCHITECTURE_REVIEW_TEMPLATE.md` | مراجعة معمارية |
| `SECURITY_REVIEW_TEMPLATE.md` | مراجعة أمنية |
| `CODE_REVIEW_TEMPLATE.md` | مراجعة كود |

### 6.2 سير العمل (Workflows)

جميع سير العمل موجودة في `docs/aos/workflows/`:
| سير العمل | الاستخدام |
|-----------|-----------|
| `analysis-workflow.md` | تحليل المتطلبات |
| `implementation-workflow.md` | تنفيذ المهام |
| `review-workflow.md` | مراجعة المخرجات |
| `deployment-workflow.md` | النشر |
| `emergency-workflow.md` | حالات الطوارئ |

### 6.3 أدلة التشغيل (Playbooks)

جميع أدلة التشغيل موجودة في `docs/aos/playbooks/`:
| الدليل | الاستخدام |
|--------|-----------|
| `incident-response.md` | الاستجابة للحوادث |
| `deployment-playbook.md` | دليل النشر |
| `rollback-playbook.md` | دليل التراجع |

---

## 7. التواصل بين الوكلاء (Agent Communication)

### 7.1 متى تتواصل مع وكيل آخر؟

| الحالة | التواصل مع |
|--------|------------|
| تحتاج تصميم API | Architect Agent |
| تحتاج مراجعة أمنية | Security Agent |
| تحتاج اختبارات | QA Agent |
| تحتاج نشر | DevOps Agent |
| تحتاج توثيق | Documentation Agent |
| غير متأكد من أولوية | PM Agent |
| نزاع تقني | CTO Agent |

### 7.2 صيغة التواصل

اتبع دائماً بروتوكول التواصل الموحد في `AI_COMMUNICATION_PROTOCOL.md`:
1. `message-id` — معرف فريد
2. `from` — هويتك
3. `to` — المستلم
4. `type` — نوع الرسالة
5. `priority` — الأولوية
6. `summary` — ملخص
7. `findings` — النتائج
8. `risks` — المخاطر
9. `recommendation` — التوصية
10. `confidence` — مستوى الثقة
11. `next-step` — الخطوة التالية

---

## 8. قواعد ذهبية (Golden Rules)

### القاعدة 1: لا تتخطى المراجعة
```
Never skip a review step. No matter how small the change.
```

### القاعدة 2: وثّق كل شيء
```
If it's not documented, it didn't happen.
```

### القاعدة 3: اسأل إذا كنت غير متأكد
```
When in doubt, ask. Better to ask than to break production.
```

### القاعدة 4: الأمان أولاً
```
Security is not a feature. It's a requirement.
```

### القاعدة 5: الجودة مسؤولية الجميع
```
Quality is not the QA Agent's job. It's everyone's job.
```

---

## 9. مؤشرات الأداء الرئيسية (KPIs)

| المؤشر | الهدف | القياس |
|--------|-------|--------|
| **Sprint Velocity** | XX points/sprint | Sum of completed task estimates |
| **Cycle Time** | < 48 hours | Request to deploy |
| **Test Coverage** | >= 80% | Vitest coverage report |
| **Build Success** | 100% | npm run build |
| **Code Review Pass** | >= 80% | Passed / Total reviews |
| **Deploy Success** | >= 99% | Successful / Total deploys |
| **Incident Response** | < 15 min | Time to first response |
| **Documentation** | 100% | Required docs completed |

---

## 10. استكشاف الأخطاء وإصلاحها (Troubleshooting)

### Build فاشل
```
1. تحقق من TypeScript errors: npm run typecheck
2. تحقق من ESLint: npm run lint
3. تحقق من الملفات المتأثرة مؤخراً
4. استشر Architect Agent
```

### اختبارات فاشلة
```
1. تحقق من أي تغييرات في dependencies
2. تحقق من mock data
3. تحقق من التغييرات في API contracts
4. استشر QA Agent
```

### خطأ إنتاجي
```
1. تحقق من Sentry dashboard
2. تحقق من Vercel logs
3. استشر DevOps Agent فوراً
4. ابدأ incident-response-playbook
```

---

*تم إنشاء هذه الوثيقة كجزء من AgentFlow-AI Multi-Agent Operating System (AOS).*
