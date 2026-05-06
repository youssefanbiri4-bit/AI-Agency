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

## 14. Production Smoke Check

- Confirm the production URL loads.
- Confirm `/dashboard/reports` opens in production.
- Confirm navigation between dashboard, agents, tasks, reviews, reports, and settings.
- Confirm desktop and mobile layouts do not have page-level horizontal scroll.
- Confirm no deployment or environment changes are required for this checklist.

## 15. Regression Guardrails

Before changing task execution, callback handling, reports, or review behavior, verify:

- No Supabase schema changes are needed.
- No n8n workflow changes are needed.
- No callback route changes are needed.
- No `callbackPayload` shape changes are needed.
- No task execution logic changes are needed.
- No environment variable changes are needed.
