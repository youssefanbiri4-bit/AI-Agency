# تقرير إصلاح دعم RTL الشامل

**التاريخ:** 14 مايو 2026  
**المشروع:** AgentFlow AI — لوحة تحكم ذكاء اصطناعي (Next.js + Supabase + n8n)  
**الهدف:** تحقيق دعم كامل للغة العربية والاتجاه من اليمين إلى اليسار (RTL) بجودة إنتاجية

---

## 1. الإصلاحات الجذرية (Infrastructure)

### 1.1 نقل LanguageProvider إلى التخطيط الجذر (Root Layout)
- **الملف:** `src/app/layout.tsx`
- غُلف `<LanguageProvider>` حول عنصر `<html>` مباشرة بدلاً من `DashboardShell`
- يضمن أن جميع الصفحات (بما في ذلك Footer والصفحات التسويقية) لديها سياق i18n

### 1.2 إضافة سطر LANGUAGE_SCRIPT (ما قبل التميؤ)
- **الملف:** `src/app/layout.tsx`
- استعادة `dir` و `lang` من `localStorage` قبل أن يقوم React بالتميؤ (hydration)
- يمنع وميض الاتجاه الخاطئ عند إعادة التحميل في العربية

### 1.3 إضافة `suppressHydrationWarning`
- **الملف:** `src/app/layout.tsx` — على عنصر `<html>`
- يمنع تحذيرات التميؤ لأن `dir` يُضبط ديناميكياً

### 1.4 إصلاح خطأ ESLint في سياق i18n
- **الملف:** `src/i18n/context.tsx`
- استبدال `setState` داخل `useEffect` بمُهيئ كسول (lazy initializer) في `useState`
- يمنع تحذير `react-hooks/exhaustive-deps`

### 1.5 إصلاح مسار `/dashboard/reviews`
- **الملف:** `src/app/(dashboard)/dashboard/reviews/page.tsx`
- إضافة `export const dynamic = 'force-dynamic'` واستدعاء `cookies()`
- يمنع خطأ انهيار البناء الثابت (static generation crash) الناتج عن عدم وجود LanguageProvider أثناء prerender

---

## 2. إصلاحات الاتجاهات المنطقية (Logical CSS Properties)

### 2.1 الشريط الجانبي (Sidebar)
- **الملف:** `src/components/ui/Sidebar.tsx`
- `ml-auto` ← `ms-auto` (هامش تلقائي في بداية السطر)

### 2.2 المساعد AI (AgentFlowAssistant)
- **الملف:** `src/components/assistant/AgentFlowAssistant.tsx`
- `ml-1` ← `ms-1`، `ml-8` ← `ms-8`
- `right-5` ← `end-5`، `right-0` ← `end-0`، `md:right-5` ← `md:end-5`

### 2.3 التقويم (Calendar)
- **الملف:** `src/app/(dashboard)/dashboard/calendar/CalendarClient.tsx`
- `ml-2` ← `ms-2`، `pl-3 pr-8` ← `ps-3 pe-8`
- `right-2` ← `end-2`، `left-0 right-0` ← `start-0 end-0`

### 2.4 دردشة أليكس (AlexChat)
- **الملف:** `src/app/(dashboard)/dashboard/alex/AlexChatClient.tsx`
- `ml-8` ← `ms-8`

### 2.5 التقارير (Reports)
- **الملف:** `src/app/(dashboard)/dashboard/reports/page.tsx`
- `left-3.5` ← `start-3.5` (أيقونة البحث)، `pl-10` ← `ps-10`

### 2.6 الاستعادة (Recovery)
- **الملف:** `src/app/(dashboard)/dashboard/recovery/RecoveryClient.tsx`
- `left-3` ← `start-3`، `pl-9` ← `ps-9`

### 2.7 مشاريع GitHub (GitHubIssuesPanel)
- **الملف:** `src/app/(dashboard)/dashboard/projects/GitHubIssuesPanel.tsx`
- `left-3` ← `start-3`، `pl-9` ← `ps-9`

### 2.8 مشاريع Pull Requests (PullRequestAssistantPanel)
- **الملف:** `src/app/(dashboard)/dashboard/projects/PullRequestAssistantPanel.tsx`
- `left-3` ← `start-3`، `pl-9` ← `ps-9`

### 2.9 الإشعارات (NotificationsCenter)
- **الملف:** `src/app/(dashboard)/dashboard/notifications/NotificationsCenterClient.tsx`
- `left-3.5` ← `start-3.5`، `pl-10` ← `ps-10`

### 2.10 استوديو المحتوى (ContentStudio)
- **الملف:** `src/app/(dashboard)/dashboard/content-studio/ContentStudioClient.tsx`
- `ml-2` ← `ms-2`

### 2.11 التوثيق (DocsCenter)
- **الملف:** `src/app/(dashboard)/dashboard/docs/DocsCenterClient.tsx`
- `right-3` ← `end-3`، `pr-11 pl-4` ← `pe-11 ps-4`

### 2.12 محلل قاعدة الكود (CodebaseAnalyzer)
- **الملف:** `src/app/(dashboard)/dashboard/projects/CodebaseAnalyzer.tsx`
- `file:mr-3` ← `file:me-3`

### 2.13 الوكلاء (Agents)
- **الملف:** `src/app/(dashboard)/dashboard/agents/page.tsx`
- 6 إصلاحات: `left-3.5` ← `start-3.5` (×2)، `right-3.5` ← `end-3.5` (×2)، `pl-10` ← `ps-10` (×2)

### 2.14 المهام (Tasks)
- **الملف:** `src/app/(dashboard)/dashboard/tasks/TasksClient.tsx`
- `left-3.5` ← `start-3.5`، `pl-10` ← `ps-10`
- `right-3.5` ← `end-3.5` (×3 للقوائم المنسدلة)

### 2.15 مكتبة المحتوى (ContentLibrary)
- **الملف:** `src/app/(dashboard)/dashboard/content-library/page.tsx`
- `left-3` ← `start-3`، `pl-9` ← `ps-9`

### 2.16 تقارير التشغيل (OperationalReport + ReportsList)
- **الملف:** `src/app/(dashboard)/dashboard/reports/OperationalReportClient.tsx`
- **الملف:** `src/app/(dashboard)/dashboard/reports/ReportsListClient.tsx`
- `left-3.5` ← `start-3.5`، `pl-10` ← `ps-10`

### 2.17 Reels
- **الملف:** `src/app/(dashboard)/dashboard/reels/page.tsx`
- `sm:ml-4` ← `sm:ms-4`

### 2.18 صفحات تسجيل الدخول والتسجيل
- **الملف:** `src/app/auth/login/page.tsx`
- `pr-11` ← `pe-11`، `right-3` ← `end-3`
- **الملف:** `src/app/auth/signup/page.tsx`
- `pr-11` ← `pe-11`، `right-3` ← `end-3`

### 2.19 جرس الإشعارات (NotificationBell)
- **الملف:** `src/components/notifications/NotificationBell.tsx`
- `-right-1` ← `-end-1`، `right-0` ← `end-0`

### 2.20 الإصدارات (Releases)
- **الملف:** `src/app/(dashboard)/dashboard/releases/ReleasesClient.tsx`
- `right-3.5` ← `end-3.5`

### 2.21 نموذج المراجعة (ReviewForm)
- **الملف:** `src/app/(dashboard)/dashboard/review/ReviewForm.tsx`
- `right-3.5` ← `end-3.5`

### 2.22 المشاريع (ProjectsClient)
- **الملف:** `src/app/(dashboard)/dashboard/projects/ProjectsClient.tsx`
- `right-3.5` ← `end-3.5`

### 2.23 مكتبة التعليمات (PromptLibrary)
- **الملف:** `src/app/(dashboard)/dashboard/prompt-library/PromptLibraryClient.tsx`
- `right-3.5` ← `end-3.5`

### 2.24 إنشاء المهام (CreateTaskForm)
- **الملف:** `src/app/(dashboard)/dashboard/create-task/CreateTaskForm.tsx`
- `right-3.5` ← `end-3.5` (×4 مواقع)

### 2.25 الحملات (Campaigns)
- **الملف:** `src/app/(dashboard)/dashboard/campaigns/CampaignsClient.tsx`
- `right-3.5` ← `end-3.5`

### 2.26 مكونات الواجهة العامة (UI Components)
- **الملف:** `src/components/ui/Topbar.tsx` — إصلاحات RTL (تمت سابقاً)
- **الملف:** `src/components/ui/FormControls.tsx` — `pr-9` ← `pe-9` (تم سابقاً)
- **الملف:** `src/components/ui/Toast.tsx` — `right-4` ← `start-4` (تم سابقاً)
- **الملف:** `src/components/layout/DashboardShell.tsx` — `lg:pl-72` ← `lg:ps-72` (تم سابقاً)

### 2.27 التذييل (Footer)
- **الملف:** `src/components/layout/Footer.tsx`
- استبدال كل النص الإنجليزي الثابت بـ `t()` (i18n)
- تغيير عناصر `<span>` لوسائل التواصل الاجتماعي إلى روابط `<a>` عاملة

---

## 3. إصلاحات التقويم RTL

### 3.1 CalendarClient — ديناميك RTL
- **الملف:** `src/app/(dashboard)/dashboard/calendar/CalendarClient.tsx`
- استبدال `isRtl = false` الثابت بـ `useLanguage()` الفعلي
- تدوير أيقونات `ChevronLeft`/`ChevronRight` وإضافة `dir` إلى حاوية الشهر
- تمت إضافة مفاتيح i18n للتقويم (بحث، أوامر الحالة، تنقل، رسائل "لا توجد عناصر")

---

## 4. إصلاحات i18n للغات المتعددة

### 4.1 إضافة مفاتيح `footer.*`
- **الملفات:** `src/i18n/locales/en.json`، `ar.json`، `fr.json`، `es.json`
- جميع مفاتيح التذييل: الروابط، حقوق النشر، وسائل التواصل الاجتماعي

### 4.2 إضافة مفاتيح `calendar.*`
- **الملفات:** `src/i18n/locales/en.json`، `ar.json`، `fr.json`، `es.json`
- أوامر حالة المحتوى، أزرار التنقل، رسائل الحالة الفارغة

---

## 5. إزالة الكود الميت (Dead Code)

- **الملف:** `src/app/page.tsx` — إزالة بيانات `pricingTiers` وقسم التسعير
- **الملف:** `src/components/marketing/MarketingNavbar.tsx` — تعطيل رابط Pricing

---

## 6. الفحوصات النهائية

| الفحص | النتيجة |
|-------|---------|
| `npm run lint` | 0 أخطاء، تحذير واحد (وسم `<img>` مقبول) |
| `npx tsc --noEmit` | 0 أخطاء |
| `npm run build` | 92/92 صفحة، بنجاح في ~37 ثانية |

---

## 7. الملفات المتبقية (غير معدلة عن قصد)

- **`src/components/dashboard/DashboardHeroAnimation.tsx`** — عناصر زخرفية متحركة بحتة (عائمات، مدارات، مسح). استخدام `left`/`right` هنا مخصص للرسوم المتحركة CSS المخصصة ولن يؤثر على سهولة الاستخدام الوظيفي في RTL. لا يوصى بالتغيير لأن المواضع المطلقة مطلوبة للتأثيرات البصرية المحددة.

---

## 8. ملخص إحصائي

- **إجمالي الإصلاحات:** +50 موقعاً عبر ~30 ملفاً
- **الفئات المستبدلة:** `ml-*` → `ms-*`، `mr-*` → `me-*`، `pl-*` → `ps-*`، `pr-*` → `pe-*`، `left-*` → `start-*`، `right-*` → `end-*`
- **اللغات المدعومة:** العربية (كاملة)، الإنجليزية، الفرنسية، الإسبانية
- **حالة البناء:** ✅ ناجح
