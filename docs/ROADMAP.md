# Roadmap

Date updated: 2026-05-07
Project: AgentFlow AI / AI Agency Dashboard

## Current Stable State

AgentFlow AI is currently in a production-tested portfolio state. The core SaaS dashboard, Supabase-backed workspace model, n8n automation flow, review system, report rendering, retry path, reports dashboard, Reels Studio drafting workflow, Creative Assets prompt workflow, OpenAI image generation foundation, in-app notifications foundation, domain launch-readiness UI, and read-only Meta Ads tracking foundation have been verified or prepared for production smoke testing.

The Meta Ads integration remains read-only. It requests `ads_read`, does not request `ads_management`, does not publish ads, and does not create, update, pause, or delete ad platform resources. Pinterest Ads remains a provider foundation. Google Ads can connect, store encrypted tokens server-side, list accessible customer accounts, display read-only campaigns with last 30 days metrics, and create pending AI analysis tasks from those metrics.

Reels Studio is organic Instagram content planning only. It supports draft, preview, AI task creation, media references, status management, and a gated Instagram Reels publishing foundation. It does not publish ads, does not request `ads_management`, does not create campaigns, and does not publish automatically.

Creative Assets supports prompt generation without an OpenAI key. Real image generation is disabled until `OPENAI_API_KEY` is configured server-side in Vercel. Generated images should be stored in Supabase Storage bucket `creative-assets`; usage may incur OpenAI API cost. No automatic ad publishing and no video editor are connected.

## Completed

- Core dashboard shell and protected dashboard pages.
- Supabase Auth integration.
- Workspace onboarding and active workspace scoping.
- 18 AI agents across 3 departments.
- Task creation.
- Tasks page.
- Task Details page.
- n8n v5/7B production integration.
- Stable callback handling.
- Stable `callbackPayload` and `structuredOutput` rendering.
- Structured reviews.
- Approve flow from `needs_review` to `completed`.
- Request Changes v2 from `needs_review` to `pending`.
- `revisionNotes` loop back into n8n.
- Client-ready Report rendering.
- Copy Report.
- Export PDF.
- Error Handling + Retry.
- Reports Page at `/dashboard/reports`.
- Campaigns Page at `/dashboard/campaigns`.
- Meta read-only OAuth connection.
- Meta ad account display.
- Meta campaign display.
- Meta last 30 days campaign insights display.
- Local deterministic Meta performance diagnosis.
- Normal AgentFlow AI analysis task creation from real Meta campaign metrics.
- Pinterest Ads provider foundation with read-only OAuth scopes.
- Pinterest setup-required state on the Campaigns page.
- Google Ads OAuth connection with encrypted token storage.
- Google Ads accessible customer account display.
- Google Ads read-only campaign and last 30 days metrics display.
- Normal AgentFlow AI analysis task creation from real Google Ads campaign metrics.
- Reels Studio at `/dashboard/reels`, `/dashboard/reels/new`, and `/dashboard/reels/[id]`.
- Instagram Reel draft, ready, scheduled, published, and failed status foundation.
- Reels AI script and caption task creation as normal pending AgentFlow tasks.
- Reels preview, media reference, and guarded publishing readiness UI.
- Creative Assets routes at `/dashboard/creative-assets`, `/dashboard/creative-assets/new`, and `/dashboard/creative-assets/[id]`.
- Creative asset table, RLS policies, prompt workflow, OpenAI image helper, and private `creative-assets` storage bucket foundation.
- AI Image Generation Readiness section in Settings.
- Production Domain & Launch Readiness UI in Settings.
- In-app notifications foundation with workspace/user scoped unread state.
- Production deployment on Vercel.

## Stable Task Flow

Successful flow:

```text
pending -> processing -> needs_review -> completed
```

Revision flow:

```text
needs_review -> pending
```

Failure and retry flow:

```text
processing -> failed -> retry -> processing
```

## Stable Contract References

- `docs/N8N_V5_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/FINAL_PRODUCTION_AUDIT.md`
- `TESTING_CHECKLIST.md`

These documents should be reviewed before changing task execution, callback handling, report rendering, review transitions, or n8n workflow behavior.

Custom domain connection remains a Vercel and DNS provider operation. AgentFlow AI shows launch-readiness guidance only and does not call the Vercel API or store domain settings in the database in this phase.

## Next Product Directions

### Ads & Growth Command Center

Build a focused command center for marketing operators and growth teams.

- Campaign overview dashboard.
- Channel and objective selection.
- Campaign status and performance summaries.
- Read-only Meta Ads / Instagram and Facebook tracking.
- Pinterest Ads read-only provider foundation.
- Google Ads read-only customer account, campaign, and metrics tracking.
- Last 30 days spend, delivery, click, and summarized conversion metrics.
- Safe local performance diagnosis from real metrics.
- AI analysis task creation from imported Meta and Google Ads metrics.
- Saved campaign briefs.
- AI-generated campaign recommendations.

### Campaign Planner And Analyzer

Add deeper planning and analysis workflows on top of the existing agent/task foundation.

- Campaign brief generator.
- Audience and offer analyzer.
- Creative angle planner.
- Creative Assets selection for campaign visuals and ad creative prompts.
- Landing page and funnel checklist.
- Post-campaign analysis reports.

### Instagram Reels Studio

Continue the organic Reels workflow without changing ad platform write behavior.

- Asset upload/storage integration beyond URL/reference fields.
- Creative Assets linking for Reel covers.
- Richer script and storyboard version history.
- Calendar view for scheduled Reels.
- Publishing audit log and explicit approval records.
- External video editor integration remains future work.

### Better Analytics

Improve visibility into real usage and delivery outcomes.

- Task volume by agent and department.
- Completion and failure rates.
- Review turnaround time.
- Report generation trends.
- Workspace-level activity metrics.

### Notifications

In-app notifications are now prepared for dashboard events. Email notifications, browser push notifications, realtime subscriptions, and notification preference persistence are future improvements.

### Future Ads API Write Integrations

Read-only Meta tracking is connected first. Real publishing remains future work and will require a separate approval flow, extra platform permissions, and careful operational safeguards.

- Meta ad publishing with explicit human approval.
- Google Ads API full connection.
- TikTok Ads API.

`ads_management` is not requested in the current Meta integration. Publishing should stay disconnected until the app has a dedicated approval UX, audit trail, and permission review.

Organic Instagram Reels publishing is separate from ads. The Reels Studio foundation remains gated behind Meta app configuration, `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, an Instagram Business/Creator account, a Facebook Page connection, a public video URL, and an explicit user Publish click.

Pinterest Ads connection requires `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, and `PINTEREST_REDIRECT_URI` in Vercel. The database provider constraint allows `pinterest`, but Pinterest token exchange and storage remain disabled until a future connection phase.

Google Ads connection requires `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, and `GOOGLE_ADS_REDIRECT_URI` in Vercel. Optional variables are `GOOGLE_ADS_LOGIN_CUSTOMER_ID` and `GOOGLE_ADS_API_VERSION`. Google Ads tokens are encrypted server-side in `ad_connections` with provider `google_ads`. The current phase fetches accessible customer accounts, read-only campaigns, and last 30 days campaign metrics only. It does not fetch ad groups, ads, creatives, keywords, search terms, conversion records, or publishing surfaces.

OpenAI image generation requires `OPENAI_API_KEY` in Vercel. Optional variables are `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_SIZE`, and `OPENAI_IMAGE_QUALITY`. The key must stay server-only; do not add `NEXT_PUBLIC_OPENAI_API_KEY`. Prompt generation remains deterministic and works without the key.

### Public SaaS Features

Add public SaaS capabilities only if the project moves beyond personal portfolio scope.

- Billing.
- Custom domain automation beyond Vercel/DNS setup notes.
- Team roles and permissions.
- Organization settings.
- Public documentation.
- Usage limits.
- Customer onboarding flows.

## Guardrails

Do not change the following without a separate implementation plan:

- Supabase schema.
- Auth logic.
- Workspace logic.
- Task creation behavior.
- Task status flow.
- Approve logic.
- Request Changes logic.
- n8n callback API.
- `callbackPayload` structure.
- Environment variable names or values.
- n8n workflow routing.
- Vercel project settings.
- Meta OAuth scopes.
- Meta publishing behavior.
- Instagram Reels automatic publishing.
- Instagram Reels ad publishing or campaign creation.
- Pinterest OAuth scopes.
- Pinterest publishing behavior.
- Google Ads OAuth scopes.
- Google Ads publishing behavior.
- OpenAI key handling or Creative Assets storage policies.
- Meta task execution, callback, review, or report rendering contracts.
