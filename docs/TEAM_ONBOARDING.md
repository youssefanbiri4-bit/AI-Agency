# Team Onboarding Guide — AgentFlow AI

Welcome to **AgentFlow AI**! This guide will help your entire team get up and running quickly — whether you're an Admin/Owner setting things up or a new team member ready to contribute.

**Goal of this guide:** Get productive in < 15 minutes, understand your permissions, and know where to find help.

**Key Concepts (Read this first)**
- **Workspace**: All your agency's work lives in one shared workspace. Everything (tasks, reels, assets, reports) is scoped to it.
- **RBAC (Role-Based Access Control) + Departments**: 
  - **Roles** (power level): `viewer` (read-only) < `editor` (create/edit) < `operator` (run/publish) < `admin` (manage most) < `owner` (full control).
  - **Departments** (scope): `content`, `creative`, `social`, `strategy`, `paid_ads`, `operations`. 
  - Non-admins only see and act on things matching their department (Sidebar filters automatically). Admins/owners see everything.
  - This keeps the platform focused and secure.
- **Production Gate + Quotas**: Sensitive actions (publishing, image generation, task execution) are blocked unless your workspace passes readiness checks and stays under usage limits. You'll see clear warnings.
- **Personalized Experience**: Your Dashboard, Sidebar, and available actions adapt to your role + department.

---

## For Admins / Owners

As Owner or Admin, you control access, scoping, and limits. Do these steps before inviting the team.

### 1. Complete Your Own Setup
- Sign up / log in at the app URL (e.g. https://agentflow-ai-sigma.vercel.app).
- If no workspace exists, you'll be taken to **Onboarding** (`/onboarding`).
  - Enter a workspace name (e.g. "Acme Digital Agency") and slug.
  - Create the workspace. You become the **Owner** automatically.
- Explore:
  - `/dashboard` (your personalized Command Center).
  - `/dashboard/settings` (branding, providers, production gate).

**Screenshot description**: Onboarding screen shows welcome message with your name/email, big form for workspace name + slug, helpful description of what the workspace stores (tasks, reels, reports, etc.). "Create Workspace" primary button.

### 2. Add Team Members
Currently there is **no in-app "Invite by email" button** (this is a common early-stage pattern; it can be added later via Supabase + email invites).

**Step-by-step**:
1. Ask the new person to go to the app and **Sign Up** (`/auth/signup`).
   - They use email + password (or magic link if enabled).
   - After signup they will be prompted to onboard — **tell them to STOP** or skip if they see onboarding (they shouldn't create their own workspace).
2. Get their **User ID**:
   - They can find it in their browser console or Supabase (or you check via Supabase Dashboard → Authentication → Users).
   - Alternative: they go to `/dashboard` after login (if they have access) and you ask them for the ID shown in some debug areas, or look in Supabase.
3. Add them to your workspace (as Owner):
   - Go to **Supabase Dashboard** → your project → Table Editor → `workspace_members`.
   - Insert a new row:
     - `workspace_id`: your workspace UUID (copy from your `workspaces` table or settings).
     - `user_id`: the new member's auth user UUID.
     - `role`: start with `viewer` or `editor` (see roles below).
     - `department`: assign one of: `content`, `creative`, `social`, `strategy`, `paid_ads`, `operations` (must match what they'll work on).
     - `created_at` / `updated_at`: leave default (now()).
   - Save.
4. (Optional) Verify in your app:
   - Go to `/dashboard/settings/roles`.
   - The new member should appear in the "Workspace Members" table (by user_id).

**Screenshot description**: Supabase Table Editor showing `workspace_members` table with columns: workspace_id, user_id, role, department, created_at, etc. Example row for a new "editor" in "social" dept.

**Video placeholder**: [Add Loom/YouTube: "How an Admin Adds a Team Member in 60 seconds"]

**Pro tip**: Start everyone as `viewer` + correct department. Upgrade roles after they prove themselves.

### 3. Assign / Change Roles and Departments
- Go to **`/dashboard/settings/roles`** (Owner/Admin only — others see Access Denied).
- You'll see a table of current members + their current role.
- Use the **MemberRoleForm** dropdown + "Save" to change role (owner/admin/operator/editor/viewer).
  - Restrictions: Can't demote the true workspace owner or yourself below owner.
- For **Department**:
  - Currently edited directly in Supabase (`workspace_members.department` column).
  - Choose from: `content`, `creative`, `social`, `strategy`, `paid_ads`, `operations`.
  - This immediately affects what they see in the Sidebar and what actions they can perform.

**RBAC Quick Reference for Admins** (what each role can typically do):

| Role     | Typical Powers                              | Can See/Manage |
|----------|---------------------------------------------|----------------|
| owner    | Everything, including roles & settings      | All depts + all settings |
| admin    | Manage content, ops, some settings          | All depts |
| operator | Run tasks, publish, execute workflows       | Assigned dept + broad ops |
| editor   | Create/edit drafts, prompts, assets         | Assigned dept |
| viewer   | Read-only dashboards, reports, docs         | Assigned dept |

Departments further restrict the navigation (e.g. someone in `social` won't see paid ads or operations-heavy items by default).

**Screenshot description**: Roles & Permissions page. Table with Member (UUID), Current Role (dropdown), "Save" button. Notice at top: "Owner-only access". Links back to main settings.

### 4. Configure Quotas & Production Gate (Prevent Overspend)
- Go to **`/dashboard/production`** or **`/dashboard/settings`** (look for Production / Spend Controls).
- Or directly in Supabase:
  - Table `usage_limits` for the workspace:
    - `max_ai_generations_per_month`, `max_creative_assets`, etc.
    - Update numbers according to plan (free/starter/pro/agency).
  - `integration_settings` → `settings.production_operations` JSON:
    ```json
    {
      "paid_ads_enabled": false,
      "max_daily_ad_spend": 100,
      "launch_mode": "internal"   // or "production"
    }
    ```
- The **Production Gate** (`/dashboard/production`) must be **green** before real client work (env, n8n, Supabase, readiness checks, domain, etc.).
- Monitor live usage at **`/dashboard/usage`** (progress bars for generations, tasks, spend).

**Common Admin Gotcha**: If gate is red or quota hit, team members will see clear error messages. Fix at source (update limits or fix provider readiness).

### 5. Set Branding (Looks Professional for Clients)
- `/dashboard/settings` → Brand Kit / Logo / Theme.
- Upload logo, set colors, agency name.
- This appears in generated **Client Reports** (cover page, footer).

### 6. Quick Admin Checklist
- [ ] Workspace created & you are Owner.
- [ ] All team members signed up.
- [ ] Every member has row in `workspace_members` with correct `role` + `department`.
- [ ] `usage_limits` configured for your plan.
- [ ] Production Gate is green.
- [ ] Branding/logo set.
- [ ] Test: Log in as different role → confirm Sidebar and actions are correctly restricted.
- [ ] Share this guide with the team.

**Video placeholder**: [Admin Onboarding Walkthrough – 5 min]

---

## For New Team Members

Welcome! You'll be productive fast. Your view of AgentFlow AI is personalized to your **role + department**.

### Step 1: Sign Up / Log In
1. Go to the app (ask your admin for the link, e.g. https://agentflow-ai-sigma.vercel.app).
2. Click **Sign up** (or Login if you already have an account).
3. Use your work email + password (or magic link).
4. Verify email if prompted.

**Screenshot description**: Clean login/signup screen with email/password fields, "Sign in with Supabase" feel, links to privacy/terms, and "Forgot password" if available.

After login:
- If you don't have a workspace yet, you may see onboarding (stop and tell your admin — they will add you to the company workspace).
- Once added, you'll be redirected to `/dashboard`.

**Common Issue**: "You need an active workspace".
**Solution**: Ask admin to add your user ID to the workspace_members table. Refresh after they do.

### Step 2: Understand Your Dashboard & Sidebar
- **Personalized Dashboard** (`/dashboard`):
  - Welcome message based on your role.
  - "My Tasks" section.
  - "Department Stats".
  - Quick Actions tailored to you (e.g. "Create Task", "Content Studio", "Reels" if allowed).
- **Sidebar**: Only shows sections you have access to (RBAC filtering).
  - Example: `social` dept member sees Reels, Campaigns, Content Studio prominently.
  - Global items (Dashboard, Alex, Settings, etc.) usually visible.
- Topbar has notifications, language switch, profile.

**Screenshot description**: Dashboard hero with role badge (e.g. "Editor · Social"), stats cards, quick action buttons, and filtered left nav (no "Paid Ads" if you're not in that dept).

**Tip**: Use the **DepartmentSwitcher** (visible to admins/owners) if you ever need to preview other depts.

### Step 3: How to Create Tasks
1. Click **Create Task** (big button in sidebar or dashboard).
2. Choose an **agent** that matches your department (only allowed ones appear or are usable).
3. Fill: Title, Description, Priority.
4. Submit.

- Status starts as `pending`.
- Go to Task Details to **Run Task** (if you're operator+).
- After execution: review in `/dashboard/review` or from the task.
- Approve or Request Changes (adds revision notes for next run).

**RBAC Note**: You can only create tasks your role + dept allows. You'll get a clear error otherwise.

**Screenshot description**: Create Task form — agent cards filtered by dept, input fields, "Create" button. Success toast + redirect to task list.

**Video placeholder**: [How a Team Member Creates & Runs a Task – 90 seconds]

### Step 4: How to Use Reels + Creative Assets (Social / Content Teams)
**Reels Studio** (`/dashboard/reels` — primarily for `social` / `content` operators):
- Overview with counts (Draft / Ready / Scheduled / Published).
- **New Reel** form:
  - Campaign basics (offer, goal, audience...).
  - Creative planning (hook, script, caption, hashtags, duration).
  - Media references (video/cover URLs).
- **Link Assets**: Use the **"Browse Gallery Modal"** button.
  - Opens a grid of your Creative Assets (reel_cover, reel_video, images, videos).
  - Click one → it auto-fills the ID field.
- Save → reel created with status.
- When ready: use **ReelPublishPanel** (checks Instagram readiness + Production Gate).
- **Auto-sync**: When you link a creative asset, the reel will pull the latest video/cover URL automatically on save.

**Creative Assets** (`/dashboard/creative-assets` — for editors+):
- List / Gallery view with thumbnails, status, "Linked" badges.
- **New Asset** form:
  - Creative brief fields (goal, offer, audience...).
  - **Prompt Builder**:
    - Write base prompt.
    - Click **"Improve for Reels (social/content)"** → gets 9:16, hook-first, cinematic version.
    - Fill **Negative Prompt** (what to avoid).
  - Aspect ratio, style, generate mode.
- Generate image (subject to your **ai_generations quota** + Production Gate).
- **Link to Reel**: In asset detail page (`/dashboard/creative-assets/[id]`):
  - "Link to Reel" form: paste reel ID (or use the one from reels list).
  - Saves `linked_reel_id`.
- Use the asset in Reels via the gallery modal above (bidirectional!).

**Full Flow Example**:
1. Creative Editor creates asset → improves prompt → generates image.
2. Goes to Reels → New Reel → clicks "Browse Gallery" → picks the asset.
3. Saves → URLs auto-sync + asset now shows "Linked Reel".
4. Operator marks ready → publishes (gate + readiness checks).

**Screenshot descriptions**:
- Reels form with "Browse Gallery Modal" open: grid of asset cards (thumbnails + title + type + linked indicator).
- Creative asset card: image preview, "Use / Link to Reel" button, prompt shown.
- Publish panel: readiness checks, progress bar, status stepper (Draft → Ready → ... → Published).

**Video placeholder**: [Reels + Creative Assets End-to-End Flow – 3 minutes]

### Step 5: How to Generate & Deliver Client Reports
1. After a task reaches `needs_review` or `completed`:
   - Go to the **Task Details** page.
   - Click **"Generate Client Report"** button.
2. Or globally: `/dashboard/reports` → **"Generate Client Report"** (uses recent workspace data).
3. The system builds a professional report:
   - Cover page (your agency branding + logo if set).
   - Table of Contents.
   - Sections: Executive Summary, Insights, Content Plan, Performance, Recommendations.
4. Export options:
   - Print / Save as PDF (optimized layout, footer with date + agency).
   - Copy Markdown for easy pasting into client docs/email.

**Screenshot description**: Reports page with "Client-Ready Reports" card showing the big blue "Generate Client Report" button + description of what it includes. Task detail has the same button in the action bar.

**Video placeholder**: [Generating a Polished Client Report in 45 seconds]

### Step 6: Other Useful Pages
- **`/dashboard`**: Personalized home (My Tasks, Dept Stats, Quick Actions).
- **`/dashboard/agents`**: Browse the 18+ agents by department.
- **`/dashboard/usage`**: See your quotas & spend progress bars (warnings near limits).
- **`/dashboard/settings`**: Personal + workspace branding (admins see more).
- **`/dashboard/notifications`**: All your alerts (task ready, published, etc.).

---

## Quick Start Checklist (for every new member)

- [ ] Successfully logged in.
- [ ] Can see the correct Sidebar sections for my department.
- [ ] Created at least one test task.
- [ ] (If operator) Ran a task and saw it go to `needs_review`.
- [ ] (If editor) Created a Creative Asset + used the "Improve for Reels" prompt button.
- [ ] (If relevant) Created/linked a Reel using the Gallery Modal.
- [ ] Generated one Client Report (from task or reports page) and exported PDF.
- [ ] Visited `/dashboard/usage` and understand my limits.
- [ ] Know who my Admin/Owner is for questions.

---

## Common Issues + Solutions

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| "Authentication is required" or redirect to login | Session expired or not logged in | Log out completely, log back in. Clear cookies if needed. |
| "Active workspace is required" / onboarding loop | You weren't added to the company workspace yet | Contact Admin/Owner with your user ID. |
| "Insufficient permissions" or "Operator role required" | Your RBAC role or department doesn't allow the action | Ask admin to upgrade your role or correct your department in workspace_members. |
| "Production Gate blocked" or red status | Workspace not ready (missing keys, n8n not configured, launch_mode=blocked, etc.) | Admin must fix at `/dashboard/production` or via settings. |
| "Quota exceeded" / AI generation blocked | Hit `ai_generations` or other limit | Wait for reset or ask admin to increase in `usage_limits` table. |
| Images / Reels not showing correct cover/video | Asset not linked or sync didn't happen | Re-link via gallery modal, re-save the reel. Check the asset's `linked_reel_id`. |
| Can't see certain menu items in Sidebar | Dept or role filtering | Confirm with admin what your assigned department is. |
| Report looks unbranded | No logo/colors set | Admin sets branding in Settings → Brand Kit. |
| n8n task stuck in "processing" | Callback not received or secret mismatch | Check n8n logs + Supabase callback secret. Retry from task details. |

**Still stuck?** Check the in-app notices, `/dashboard/system-health`, or ask in your team's channel. Most issues are RBAC/quota/gate related and resolved by an admin in < 2 minutes.

---

## Screenshots & Visual Aids (Textual Descriptions)

**Admin View — Roles Page**
[Imagine a clean table listing team members by UUID + current role dropdowns + save buttons. Big "Owner-only" notice at top. Link to full settings.]

**Team Member — Personalized Dashboard**
[Hero section with your role + dept badge. "My Tasks" list on left. Department stats cards. Tailored quick actions on the right. Filtered sidebar on left.]

**Reels Form with Gallery Modal Open**
[Form fields for campaign + creative. Prominent "Browse Gallery Modal" button. Modal popup shows 2-3 column grid of asset thumbnails with titles/types. Clickable cards highlight selected.]

**Creative Asset Detail + Link to Reel**
[Large image preview. Prompt + negative prompt displayed. "Link to Reel" form with text input + submit. "Linked Reel: [id]" badge if already connected.]

**Client Report PDF Preview (after export)**
[Beautiful cover page with logo, agency + client name, date. Clean TOC. Sections with headings. Footer: "Generated by Your Agency • Confidential".]

**Video Walkthrough Placeholders** (replace with real links when recorded):
- Admin: "Adding a new team member + setting dept & quotas" (3 min)
- Team Member: "First 10 minutes: Login → First Reel + Asset + Report" (4 min)
- "Understanding your RBAC permissions" (2 min)

---

## Next Steps & Feedback

- Bookmark this page.
- Join your team's internal channel for AgentFlow questions.
- As you use the platform, note anything confusing and tell your Admin/Owner — the product is actively improved based on real usage.

**Questions?** Reach out to your workspace Owner or check `docs/ARCHITECTURE.md` / `docs/RBAC_IMPLEMENTATION.md` for deeper technical details.

Happy building! 🚀

---
*Last updated: 2026-07-03 — Keep this guide in sync with product changes.*