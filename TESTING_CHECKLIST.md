# AgentFlow AI Testing Checklist

Use this checklist to verify the current production-ready portfolio state. These are manual smoke checks for the critical flows until broader automated test coverage is added.

Production URL: https://agentflow-ai-sigma.vercel.app

## 1. Login And Auth

- Open the production URL.
- Visit `/dashboard` while signed out.
- Confirm the app redirects to the login flow.
- Sign in with a valid Supabase user.
- Confirm the dashboard loads only after authentication.
- Sign out and confirm protected dashboard routes are no longer accessible.

## 2. Workspace

- Confirm a signed-in user with no active workspace is sent to onboarding.
- Create or select a workspace.
- Confirm dashboard data is scoped to the active workspace.
- Confirm tasks and reviews are shown only for the active workspace.

## 3. Agents

- Open `/dashboard/agents`.
- Confirm all 18 agents are available.
- Confirm agents are grouped across:
  - Research & Strategy
  - Content & Growth
  - Sales & Operations
- Open an agent detail page and confirm the agent metadata loads.

## 4. Create Task

- Open `/dashboard/create-task`.
- Submit with missing required fields and confirm validation blocks the action.
- Select an agent, add a title, description, and priority.
- Submit the task.
- Confirm the task is created with `pending` status.
- Confirm the task appears on `/dashboard/tasks`.
- Open the Task Details page.

## 5. Run Task And n8n Execution

- From a `pending` task, click Run Task.
- Confirm the task moves to `processing`.
- Confirm the app sends the task to the n8n v5/7B production workflow.
- Confirm Research, Content, and Sales agent tasks can execute successfully.
- Confirm the task does not expose secret values in the UI or stored report output.

## 6. Callback And needs_review

- Wait for n8n to call back into AgentFlow AI.
- Confirm the task moves from `processing` to `needs_review`.
- Confirm structured output is stored on the task.
- Confirm the Task Details page renders a Client-ready Report.
- Confirm failed callback responses move the task to `failed` with a visible error message.

## 7. Client-ready Report

- Open a task with `needs_review` or `completed` status.
- Confirm the report includes the executive summary when available.
- Confirm structured sections render from analysis, content plan, or outreach plan data.
- Confirm recommendations render when present.
- Confirm next actions render when present.
- Confirm quality notes render when present.
- Confirm raw output fallback remains available when structured output is incomplete.

## 8. Copy Report

- Open Task Details for a task with a Client-ready Report.
- Click Copy Report.
- Confirm the copied text is a readable Markdown-style client report.
- Confirm no secret values or internal callback metadata are included in the copied report.

## 9. Export PDF

- Open Task Details for a task with a Client-ready Report.
- Click Export PDF.
- Confirm a printable/exportable report is generated.
- Confirm the PDF includes the client-ready report content.
- Confirm no secret values are included in the export.

## 10. Approve

- Prepare a task with `needs_review` status.
- Open the Task Details page or review flow.
- Click Approve.
- Confirm a review record is created.
- Confirm the task moves from `needs_review` to `completed`.
- Confirm the approved task remains visible on the Reports Page.

## 11. Request Changes v2

- Prepare a task with `needs_review` status.
- Click Request Changes.
- Submit empty feedback and confirm validation requires revision notes.
- Submit clear reviewer feedback.
- Confirm a review record is created.
- Confirm the task moves from `needs_review` to `pending`.
- Rerun the task.
- Confirm the saved feedback reaches n8n as `revisionNotes` and `revision_notes`.
- Confirm n8n uses those notes in the prompt for the revised run.

## 12. Error Handling And Retry

- Prepare or simulate a failed task.
- Confirm the Task Details page shows the failure state and error message.
- Confirm Retry is available for failed tasks.
- Click Retry.
- Confirm the task moves back to `processing`.
- Confirm a successful retry can return to `needs_review`.

## 13. Reports Page

- Open `/dashboard/reports`.
- Confirm generated reports from `completed` tasks appear.
- Confirm generated reports from `needs_review` tasks appear.
- Confirm `pending`, `processing`, and `failed` tasks are excluded.
- Search by report title, summary, agent, department, or status.
- Confirm department filter works.
- Confirm status filter works.
- Click Open Report.
- Confirm the link opens the matching Task Details page.

## 14. Campaigns And Meta Ads Read-only Tracking

- Open `/dashboard/campaigns`.
- Confirm the Meta connection state is visible.
- Confirm the connect/reconnect action points to the Meta OAuth flow.
- Confirm only `ads_read` is presented as the required Meta scope.
- With a connected Meta account, confirm ad accounts are displayed.
- Confirm campaigns are displayed under each ad account.
- Confirm last 30 days campaign insights are displayed when available.
- Confirm metrics show spend, impressions, reach, clicks, CTR, CPC, CPM, leads, and conversions.
- Confirm raw Meta JSON, raw `actions`, tokens, encrypted tokens, OAuth codes, full Graph URLs, and `paging.next` are not shown.
- Confirm no ad sets, ads, creatives, or lead records are fetched or displayed.
- Confirm token invalid state prompts reconnect.
- Confirm permission issue state is clear and does not hide the whole Campaigns page.
- Confirm no campaigns state is clear.
- Confirm no insights state is clear.
- Confirm local diagnosis appears and uses cautious wording.
- Click Create AI Analysis Task under a campaign with loaded insights.
- Confirm the task is created as a normal `pending` AgentFlow task.
- Confirm the app redirects to Task Details after creation.
- Confirm the task title starts with `[Meta Campaign Analysis]`.
- Confirm the task brief includes Meta platform, ad account, campaign, campaign ID, status, objective, last_30d date range, metrics, local diagnosis, and requested analysis sections.
- Confirm the task does not run automatically.
- Run the task manually from Task Details and confirm the normal flow remains `pending -> processing -> needs_review -> completed`.
- Confirm the completed task appears in Reports after approval/completion.
- Confirm no Meta publishing action exists.
- Confirm `ads_management` is not requested.

## 15. Production Smoke Check

- Confirm the production URL loads.
- Confirm `/dashboard/reports` opens in production.
- Confirm navigation between dashboard, agents, tasks, reviews, reports, notifications, and settings.
- Confirm desktop and mobile layouts do not have page-level horizontal scroll.
- Confirm no deployment or environment changes are required for this checklist.

## 15A. Reels Studio

- Open `/dashboard/reels`.
- Confirm the Reels Studio sidebar item is visible and active on Reels routes.
- Confirm overview cards show Drafts, Ready, Scheduled, Published, and Failed.
- Click New Reel and confirm `/dashboard/reels/new` opens.
- Fill campaign basics, creative planning, hashtags, media references, subtitles, music note, and optional scheduled date.
- Click Save Draft and confirm the detail page opens.
- Confirm the Reel appears in the list with title, Instagram platform, status, goal, scheduled date, published date, created date, and updated date.
- Open the Reel detail page and confirm preview, script, caption, hashtags, media, status timeline, publishing readiness, and edit form appear.
- Click Mark Ready and confirm the Reel moves to `ready`.
- Click Create AI Script Task and confirm a normal `pending` task is created with a title starting `[Instagram Reel Script]`.
- Click Create AI Caption Task and confirm a normal `pending` task is created with a title starting `[Instagram Reel Caption]`.
- Confirm AI task creation does not auto-run n8n.
- Confirm Reels notifications are created when supported by the database.
- With missing Instagram publishing setup, confirm the UI shows: “Instagram publishing setup required. Connect an Instagram Business or Creator account with content publishing permissions.”
- Confirm the Publish button is hidden unless readiness checks pass.
- Confirm no Meta token, encrypted token, app secret, OAuth code, credentialed API URL, or raw Meta error is shown.
- Confirm Reels Studio does not create ads, campaigns, ad sets, creatives, or request `ads_management`.
- Confirm no automatic publishing occurs.

## 16. Pinterest Ads Provider Foundation

- Open `/dashboard/campaigns`.
- Confirm the Pinterest Ads card appears under Ad Platform Connections.
- With missing Pinterest env vars, confirm the card shows Setup Required.
- Confirm the card lists missing environment variable names only, not values.
- Confirm the button is disabled and reads Setup in Vercel first.
- Confirm only read-only scopes are shown: `ads:read` and `user_accounts:read`.
- Visit `/api/ads/pinterest/connect` while env vars are missing.
- Confirm it redirects back to `/dashboard/campaigns?pinterest=setup_required`.
- Confirm no Pinterest token is stored.
- Confirm no Pinterest publishing action exists.
- Confirm no write scopes are requested.

## 17. Google Ads Read-Only Connection

- Open `/dashboard/campaigns`.
- Confirm the Google Ads card appears under Ad Platform Connections.
- With missing Google Ads env vars, confirm the card shows Setup Required.
- Confirm the card lists missing environment variable names only, not values.
- Confirm the button is disabled and reads Setup in Vercel first.
- With Google Ads env vars configured, confirm the card allows Connect Google Ads.
- Confirm the OAuth URL requests only the Google Ads API scope: `https://www.googleapis.com/auth/adwords`.
- Visit `/api/ads/google/connect` while env vars are missing.
- Confirm it redirects back to `/dashboard/campaigns?google_ads=setup_required`.
- Complete Google OAuth and confirm redirect back to `/dashboard/campaigns?google_ads=connected`.
- Confirm Google Ads access and refresh tokens are stored encrypted server-side only.
- Confirm the Campaigns page shows connected Google Ads state.
- Confirm accessible Google Ads customer accounts are listed by safe customer ID/resource name only.
- Confirm Google Ads campaigns are displayed under each inspected customer account.
- Confirm last 30 days metrics are displayed when available.
- Confirm metrics show impressions, clicks, CTR, average CPC, cost, conversions, and conversion value.
- Confirm average CPC and cost are displayed in normal currency units, not micros.
- Confirm no campaigns state shows “No campaigns found.”
- Confirm no metrics state shows “No metrics available.”
- Confirm token invalid state prompts reconnect.
- Confirm permission issue, developer token/API issue, and generic error states are safe and do not expose raw Google API JSON.
- Click Create AI Analysis Task under a Google Ads campaign.
- Confirm the task is created as a normal `pending` AgentFlow task.
- Confirm the app redirects to Task Details after creation.
- Confirm the task title starts with `[Google Ads Campaign Analysis]`.
- Confirm the task brief includes Google Ads platform, customer ID, campaign ID, campaign name, last 30 days date range, status, channel type, impressions, clicks, CTR, average CPC, cost, conversions, conversion value, and requested analysis instruction.
- Confirm the task does not run automatically.
- Confirm no Google Ads token, refresh token, client secret, developer token, auth code, or credentialed API URL appears in UI, logs, reports, notifications, or exports.
- Confirm expired access tokens refresh server-side from the encrypted refresh token.
- Confirm no Google Ads publishing action exists.
- Confirm no ad groups, ads, creatives, keywords, search terms, or conversion records are fetched or displayed.
- Confirm no Google Ads campaign storage or background sync exists.
- Confirm no write or publish route exists.
- Confirm the provider constraint allows `meta`, `google_ads`, and `pinterest`, and does not allow LinkedIn.

## 18. Production Domain & Launch Readiness

- Open `/dashboard/settings`.
- Confirm the Production Domain & Launch Readiness section appears.
- Confirm Current Production URL shows `https://agentflow-ai-sigma.vercel.app`.
- Confirm Custom Domain shows Not connected yet.
- Confirm Status says ready to connect custom domain from Vercel.
- Confirm the launch checklist includes DNS, SSL, redirect URI updates, redeploy, login, task, callback, reports, campaigns, and ad platform connection checks.
- Confirm the warning explains domain connection is managed in Vercel and DNS provider.
- Confirm there is no Vercel API connection or custom domain database form.

## 19. In-app Notifications Foundation

- Confirm a notification bell appears in the dashboard topbar.
- Confirm the bell opens a dropdown or panel.
- Confirm unread count appears when unread notifications exist.
- Confirm `/dashboard/notifications` opens from the dropdown and sidebar.
- Confirm latest notifications are scoped to the signed-in user and active workspace.
- Confirm notifications from another user or workspace are not shown.
- Confirm Mark as read works for a single notification.
- Confirm Mark all as read clears unread state.
- Create a campaign task and confirm a campaign task notification is created.
- Complete a task through review approval and confirm a completed task notification is created.
- Let a task reach `needs_review` through n8n callback and confirm a review notification is created.
- Let a task fail through n8n callback or stale timeout and confirm a failure notification is created.
- Confirm no email is sent.
- Confirm no browser push notification is sent.
- Confirm no secrets or tokens are shown in notification title, message, metadata UI, or links.

## 19A. Creative Assets And OpenAI Image Foundation

- Open `/dashboard/creative-assets`.
- Confirm the Creative Assets sidebar item is visible and active on Creative Assets routes.
- Confirm overview cards show Total Assets, Draft Prompts, Generated Images, and Failed Generations.
- Click New Creative Asset and confirm `/dashboard/creative-assets/new` opens.
- Fill Creative Brief fields: title, type, platform, goal, offer, target audience, market, tone, style, visual direction, text overlay, brand colors, and notes.
- Fill Prompt Builder fields: prompt, negative prompt, aspect ratio, output style, and generation mode.
- With `OPENAI_API_KEY` missing, confirm the setup-required notice appears.
- With `OPENAI_API_KEY` missing, confirm Save Draft, Generate Image Prompt, Copy Prompt, and Save to Assets work where applicable.
- With `OPENAI_API_KEY` missing, confirm Generate Image and Regenerate are disabled.
- Click Generate Image Prompt and confirm a deterministic prompt and negative prompt are saved.
- Open the asset detail page and confirm Creative brief, Generated prompt, Negative prompt, Image preview, Status timeline, Source, and Linked placement sections appear.
- Confirm Copy Prompt copies only prompt text and no secrets.
- Confirm the detail page says the asset can be used later as Reel Cover or Ad Creative.
- Confirm no `OPENAI_API_KEY`, `NEXT_PUBLIC_OPENAI_API_KEY`, raw provider response, or base64 image payload appears in the browser.
- Confirm no automatic ad publishing occurs.
- After adding `OPENAI_API_KEY` in Vercel in a future phase, confirm Generate Image runs server-side and stores image output in Supabase Storage bucket `creative-assets`.
- Confirm generated images are stored as files or URLs, not large base64 database values.
- Confirm Creative Assets notifications are created when supported by the database.
- Confirm `/dashboard/settings` shows AI Image Generation Readiness without showing the actual key.

## 20. Regression Guardrails

Before changing task execution, callback handling, reports, or review behavior, verify:

- No Supabase schema changes are needed.
- No n8n workflow changes are needed.
- No callback route changes are needed.
- No `callbackPayload` shape changes are needed.
- No task execution logic changes are needed.
- No environment variable changes are needed.
- No Meta OAuth scope changes are needed.
- No Meta Ads publishing behavior is added without a future approval flow.
- No Instagram Reels automatic publishing is added.
- No Instagram Reels ad publishing or campaign creation is added.
- No Pinterest OAuth scope changes are needed.
- No Pinterest publishing behavior is added without a future approval flow.
- No Google Ads OAuth scope changes are needed.
- No Google Ads publishing behavior is added without a future approval flow.
- No OpenAI key is exposed to client components.
- No generated image base64 is stored in the database.
