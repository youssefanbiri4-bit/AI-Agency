# Architecture

Project: AgentFlow AI / AI Agency Dashboard

This document describes the current production-tested architecture at the Phase 10A documentation-only baseline. It does not include secret values.

## Frontend App

AgentFlow AI is a Next.js application with a marketing entry point, authentication pages, onboarding, and a protected dashboard. The app uses TypeScript, React, and CSS/Tailwind styling.

The frontend is responsible for:

- Navigation and layout.
- Authentication UI.
- Workspace onboarding.
- Agent catalog views.
- Task creation.
- Task list and task details.
- Review actions.
- Report rendering.
- Copy and PDF export interactions.
- Reports search and filters.
- Organic Instagram Reels planning, drafting, preview, and safe publishing readiness.
- Creative Assets prompt generation and server-gated OpenAI image generation readiness.

## Dashboard Routes

Key routes include:

- `/`
- `/auth/login`
- `/auth/signup`
- `/auth/callback`
- `/onboarding`
- `/dashboard`
- `/dashboard/agents`
- `/dashboard/agents/[id]`
- `/dashboard/create-task`
- `/dashboard/tasks`
- `/dashboard/tasks/[id]`
- `/dashboard/review`
- `/dashboard/reports`
- `/dashboard/campaigns`
- `/dashboard/reels`
- `/dashboard/reels/new`
- `/dashboard/reels/[id]`
- `/dashboard/creative-assets`
- `/dashboard/creative-assets/new`
- `/dashboard/creative-assets/[id]`
- `/dashboard/settings`
- `/privacy`
- `/terms`

## Supabase Auth And Database

Supabase provides authentication and persistence. The app uses Supabase for:

- User sessions.
- Workspace records.
- Workspace membership.
- Department and agent catalog records.
- Tasks.
- Task events.
- Task reviews.
- Stored task results.
- Reels Studio drafts and publishing state.
- Creative asset prompts, generation status, and stored image references.

Client-side code uses public Supabase configuration only. Server-only code handles privileged reads and writes where needed, including automation callbacks.

## Workspace Model

AgentFlow AI scopes dashboard data by active workspace. A signed-in user needs an active workspace before using the operational dashboard. Tasks, reviews, and events are tied to the workspace, which keeps user data separated by workspace context.

## Task Lifecycle

Primary lifecycle:

```text
pending -> processing -> needs_review -> completed
```

Revision lifecycle:

```text
needs_review -> pending -> processing -> needs_review
```

Failure lifecycle:

```text
processing -> failed -> retry -> processing
```

Supported task statuses include:

- `draft`
- `pending`
- `processing`
- `needs_review`
- `completed`
- `failed`
- `cancelled`

The active production flow uses `pending`, `processing`, `needs_review`, `completed`, and `failed`.

## n8n Webhook Flow

Task execution begins from the Task Details page. A server-side route validates the user, workspace, task ownership, and task status. It then sends a task payload to the configured n8n production webhook.

The payload includes:

- Task ID.
- Workspace ID.
- Agent ID.
- Agent name.
- Department.
- Task title.
- Task description.
- Priority.
- Callback URL.
- Compatibility fields in camelCase and snake_case.
- Optional revision notes when the task was previously sent back for changes.

Before the n8n request, the app moves the task to `processing`.

## Callback Flow

n8n calls back into AgentFlow AI after workflow execution. The callback endpoint validates the configured callback secret header before processing the payload.

On success:

- The result is stored on the task.
- The task moves to `needs_review`.
- A task event is created.

On failure:

- The error message is stored.
- The task moves to `failed`.
- A task event is created.

The stable callback contract is documented in `docs/N8N_V5_CONTRACT.md`.

## Review Flow

Tasks with `needs_review` status can be reviewed by the user. Review actions are intentionally unavailable for statuses that should not be approved or revised.

Approve:

```text
needs_review -> completed
```

Request Changes:

```text
needs_review -> pending
```

Both actions create review records.

## Request Changes v2 And Revision Notes

Request Changes v2 requires feedback. That feedback is stored as a review record and becomes revision context for the next automation run.

When the task is rerun, the latest non-empty review feedback is included in the n8n request as:

- `revisionNotes`
- `revision_notes`

This keeps the n8n workflow compatible with both camelCase and snake_case input styles.

## Reports Generation

AgentFlow AI extracts structured output from stored task results. The report renderer supports:

- Summary.
- Analysis.
- Content plan.
- Outreach plan.
- Recommendations.
- Next actions.
- Quality notes.
- Metadata.
- Raw JSON fallback.

The Reports Page builds a generated report list from tasks that:

- Have `completed` or `needs_review` status.
- Have a stored result.

It excludes `pending`, `processing`, and `failed` tasks.

## Production Domain And Launch Readiness

The Settings page includes a Production Domain & Launch Readiness section.

Current supported behavior:

- Shows the current production URL: `https://agentflow-ai-sigma.vercel.app`.
- Shows custom domain status as not connected yet.
- Lists the manual Vercel/DNS launch checklist.
- Reminds operators that custom domain connection is managed through Vercel and the DNS provider.

The app does not call the Vercel API and does not store custom domain settings in Supabase in this phase.

## In-app Notifications Foundation

AgentFlow AI includes a workspace/user-scoped notifications table and dashboard UI.

Current supported notification behavior:

- Notification bell in the dashboard topbar with unread count.
- Latest notifications dropdown with mark-as-read and mark-all-as-read actions.
- Notifications page at `/dashboard/notifications`.
- Server-rendered latest notifications scoped to the active workspace and signed-in user.
- Notification records for task review readiness, task completion, task failure, campaign task creation, and Reels Studio events.
- Notification records for Creative Asset creation, prompt readiness, image generation success, and image generation failure.

The `notifications` table stores `id`, `workspace_id`, `user_id`, `type`, `title`, `message`, `status`, `metadata`, `created_at`, and `read_at`. RLS allows authenticated users to select, insert, and update only their own notifications in workspaces they belong to. Service-role server flows can create callback notifications after validating their existing boundaries.

Email notifications, browser push notifications, realtime subscriptions, and external notification providers are not connected in this phase.

## Instagram Reels Studio

The Reels Studio module is an organic Instagram Reels planning workflow.

Current supported behavior:

- Sidebar navigation entry for Reels Studio.
- Reels overview at `/dashboard/reels` with draft, ready, scheduled, published, and failed counts.
- New Reel form at `/dashboard/reels/new` for campaign basics, creative planning, captions, hashtags, media references, and scheduling metadata.
- Reel detail page at `/dashboard/reels/[id]` with preview, script, caption, hashtags, media, status timeline, publishing readiness, and edit form.
- Normal pending AI task creation for Reel scripts and captions.
- Best-effort notifications for draft creation, ready state, publishing outcomes, and AI task creation.

The `public.reels` table stores workspace/user-scoped organic Reel records. RLS prevents cross-workspace access and requires `auth.uid()` to match `user_id` on inserts.

Instagram Reels publishing is a gated foundation. The UI shows setup-required states until Meta app configuration, Instagram content publishing permissions, Facebook Page connection, Instagram Business/Creator account metadata, and a public video URL are available. No automatic publishing occurs; publishing requires an explicit user click.

Reels Studio does not create, edit, pause, delete, or publish ads or campaigns. It does not request `ads_management` and does not change the read-only Meta Ads tracking integration.

## Creative Assets And OpenAI Image Foundation

Creative Assets is a workspace-scoped prompt and image asset system.

Current supported behavior:

- Sidebar navigation entry for Creative Assets.
- Asset overview at `/dashboard/creative-assets` with total assets, draft prompts, generated images, and failed generation counts.
- New asset form at `/dashboard/creative-assets/new` for creative brief fields, prompt builder fields, aspect ratio, output style, and generation mode.
- Asset detail page at `/dashboard/creative-assets/[id]` with brief, prompt, negative prompt, image preview, status timeline, source, and future Reel/Campaign placement hints.
- Deterministic prompt generation works without `OPENAI_API_KEY`.
- Real image generation is disabled until `OPENAI_API_KEY` is configured server-side.
- OpenAI calls are made only from server actions through `src/lib/ai/openai-images.ts`.
- Generated base64 image data is not stored in the database; image files should be uploaded to Supabase Storage bucket `creative-assets`.
- Settings shows AI Image Generation Readiness without displaying any secret values.

The `public.creative_assets` table stores workspace/user-scoped creative records. RLS prevents cross-workspace access and requires `auth.uid()` to match `user_id` on inserts. The storage bucket is private, with object policies scoped by workspace path.

Required future environment variable:

- `OPENAI_API_KEY`

Optional future environment variables:

- `OPENAI_IMAGE_MODEL`
- `OPENAI_IMAGE_SIZE`
- `OPENAI_IMAGE_QUALITY`

OpenAI image generation may incur paid API usage. Creative Assets does not automatically publish ads, does not create campaigns, and does not include a video editor.

## Meta Ads Read-only Tracking

The Campaigns page includes a read-only Meta Ads / Instagram and Facebook integration.

Current supported Meta behavior:

- Connect Meta through OAuth with `ads_read`.
- Store the Meta access token encrypted server-side.
- Display connected Meta ad accounts.
- Display campaigns for each connected ad account.
- Fetch campaign-level last 30 days insights server-side.
- Show spend, impressions, reach, clicks, CTR, CPC, CPM, and summarized lead/conversion counts.
- Generate deterministic local performance diagnosis from real metrics.
- Create a normal pending AgentFlow task from a selected Meta campaign analysis brief.

The insights request uses the Graph API campaign insights endpoint with `date_preset=last_30d`, `level=campaign`, and safe read-only fields only. Access tokens are sent in the `Authorization: Bearer` header and are not placed in query params.

The app does not fetch Meta ad sets, ads, creatives, or lead records in the current integration. Raw Meta `actions` are summarized server-side into lead and conversion counts before reaching the UI.

Meta publishing is not connected. The app does not request `ads_management` and does not create, update, pause, delete, or publish ads or campaigns. Publishing will require a future approval flow and additional Meta permissions.

Organic Instagram Reels publishing readiness is handled separately in `src/lib/ads/instagram-publishing.ts`. That helper checks content publishing scopes and Instagram account metadata before enabling a publish attempt and does not alter the Meta Ads read-only OAuth scope.

## Pinterest Ads Provider Foundation

The Campaigns page also includes a safe-disabled Pinterest Ads provider foundation.

Current supported Pinterest behavior:

- Read server-only Pinterest configuration readiness.
- Show setup-required UI when `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, or `PINTEREST_REDIRECT_URI` is missing.
- Build a Pinterest OAuth URL only when all required environment variables exist.
- Request read-only scopes only: `ads:read` and `user_accounts:read`.
- Provide placeholder connect and callback routes under `/api/ads/pinterest`.

Pinterest token exchange and storage are not enabled yet. The `ad_connections` database check constraint allows `pinterest`, but the Pinterest callback remains safe-disabled until a future connection phase. No Pinterest publishing is connected.

## Google Ads Read-Only Connection

The Campaigns page includes a Google Ads OAuth connection for read-only customer account discovery, campaign display, and last 30 days campaign metrics.

Current supported Google Ads behavior:

- Read server-only Google Ads configuration readiness.
- Show setup-required UI when `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, or `GOOGLE_ADS_REDIRECT_URI` is missing.
- Build a Google OAuth URL only when all required environment variables exist.
- Request only the Google Ads API OAuth scope: `https://www.googleapis.com/auth/adwords`.
- Validate signed-in user, active workspace, and OAuth CSRF state.
- Exchange Google OAuth codes server-side.
- Store Google access and refresh tokens encrypted in `ad_connections` with provider `google_ads`.
- Refresh expired Google access tokens server-side from the encrypted refresh token.
- List accessible Google Ads customer resource names through `customers:listAccessibleCustomers`.
- Fetch campaign rows through GoogleAdsService `searchStream` with GAQL for `campaign.id`, `campaign.name`, `campaign.status`, `campaign.advertising_channel_type`, `campaign.start_date`, `campaign.end_date`, `metrics.impressions`, `metrics.clicks`, `metrics.ctr`, `metrics.average_cpc`, `metrics.cost_micros`, `metrics.conversions`, and `metrics.conversions_value`.
- Display safe customer IDs/resource names, campaign fields, and converted aggregate metrics only.
- Create a normal pending AgentFlow AI analysis task from a selected Google Ads campaign metrics row.

Google Ads ad group, ad, creative, keyword, search term, conversion record, background sync, campaign database storage, campaign creation, edits, pauses, deletes, and publishing are not connected in this phase. `GOOGLE_ADS_CLIENT_SECRET` and `GOOGLE_ADS_DEVELOPER_TOKEN` must stay only in server environment variables.

## Error Handling And Retry

Failed workflow responses move tasks to `failed` and store an error object. The Task Details page shows the failure state and exposes Retry for failed tasks.

Retry sends the task back through the same execution path:

```text
failed -> processing
```

If the rerun succeeds, the task returns to `needs_review`.

## Deployment On Vercel

The app is deployed on Vercel and has been verified in production at:

```text
https://agentflow-ai-sigma.vercel.app
```

Vercel hosts the Next.js application and server routes. Environment variables are managed in the hosting environment and should not be committed to the repository.

## Security Notes

- Do not commit secret values.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Keep n8n webhook URL and callback secret server-side.
- Keep `META_APP_SECRET` server-only.
- Keep `PINTEREST_APP_SECRET` server-only.
- Keep `GOOGLE_ADS_CLIENT_SECRET` server-only.
- Keep `GOOGLE_ADS_DEVELOPER_TOKEN` server-only.
- Keep `OPENAI_API_KEY` server-only and never add `NEXT_PUBLIC_OPENAI_API_KEY`.
- Keep `AD_TOKEN_ENCRYPTION_KEY` server-only.
- Decrypt ad platform tokens only in server helpers.
- Do not expose callback secret values in UI, logs, reports, or exports.
- Do not expose Meta, Pinterest, or Google Ads tokens, encrypted tokens, OAuth codes, full API URLs with paging cursors, or secrets in UI, logs, reports, or exports.
- Keep notifications scoped by `workspace_id` and `user_id`; do not show cross-workspace or cross-user notifications.
- Keep Meta OAuth scopes read-only unless a separate publishing plan is approved.
- Keep Reels Studio organic-only; do not add ad publishing, campaign creation, or `ads_management`.
- Keep Pinterest OAuth scopes read-only unless a separate publishing plan is approved.
- Keep Google Ads OAuth scopes read-only unless a separate publishing plan is approved.
- Keep Creative Assets workspace-scoped and store generated images in Supabase Storage, not as base64 database values.
- Preserve callback route validation.
- Preserve the stable `callbackPayload` shape unless a planned integration migration is approved.
- Keep workspace scoping intact for task, review, and report data.
