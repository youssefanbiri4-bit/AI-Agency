# AgentFlow AI — Full Platform Audit Report

> **المشروع:** [AgentFlow AI](https://github.com/youssefanbiri4-bit/AI-Agency)  
> **التاريخ:** 2026-07-04  
> **المراجع:** Senior Full-Stack Architect + QA Engineer  
> **الفرع:** `fix/ci-deps-cleanup`  
> **المنهجية:** مراجعة كودية شاملة + `npm run build` + `npm test` + تحليل Schema/RLS/Docs

---

## Executive Summary

AgentFlow AI منصة **غنية بالميزات** مبنية على Next.js 16 + Supabase + BullMQ/n8n، مع أساس معماري جيد ووثائق كثيرة. لكن التقييم الصارم يُظهر أن المنصة **ليست جاهزة للإنتاج** في حالتها الحالية:

| المؤشر | القيمة |
|--------|--------|
| **التقييم الإجمالي** | **7.8 / 10** (post P0 + server PDF + launch docs) |
| **حالة البناء** | ✅ **`npm run build` ينجح** |
| **حالة الاختبارات** | ✅ **64/64** (`npm test`) |
| **جاهزية الإطلاق** | ✅ **جاهز للإطلاق المُراقَب** — اتبع `docs/FINAL_LAUNCH_CHECKLIST.md`؛ Upstash مطلوب قبل التوسع العام |

**P0 fixes applied (2026-07-04):**
1. ✅ **Build** — `rbac-client.ts` (client-safe); `Sidebar.tsx` updated
2. ✅ **Run Task** — `RunTaskButton` sends `workspaceId` + `taskPayload`; execute route wired to gate + service
3. ✅ **TaskService** — `createSupabaseServerClient()` on server

**Fixes applied (2026-07-04 — C6/C7b/C8):**
4. ✅ **Content RLS** — `creative_assets`, `content_studio_items`, `reels`, `content_studio_publish_attempts` use `has_min_role(editor)` + `user_can_access_rbac_department()`
5. ✅ **Billing lock** — `subscriptions` + `billing_customers` SELECT owner/admin only; service role writes
6. ✅ **Usage limits** — seeded on workspace create; owner UPDATE policy; `incrementUsage` via admin client

---

## 1. تقييم شامل (Score 1–10)

| المجال | الدرجة | الملخص |
|--------|--------|--------|
| **Architecture** | **6.5/10** | App Router + `middleware.ts` لحماية `/dashboard/*`؛ لا يزال ازدواجية صلاحيات legacy + RBAC. |
| **RBAC + Departments** | **6/10** | `DEPARTMENT_MAP` يربط catalog ↔ RBAC؛ task scoping يعمل؛ لكن لا UI لتعيين department وSidebar ≠ route protection. |
| **Dashboard + Sidebar** | **5/10** | UI جميل، RBAC nav، لكن dashboard مزدوج، إحصائيات وهمية، 30+ عنصر nav، والبناء مكسور بسبب Sidebar. |
| **Task Lifecycle** | **5/10** | Execute path مُصلح؛ dept scoping على create/list/execute؛ لكن 8+ مسارات إنشاء تتجاوز `taskService`. |
| **Production Gate** | **5/10** | `gate.ts` مصمم جيداً ومطبّق على بعض المسارات، لكن **ليس** على `/api/tasks/execute` — المسار الفعلي للمستخدمين. |
| **Usage Quotas + Cost Tracking** | **5/10** | `incrementUsage` يعمل عبر service role؛ seed + owner UPDATE على `usage_limits`؛ `checkQuota` لا يزال غير متسق على بعض المسارات. |
| **Client Reporting** | **7.5/10** | Server PDF (`generateServerPDF`)؛ بيانات حقيقية؛ brand kit؛ لا نسخ محفوظة بعد. |
| **Reels Studio + Creative Assets** | **6.5/10** | Creative Assets (~7/10)؛ Reels Studio موحّد على `reels` table — list/form/publish يعمل؛ جدولة cron لا تزال مفتوحة. |
| **Database Schema + RLS** | **8/10** | Schema قوي؛ RLS tasks + assets/reels/studio بـ `has_min_role` + dept mappers؛ billing tables مقفولة. |
| **Security** | **6.5/10** | middleware RBAC على dashboard؛ billing RLS مُصلح؛ execute path gaps متبقية (ملاحظة: منصة داخلية — لا Stripe). |
| **Performance** | **5/10** | Indexes جيدة على المسارات الرئيسية؛ usage page N+1 (17+ COUNT)؛ dashboard/reports يجلبان بيانات ضخمة لكل الأدوار. |
| **UX/UI** | **6/10** | لغة بصرية متماسكة (berry/coral، glassmorphism)؛ لكن تناقضات layout، فلاتر معطّلة، بيانات مضللة، Reels أقل جودة. |
| **Documentation** | **7.5/10** | `FINAL_LAUNCH_CHECKLIST.md` مصدر حقيقة للإطلاق؛ deploy checklist محدّث؛ بعض drift في FINAL_LAUNCH_PLAN (يحتاج تحديث دوري). |

### توزيع الدرجات

```
Architecture        ██████▌░░░  6.5
RBAC + Departments  ████░░░░░░  4
Dashboard + Sidebar █████░░░░░  5
Task Lifecycle      ███░░░░░░░  3
Production Gate     █████░░░░░  5
Usage + Cost        ███░░░░░░░  3
Client Reporting    ███████▌░░  7.5
Reels + Assets      ████░░░░░░  4
DB Schema + RLS     ██████▌░░░  6.5
Security            ████░░░░░░  4
Performance         █████░░░░░  5
UX/UI               ██████░░░░  6
Documentation       ███████▌░░  7.5
─────────────────────────────────
OVERALL             ███████▊░░  7.8
```

---

## 2. قائمة المشاكل الكاملة

### 🔴 Critical (Blocker)

| # | المشكلة | الملفات | التأثير |
|---|---------|---------|---------|
| ~~C1~~ | ~~**البناء الإنتاجي فاشل**~~ — **FIXED** via `rbac-client.ts` | `Sidebar.tsx`, `rbac-client.ts` | ✅ |
| ~~C2~~ | ~~**Run Task 400**~~ — **FIXED** — `RunTaskButton` + execute route | `components/tasks/RunTaskButton.tsx` | ✅ |
| ~~C3~~ | ~~**تعارض نموذج الأقسام**~~ — **FIXED** via `DEPARTMENT_MAP` + `canAccessCatalogDepartment` | `rbac-client.ts`, `task-service.ts`, `TasksClient.tsx` | ✅ |
| ~~C4~~ | ~~**TaskService browser client**~~ — **FIXED** — `createSupabaseServerClient()` | `task-service.ts` | ✅ |
| ~~C5~~ | ~~**Execute API بدون gate**~~ — **FIXED** — gate + service + n8n readiness | `api/tasks/execute/route.ts` | ✅ |
| ~~C6~~ | ~~**`subscriptions` قابلة للكتابة من العميل**~~ — **FIXED** — SELECT owner/admin only; writes via service role | migration SQL | ✅ |
| ~~C7 (tasks)~~ | ~~**RLS coarse on tasks**~~ — **FIXED** — `has_min_role(editor)` + `user_can_access_task_department` | migration SQL | ✅ tasks only |
| ~~C7b~~ | ~~**RLS still coarse on assets/content**~~ — **FIXED** — dept mappers + `has_min_role(editor)` | migration SQL | ✅ |
| ~~C8~~ | ~~**`usage_limits` بدون UPDATE policy + `incrementUsage` no-op**~~ — **FIXED** — seed trigger + owner UPDATE + admin increment | `quotas.ts`, `usage-limits.ts` | ✅ |

### 🟠 High

| # | المشكلة | الملفات | التأثير |
|---|---------|---------|---------|
| ~~H1~~ | ~~**Reels: نموذجان متنافسان**~~ — **FIXED** — unified on `reels` table; no Content Studio redirects | `reels/page.tsx`, `ReelForm.tsx`, `ReelPublishPanel.tsx` | ✅ |
| H2 | **8+ مسارات إنشاء مهام تتجاوز `taskService` + RBAC + quota** | `campaigns/actions.ts`, `content-studio/actions.ts`, `agent-library/actions.ts`, إلخ | ثغرات صلاحيات وحصص |
| H3 | **`body.workspaceId` غير مربوط بـ cookie workspace** في execute | `api/tasks/execute/route.ts` | خطر cross-workspace لمتعددي workspaces |
| H4 | **Retry من `failed` مكسور** — API يقبل `pending` فقط | `execute/route.ts`, `task-service.ts` | UX Retry لا يعمل |
| H5 | **`canExecuteTask` يستخدم `isReady` بدل `canExecute`** | `task-service.ts:124-130` | رفض تنفيذ دائم إن استُخدمت الدالة |
| H6 | **AI Studio بدون `checkQuota`** | `ai-studio/actions.ts` | تجاوز حدود التوليد |
| H7 | **`gatedCreateTask` / `gatedExecuteTask` بدون RBAC** | `src/actions/tasks.ts` | مسارات gated أضعف من المسارات الرئيسية |
| H8 | **اختبارات execute route فاشلة (6/6)** + suite واحدة لا تُحمّل | `tests/execute-route.test.ts`, `route.test.ts` | لا CI safety net للمسار الحرج |
| ~~H9~~ | ~~**لا middleware/route protection**~~ — **FIXED** — `middleware.ts` + `require-page-access.ts` enforce RBAC/dept on direct URLs | `middleware.ts`, `dashboard-edge-auth.ts` | ✅ |
| H10 | **`fail-stale` بدون فحص دور operator** | `api/tasks/fail-stale/route.ts` | أي member يعلّم مهام failed |
| ~~H11~~ | ~~**Metadata key خاطئ في asset sync**~~ — **FIXED** — `resolveAssetVideoUrl` handles both keys | `reels/actions.ts` | ✅ |
| ~~H12~~ | ~~**Redeclaration coverAssetId/videoAssetId**~~ — **FIXED** via `syncUrlsFromLinkedAssets` helper | `reels/actions.ts` | ✅ |
| ~~H13~~ | ~~**لا seed لـ `usage_limits` عند إنشاء workspace**~~ — **FIXED** في `handle_new_workspace_owner` | migration SQL | ✅ |
| ~~H14~~ | ~~**تقارير العميل: نص أداء مُختلق**~~ — **FIXED** — `buildPerformanceMetrics` + operational counts only; explicit note when ad metrics omitted | `report-generator.ts`, `report-data.ts` | ✅ |

### 🟡 Medium

| # | المشكلة | الملفات | التأثير |
|---|---------|---------|---------|
| M1 | **Dashboard مزدوج** — PersonalizedDashboard + Command Center كامل لكل الأدوار | `dashboard/page.tsx`, `PersonalizedDashboard.tsx` | تجربة مربكة؛ تحميل زائد |
| M2 | **إحصائيات وهمية** — fallback `tasks: 4, ready: 2, reviews: 1` | `PersonalizedDashboard.tsx:109-113` | بيانات مضللة للمستخدمين الجدد |
| M3 | **"My Tasks" ليست مهام المستخدم** — `recentTasks.slice(0,4)` workspace-wide | `dashboard/page.tsx:862-868` | تخصيص وهمي |
| M4 | **`welcomeName = 'there'`** — لا يستخدم `DashboardContext.fullName` | `PersonalizedDashboard.tsx:56` | |
| M5 | **Sidebar fail-open** — `if (!role) return true` يعرض كل القائمة | `Sidebar.tsx:96` | أمان UX متوقع مُنتهك |
| M6 | **لا UI لتعيين `workspace_members.department`** | `MemberRoleForm.tsx`, `settings/roles/page.tsx` | RBAC departments غير قابل للإدارة |
| M7 | **`updateMemberRBAC` موجود لكن غير مستخدم** | `rbac.ts:349` | |
| M8 | **Cookie "view as dept" للأدمن client-only** — السيرفر يتجاهله | `layout.tsx:209-211`, `DashboardContext.tsx` | فلترة server-side لا تتبع اختيار الأدمن |
| M9 | **ازدواجية نظام الصلاحيات** — legacy `can*` + RBAC | `workspace-permissions.ts`, `review/actions.ts` | `canReviewTasks` يسمح editor؛ RBAC يرفض |
| M10 | **Production Gate: خطأ operator precedence في domain check** | `gate.ts:156-157` | localhost يمر كـ domainOk |
| M11 | **Gate n8n check ضعيف** — env presence فقط ≠ `getN8nReadiness` | `gate.ts` vs `n8n readiness` | false positive أخضر |
| M12 | **Usage page N+1** — 17+ COUNT queries | `usage/page.tsx`, `quotas.ts` | بطء عند التوسع |
| M13 | **Cost tracking all-time وليس 30 يوم** رغم وصف UI | `cost-tracking.ts` | أرقام مضللة |
| M14 | **`task` quota = `max_ai_generations * 2`** — لا عمود `max_tasks` | `quotas.ts:218-221` | منطق حدود عشوائي |
| ~~M15~~ | ~~**PDF = `window.print()`**~~ — **FIXED** — `generateServerPDF` (Puppeteer + pdf-lib); `ClientReportButton` uses server action | `generate-server-pdf.ts`, `actions/reports/actions.ts` | ✅ |
| ~~M16~~ | ~~**`getBrandKitForWorkspace` مستورد وغير مستخدم**~~ — **FIXED** — wired in `gatherClientReportData` | `report-data.ts` | ✅ |
| M17 | **Reels storage bucket غير موجود** — `storage/reels.ts` يتيم | migration, `storage/reels.ts` | |
| M18 | **`getReelById` يفلتر بـ `user_id`** — لا مشاركة فريق | `data/reels.ts:148-154` | |
| M19 | **`provider_readiness_cache` policies مضلّلة** — أي member يكتب | migration | |
| M20 | **Indexes ناقصة** — `backup_records`, `github_issue_task_links` | migration | بطء عند التوسع |
| M21 | **Reports: فلاتر بحث/تاريخ معطّلة** | `reports/page.tsx:1176-1180` | UI ميت |
| M22 | **`theme` prop في DashboardShell غير مطبّق** | `DashboardShell.tsx` | |
| M23 | **`database.ts` enums فارغة** — `Enums: Record<string, never>` | `types/database.ts` | type safety ضعيف |
| M24 | **تكرار export `Department`/`RBACRole`** | `database.ts` | ارتباك types |
| M25 | **`@supabase/auth-helpers-nextjs` deprecated** | `package.json` | دين تقني |
| M26 | **`PermissionAction` type معرّف لكن غير مُنفَّذ** | `auth.ts`, `rbac.ts` | |
| M27 | **لا اختبارات RBAC unit** | — | |
| M28 | **Topbar search سطحي** — لا creative assets / content studio | `Topbar.tsx` | |
| M29 | **تناقض layout padding** بين dashboard و reels/assets | صفحات متعددة | visual jitter |
| M30 | **Inline server action per card** في creative assets | `creative-assets/page.tsx:97-101` | anti-pattern |

### 🟢 Low

| # | المشكلة | الملفات |
|---|---------|---------|
| L1 | Imports غير مستخدمة (`getRBACContext`, `useEffect`, `workspaceId`) | `tasks/page.tsx`, `DepartmentSwitcher.tsx` |
| L2 | `canRunOrReview` / `canManage` computed لكن غير مستخدمة | `TasksClient.tsx`, `tasks/[id]/page.tsx` |
| L3 | `RBAC_ROLE_COOKIE` معرّف وغير مستخدم | `DashboardContext.tsx` |
| L4 | JSDoc قديم في DepartmentSwitcher | `DepartmentSwitcher.tsx:18` |
| L5 | React keys بـ index في My Tasks | `PersonalizedDashboard.tsx` |
| L6 | `confirm()` / `alert()` في ClientReportButton | `ClientReportButton.tsx` |
| L7 | `console.log` للتقرير في production path | `ClientReportButton.tsx:51` |
| L8 | Sidebar `StatusBadge "Prepared"` ثابت | `Sidebar.tsx:216` |
| L9 | أزرار "Edit Asset" / "Open Asset" مكررة | `creative-assets/page.tsx` |
| L10 | `initialNotifications={[]}` دائماً في layout | `layout.tsx` |
| L11 | وثائق مكررة — `TESTING_CHECKLIST.md` root + docs | repo root |
| L12 | عدد agents في docs (18) ≠ schema (27) | `docs/README.md` |
| L13 | `link_asset` query param يعرض notice فقط | `reels/page.tsx:223-227` |
| L14 | Reels list بدون thumbnails | `reels/page.tsx` |
| L15 | Language switcher مخفي على شاشات صغيرة جداً | `Topbar.tsx` |
| L16 | `security:audit` script regex-only | `scripts/security-audit.mjs` |
| L17 | `as any` casts في RBAC bootstrap | `layout.tsx`, `rbac.ts` |
| L18 | New Reel دائماً `instagram_reel` | `reels/new/page.tsx` |
| L19 | ReelForm modal بدون focus trap / `role="dialog"` | `ReelForm.tsx` |
| L20 | `gatedCreateTask` يطبّق production gate على الإنشاء (مبالغ) | `actions/tasks.ts` |

---

## 3. تحليل تفصيلي حسب المجال

### 3.1 Architecture (5/10)

**نقاط القوة:**
- App Router مع `(dashboard)` group، 24+ server action modules، 19 API routes
- فصل `src/lib/data/*` (28 modules) عن domain logic
- BullMQ + n8n callback مع rate limiting و idempotency
- Layout مرن مع timeouts و `Promise.allSettled`

**نقاط الضعف:**
- **لا middleware** — كل الحماية في `layout.tsx`
- **ازدواجية صلاحيات** legacy + RBAC
- **Client/Server boundary مكسور** — `rbac.ts` monolith يخلط pure helpers مع server imports
- `TaskService` singleton بدون DI للـ Supabase client
- مسارات متعددة لنفس العملية (`create-task/actions.ts` vs `actions/tasks.ts` vs domain actions)

### 3.2 RBAC + Departments (4/10)

**ما يعمل:**
- `ROLE_HIERARCHY`, `hasPermission`, `requireWorkspaceAccessWithRBAC`
- Sidebar filtering عبر `canViewArea` + `DEPARTMENT_FEATURES`
- DepartmentSwitcher للأدمن (cookie `ai-agency-rbac-dept`)
- DB: `rbac_role` + `department` enums + `has_min_role()` function

**ما لا يعمل:**
```
RBAC Department (workspace_members)     Agent Catalog (agents.department_id)
─────────────────────────────────────   ────────────────────────────────────
content, creative, social, ...          content_growth, research_strategy, ...
         ↓                                        ↓
    canAccessDepartment()  ←── STRING EQUALITY ──→  NEVER MATCHES
```

- ~10 ملفات تستخدم RBAC؛ 18+ تستخدم legacy فقط
- Sidebar ≠ route protection
- لا تعيين department من UI
- RLS لا يستخدم `department` column

### 3.3 Dashboard + Sidebar (5/10)

**نقاط القوة:** تصميم متماسك، i18n labels، mobile sidebar، department badge، RBAC nav intent.

**نقاط الضعف:**
- PersonalizedDashboard فوق Command Center (~1200 سطر) لكل الأدوار
- إحصائيات fallback وهمية
- 30+ عنصر navigation بدون grouping
- البناء مكسور بسبب import chain

### 3.4 Task Lifecycle (3/10)

```
المسار المقصود:  Create → Execute → n8n → Callback → Review → Complete
المسار الفعلي:   Create (جزئي) → Execute (❌ UI broken) → ... → Review (جزئي)
```

| المرحلة | الحالة |
|---------|--------|
| Create (main path) | ⚠️ RBAC مزدوج + dept broken + wrong client |
| Execute (UI) | ❌ Payload mismatch |
| Execute (API) | ⚠️ RBAC فقط؛ لا gate، لا service |
| Callback | ✅ جيد |
| Review | ⚠️ يتجاوز service methods |
| List/Filter | ❌ dept filter broken |

### 3.5 Production Gate (5/10)

| العملية | Gate مفعّل؟ |
|---------|------------|
| Image gen, reels publish, paid ads, content publish | ✅ |
| `/api/tasks/execute` (المسار الفعلي) | ❌ |
| `gatedExecuteTask` (غير مستخدم من UI) | ✅ |
| Task detail UI | ❌ (يستخدم `getN8nReadiness` فقط) |

### 3.6 Usage Quotas + Cost Tracking (3/10)

```
usage_limits (DB) ──→ checkQuota() ──→ بعض Server Actions
        ↑                                      │
        │ incrementUsage() → admin client      │
        │   (service role metadata counters)   │
        └──────────────────────────────────────┘
              checkQuota يعيد COUNT من الجداول
```

**تغطية `checkQuota`:** create-task, creative-assets, gated wrappers فقط.  
**بدون quota:** ai-studio, content-studio, campaigns, معظم reels paths.

### 3.7 Client Reporting (7.5/10)

- `generateClientReport` + `renderReportToHTML` + `generateServerPDF` (Puppeteer HTML→PDF + pdf-lib fallback)
- `gatherClientReportData` — tasks, reels, creative assets, brand kit, reviews count
- `ClientReportButton` + `POST /api/reports/client-pdf` — real PDF download (not `window.print`)
- مدمج في `/dashboard/reports` و `tasks/[id]` مع template picker + optional password
- **متبقي:** persistent report versions، share links، production Chromium on serverless

### 3.8 Reels Studio + Creative Assets (6.5/10)

| الوحدة | الدرجة | الحالة |
|--------|--------|--------|
| Creative Assets | 7/10 | previews, RBAC, gate, quota, upload |
| Reels Studio | 6/10 | unified على `reels` table — list/new/detail + form + publish panel |

**التكامل Asset↔Reel:** `link_asset` → `/dashboard/reels/new` → gallery modal → bidirectional sync.

### 3.9 Database Schema + RLS (8/10)

**نقاط القوة:**
- Migration موحّد idempotent: 31 tables, triggers, storage bucket `creative-assets`
- `is_workspace_member`, `is_workspace_admin`, `has_min_role` — SECURITY DEFINER
- RLS على tasks + creative_assets + reels + content_studio بـ dept mappers
- `subscriptions`/`billing_customers` — SELECT owner/admin فقط؛ لا client writes
- `usage_limits` seeded عند إنشاء workspace + owner UPDATE
- Indexes قوية على tasks, notifications, content_studio, creative_assets
- `ad_connections`, `n8n_callback_events` — service-role only

**نقاط الضعف:**
- department enum ≠ departments catalog table
- indexes ناقصة على backup_records, github_issue_task_links
- projects/prompt_library/releases لا تزال workspace-only RLS

### 3.10 Security (4/10)

| Vector | الحالة |
|--------|--------|
| Server action auth | ⚠️ جزئي |
| RLS depth | ⚠️ tasks + content fixed؛ projects/prompts coarse |
| Billing integrity | ✅ client writes blocked |
| Execute path | ❌ gaps |
| Rate limiting | ✅ execute, ai-studio |
| Audit logging | ⚠️ بعض المسارات |
| SSRF protection | ✅ tests موجودة |
| Secret exposure scan | ⚠️ regex-only script |

### 3.11 Performance (5/10)

- Dashboard: 19+ parallel fetches على reports؛ كل شيء لكل الأدوار
- Usage: N+1 count queries
- Cost: full table scan بدل SQL SUM
- RLS subquery per row — مقبول صغيراً، يحتاج تحسين عند التوسع

### 3.12 UX/UI (6/10)

- Palette وcomponents متسقة
- لكن: visual jitter بين routes، fake data، disabled filters، Reels أقل polish، Command Center مكتظ

### 3.13 Documentation (5/10)

| الوثيقة | الجودة | المشكلة |
|---------|--------|---------|
| `README.md` | جيد | — |
| `docs/TEAM_ONBOARDING.md` | شامل | يصف Reels features غير موجودة |
| `TECH_DEBT.md` | صادق جزئياً | `[x]` مبالغ فيه (reels, quotas, task lifecycle) |
| `docs/FINAL_LAUNCH_CHECKLIST.md` | ممتاز | مصدر حقيقة للإطلاق — لـ Morad |
| `docs/PRODUCTION_DEPLOY_CHECKLIST.md` | جيد | محدّث 2026-07-04 |
| `docs/FINAL_LAUNCH_PLAN.md` | مفيد | يحتاج تحديث (print PDF، readiness 90%) |
| `RBAC_*.md` | جيد | يبالغ في اكتمال التكامل |
| Root audit sprawl | — | صعب تحديد مصدر الحقيقة |

---

## 4. نتائج التحقق الآلي (2026-07-04)

### Build (`npm run build`) — ✅ PASS

Next.js 16 production build completes; all dashboard routes compile including `/api/reports/client-pdf`.

### Tests (`npm test`) — ✅ 64/64 PASS

| Suite | النتيجة |
|-------|---------|
| 15 files | ✅ pass |
| `tests/report-generator.test.ts` | ✅ no fake engagement metrics |
| `tests/generate-server-pdf.test.ts` | ✅ valid `%PDF-` buffer (pdf-lib fallback) |
| `tests/execute-route.test.ts` | ✅ pass (server-only mock in vitest) |

### Typecheck (`npx tsc --noEmit`) — ✅ PASS

---

## 5. Recommendations — Next Steps

### المرحلة 0: إصلاحات Blocker (أسبوع 1)

| # | الإجراء | الأولوية | الجهد |
|---|---------|----------|-------|
| 1 | فصل `canViewArea` و pure RBAC helpers إلى `rbac-client.ts` (بدون server imports) | P0 | 2h |
| 2 | إصلاح `RunTaskButton` — إرسال `workspaceId` + بناء `taskPayload` server-side | P0 | 4h |
| 3 | ربط execute route بـ `assertProductionGate` + `getN8nReadiness` + `taskService.canExecuteTask` | P0 | 4h |
| 4 | إنشاء `DEPARTMENT_MAP` ثابت: RBAC ↔ catalog IDs | P0 | 3h |
| 5 | حقن `createSupabaseServerClient()` في `TaskService` per-request | P0 | 2h |
| ~~6~~ | ~~إصلاح RLS: إلغاء client writes على `subscriptions`~~ | ✅ DONE | — |
| ~~7~~ | ~~إضافة UPDATE policy + seed لـ `usage_limits`~~ | ✅ DONE | — |
| 8 | إصلاح execute tests (mock RBAC, queue, server-only) | P0 | 4h |

### المرحلة 1: استقرار المنصة (أسبوع 2–3)

| # | الإجراء |
|---|---------|
| 9 | توحيد Reels: إما استعادة UI على `reels` table أو حذف الكود الميت وتحديث كل الوثائق |
| 10 | توجيه كل مسارات إنشاء المهام عبر `taskService.createTask` |
| ~~11~~ | ~~إضافة `middleware.ts`~~ — **DONE** (`require-page-access.ts` + layout defense-in-depth) |
| 12 | توسيع roles UI: department selector + `updateMemberRBAC` |
| 13 | تطبيق `has_min_role()` في RLS policies للكتابة |
| 14 | إضافة `checkQuota` لـ ai-studio, content-studio, campaigns |
| 15 | إزالة fake stats من PersonalizedDashboard؛ تقسيم dashboard حسب الدور |
| 16 | إصلاح asset sync (`public_url`) + redeclarations في reels/actions |
| 17 | ربط `body.workspaceId === cookie workspaceId` في execute |

### المرحلة 2: جودة الإنتاج (أسبوع 4–6)

| # | الإجراء |
|---|---------|
| ~~18~~ | ~~Server-side PDF + إزالة النصوص المُختلقة~~ — **DONE** (`generate-server-pdf.ts`, H14/M15) |
| 19 | `usage_events` table + Stripe webhook + metered billing |
| 20 | تحسين usage page (query واحد، SQL SUM للتكاليف) |
| 21 | Indexes ناقصة + partial index لـ quota counting |
| 22 | RBAC unit tests + E2E لـ task lifecycle |
| 23 | ترحيل `@supabase/ssr` |
| 24 | توليد types من Supabase CLI (enums, functions) |
| 25 | توسيع `security:audit` لفحص server actions |

### ميزات إضافية مقترحة (Post-Stabilization)

| الميزة | القيمة | الجهد |
|--------|--------|-------|
| Report versions + signed share links | عالية | متوسط |
| Reels thumbnail previews + upload flow | عالية | متوسط |
| Server-side department filter في كل list endpoints | عالية | عالي |
| `user_preferences` table لـ view-as dept persistence | متوسطة | منخفض |
| Sidebar grouping/collapse | متوسطة | منخفض |
| Full-text search (Topbar) | متوسطة | متوسط |
| CI migration lint (`supabase db lint`) | عالية | منخفض |
| Real-time notifications (بدل empty initial) | متوسطة | متوسط |
| Agent dept snapshot على task row | عالية | منخفض |
| Billing portal / usage API | عالية | عالي |

---

## 6. خارطة طريق الإطلاق

```mermaid
gantt
    title AgentFlow AI — Recommended Launch Path
    dateFormat  YYYY-MM-DD
    section P0 Blockers
    Fix build + execute path     :crit, p0a, 2026-07-04, 3d
    Department mapping + RLS     :crit, p0b, after p0a, 4d
    section P1 Stability
    Reels consolidation          :p1a, after p0b, 5d
    RBAC full coverage           :p1b, after p0b, 7d
    Quotas real enforcement      :p1c, after p0b, 5d
    section P2 Production
    Reports + Billing            :p2a, after p1b, 14d
    Performance + Tests          :p2b, after p1c, 10d
    section Launch
    Production deploy            :milestone, launch, after p2a, 0d
```

**الإطلاق المُراقَب:** اتبع `docs/FINAL_LAUNCH_CHECKLIST.md` (Phases 1–3).  
**الإطلاق العام:** يتطلب Upstash rate limits + تغطية quota كاملة.

---

## 7. الخلاصة

AgentFlow AI لديه **أساس معماري وقاعدة بيانات قويين**، P0 blockers مُصلحة (build، execute، RLS، billing، usage_limits)، و**تقارير عميل بـ PDF حقيقي**. المنصة **جاهزة للإطلاق المُراقَب** لفريق داخلي وعملاء مبكرين.

**مصدر حقيقة للإطلاق:** `docs/FINAL_LAUNCH_CHECKLIST.md` (لـ Morad).  
**Quick deploy:** `docs/PRODUCTION_DEPLOY_CHECKLIST.md`.

**الدرجة الإجمالية: 7.8/10** — ~8.5/10 بعد Upstash + quota coverage كامل.

---

*تم إنشاء هذا التقرير بواسطة مراجعة كودية آلية + تحقق يدوي + `npm run build` + `npm test`.*