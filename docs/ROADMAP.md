# Roadmap

Date updated: 2026-05-06
Project: AgentFlow AI / AI Agency Dashboard

## Current Stable State

AgentFlow AI is currently in a production-tested portfolio state. The core SaaS dashboard, Supabase-backed workspace model, n8n automation flow, review system, report rendering, retry path, reports dashboard, in-app notifications foundation, domain launch-readiness UI, and read-only Meta Ads tracking foundation have been verified or prepared for production smoke testing.

The Meta Ads integration remains read-only. It requests `ads_read`, does not request `ads_management`, does not publish ads, and does not create, update, pause, or delete ad platform resources. Pinterest Ads and Google Ads provider foundations are prepared but disabled until required server environment variables and platform API access are available.

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
- Google Ads provider foundation with OAuth readiness checks.
- Google Ads setup-required state on the Campaigns page.
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
- Google Ads read-only provider foundation.
- Last 30 days spend, delivery, click, and summarized conversion metrics.
- Safe local performance diagnosis from real metrics.
- AI analysis task creation from imported Meta metrics.
- Saved campaign briefs.
- AI-generated campaign recommendations.

### Campaign Planner And Analyzer

Add deeper planning and analysis workflows on top of the existing agent/task foundation.

- Campaign brief generator.
- Audience and offer analyzer.
- Creative angle planner.
- Landing page and funnel checklist.
- Post-campaign analysis reports.

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

- Meta publishing with explicit human approval.
- Google Ads API full connection.
- TikTok Ads API.

`ads_management` is not requested in the current Meta integration. Publishing should stay disconnected until the app has a dedicated approval UX, audit trail, and permission review.

Pinterest Ads connection requires `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, and `PINTEREST_REDIRECT_URI` in Vercel. The current database provider constraint only allows `meta`, so storing a successful Pinterest token will require a future migration to allow `pinterest` before enabling the full connection.

Google Ads connection requires `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, and `GOOGLE_ADS_REDIRECT_URI` in Vercel. Optional readiness variables are `GOOGLE_ADS_LOGIN_CUSTOMER_ID` and `GOOGLE_ADS_API_VERSION`. The current database provider constraint only allows `meta`, so storing a successful Google Ads token will require a future migration to allow `google_ads` before enabling the full connection. This foundation phase does not include publishing.

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
- Pinterest OAuth scopes.
- Pinterest publishing behavior.
- Google Ads OAuth scopes.
- Google Ads publishing behavior.
- Meta task execution, callback, review, or report rendering contracts.
