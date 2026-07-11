# AgentFlow-AI — AOS Directory Structure

**وثيقة:** هيكل المجلدات لنظام تشغيل الوكلاء المتعددين  
**النظام:** AgentFlow-AI Multi-Agent Operating System (AOS)  
**الإصدار:** 1.0.0  
**التاريخ:** 2026-07-11

---

## 1. الهيكل العام (Overall Structure)

```
docs/aos/
├── AI_TEAM_CHARTER.md              # ميثاق الفريق — الرؤية، الرسالة، القيم، المبادئ
├── AI_ORGANIZATION.md               # الهيكل التنظيمي — المستويات، الأدوار، شجرة التقارير
├── AI_WORKFLOW.md                   # سير العمل — المراحل الإجبارية، التدفقات، حالات الطوارئ
├── AI_DECISION_POLICY.md            # سياسات القرار — من يقرر ماذا وكيف
├── AI_COMMUNICATION_PROTOCOL.md     # بروتوكول التواصل — صيغة الرسائل الموحدة
├── AI_AGENT_TEMPLATES.md            # قوالب تعريف الوكلاء — النماذج والقوالب
├── AI_REPORT_TEMPLATES.md           # قوالب التقارير — معايير التقارير الموحدة
├── AI_DIRECTORY_STRUCTURE.md        # هيكل المجلدات — هذه الوثيقة
├── AI_OPERATING_MANUAL.md           # دليل التشغيل — كيفية استخدام النظام
│
├── agents/                          # تعريفات الوكلاء الفردية
│   ├── CTO_AGENT.md
│   ├── ARCHITECT_AGENT.md
│   ├── BACKEND_AGENT.md
│   ├── FRONTEND_AGENT.md
│   ├── DATABASE_AGENT.md
│   ├── SECURITY_AGENT.md
│   ├── DEVOPS_AGENT.md
│   ├── QA_AGENT.md
│   ├── DOCUMENTATION_AGENT.md
│   ├── PRODUCT_MANAGER_AGENT.md
│   ├── UI_UX_AGENT.md
│   ├── PERFORMANCE_AGENT.md
│   └── AI_ENGINEER_AGENT.md
│
├── workflows/                       # تعريفات سير العمل المخصصة
│   ├── analysis-workflow.md         # سير عمل التحليل
│   ├── implementation-workflow.md   # سير عمل التنفيذ
│   ├── review-workflow.md           # سير عمل المراجعة
│   ├── deployment-workflow.md       # سير عمل النشر
│   └── emergency-workflow.md        # سير عمل الطوارئ
│
├── policies/                        # السياسات الإلزامية
│   ├── CODE_REVIEW_POLICY.md        # سياسة مراجعة الكود
│   ├── SECURITY_POLICY.md           # سياسة الأمان
│   ├── QUALITY_POLICY.md            # سياسة الجودة
│   └── CHANGE_MANAGEMENT_POLICY.md  # سياسة إدارة التغيير
│
├── templates/                       # قوالب قابلة لإعادة الاستخدام
│   ├── AGENT_REPORT_TEMPLATE.md     # قالب تقرير الوكيل
│   ├── ARCHITECTURE_REVIEW_TEMPLATE.md  # قالب المراجعة المعمارية
│   ├── SECURITY_REVIEW_TEMPLATE.md  # قالب المراجعة الأمنية
│   └── CODE_REVIEW_TEMPLATE.md      # قالب مراجعة الكود
│
└── playbooks/                       # أدلة التشغيل للحالات المختلفة
    ├── incident-response.md         # الاستجابة للحوادث
    ├── deployment-playbook.md       # دليل النشر
    └── rollback-playbook.md         # دليل التراجع
```

---

## 2. شرح كل مجلد (Directory Explanations)

### 2.1 `docs/aos/` — جذر النظام

**الغرض:** المستوى الأعلى لنظام AOS. يحتوي على الوثائق الأساسية التي تحدد النظام بأكمله.

**متى يُستخدم:**
- عند بدء مشروع جديد — اقرأ AI_TEAM_CHARTER.md و AI_ORGANIZATION.md
- عند اتخاذ قرار — ارجع إلى AI_DECISION_POLICY.md
- عند التواصل مع وكيل آخر — اتبع AI_COMMUNICATION_PROTOCOL.md
- عند إنشاء تقرير — استخدم AI_REPORT_TEMPLATES.md

### 2.2 `agents/` — تعريفات الوكلاء

**الغرض:** تعريف كل وكيل AI في النظام. وثيقة واحدة لكل وكيل تحتوي على مسؤوليته وصلاحياته ومخرجاته.

**متى يُستخدم:**
- عند إضافة وكيل جديد — أنشئ ملفاً جديداً باستخدام AI_AGENT_TEMPLATES.md
- عند تعيين مهمة — راجع تعريف الوكيل المناسب
- عند مراجعة كود وكيل — راجع صلاحياته وقيوده

**محتوى كل ملف:**
```yaml
- agent.id: المعرف الفريد
- agent.name: الاسم
- agent.level: المستوى (L2/L3/L4)
- mission: المهمة
- responsibilities: المسؤوليات
- permissions: الصلاحيات
- limitations: القيود
- inputs: المدخلات المطلوبة
- outputs: المخرجات المتوقعة
- reports: التقارير المطلوبة
- kpis: مؤشرات الأداء
- rules: القواعد
- success-criteria: معايير النجاح
```

### 2.3 `workflows/` — سير العمل

**الغرض:** تعريفات مفصلة لسير العمل المختلفة التي قد يحتاجها الفريق.

**متى يُستخدم:**
- **analysis-workflow:** عند تحليل متطلبات ميزة جديدة
- **implementation-workflow:** عند تنفيذ مهمة جديدة
- **review-workflow:** عند مراجعة كود أو تصميم
- **deployment-workflow:** عند النشر إلى production
- **emergency-workflow:** في حالات الطوارئ

### 2.4 `policies/` — السياسات

**الغرض:** السياسات الإلزامية التي تنظم عمل الفريق.

**متى يُستخدم:**
- **CODE_REVIEW_POLICY.md:** قبل كل مراجعة كود
- **SECURITY_POLICY.md:** قبل كل تغيير أمني
- **QUALITY_POLICY.md:** قبل كل إصدار
- **CHANGE_MANAGEMENT_POLICY.md:** عند أي تغيير في النظام

### 2.5 `templates/` — القوالب

**الغرض:** قوابل جاهزة للاستخدام لتوحيد مخرجات الفريق.

**متى يُستخدم:**
- نسخ القالب المناسب وتعبئته
- تحويل القالب المملوء إلى تقرير في `reports/`

### 2.6 `playbooks/` — أدلة التشغيل

**الغرض:** أدلة خطوة بخطوة للحالات المختلفة.

**متى يُستخدم:**
- **incident-response.md:** عند حدوث حادث أمني أو إنتاجي
- **deployment-playbook.md:** قبل وأثناء وبعد كل نشر
- **rollback-playbook.md:** عند فشل النشر

---

## 3. هيكل التقارير (Reports Structure)

عند إنشاء تقارير جديدة بناءً على القوالب، تُحفظ في:

```
docs/aos/reports/
├── architecture/         # تقارير المراجعة المعمارية
│   └── ARCH-YYYYMMDD-XXXXX.md
├── security/            # تقارير المراجعة الأمنية
│   └── SEC-YYYYMMDD-XXXXX.md
├── qa/                  # تقارير الجودة
│   └── QA-YYYYMMDD-XXXXX.md
├── performance/         # تقارير الأداء
│   └── PERF-YYYYMMDD-XXXXX.md
├── code-review/         # تقارير مراجعة الكود
│   └── CR-YYYYMMDD-XXXXX.md
└── health/              # تقارير صحة المشروع
    └── PHR-YYYY-MM-DD.md
```

---

## 4. اصطلاحات التسمية (Naming Conventions)

| النوع | الصيغة | مثال |
|-------|--------|------|
| وثائق النظام | `AI_${NAME}.md` | `AI_TEAM_CHARTER.md` |
| تعريفات الوكلاء | `${AGENT}_AGENT.md` | `BACKEND_AGENT.md` |
| سير العمل | `${name}-workflow.md` | `analysis-workflow.md` |
| السياسات | `${NAME}_POLICY.md` | `SECURITY_POLICY.md` |
| القوالب | `${NAME}_TEMPLATE.md` | `ARCHITECTURE_REVIEW_TEMPLATE.md` |
| أدلة التشغيل | `${name}-playbook.md` | `deployment-playbook.md` |
| التقارير | `${TYPE}-YYYYMMDD-XXXXX.md` | `SEC-20260711-00001.md` |

---

## 5. كيفية إضافة وكيل جديد (Adding a New Agent)

1. أنشئ ملف التعريف في `agents/` باستخدام القالب من `AI_AGENT_TEMPLATES.md`
2. أضف الوكيل إلى مصفوفة المسؤوليات في `AI_ORGANIZATION.md`
3. أضف الوكيل إلى شجرة التقارير في `AI_ORGANIZATION.md`
4. حدد مسار سير العمل المناسب في `AI_WORKFLOW.md`
5. أضف صلاحيات القرار في `AI_DECISION_POLICY.md`

---

## 6. كيفية إضافة سير عمل جديد (Adding a New Workflow)

1. أنشئ ملف التعريف في `workflows/`
2. أضف المراحل في `AI_WORKFLOW.md`
3. حدد المسؤوليات لكل مرحلة
4. أضف أي قوالب تقارير جديدة في `templates/`

---

*تم إنشاء هذه الوثيقة كجزء من AgentFlow-AI Multi-Agent Operating System (AOS).*
