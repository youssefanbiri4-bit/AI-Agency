# AgentFlow AI Testing Checklist

Use this checklist before treating the project as production-ready. These are manual smoke checks for the critical flows until automated tests are added.

## 1. Workspace Access

- Start the app locally with `npm run dev`.
- Visit `/dashboard` while signed out.
- Confirm you are redirected to `/auth/login?redirectTo=/dashboard`.
- Sign in with a valid Supabase user.
- Confirm `/dashboard` loads only after authentication.
- Clear the active workspace cookie or use a user with no workspace.
- Confirm the user is redirected to `/onboarding`.
- Create a workspace from onboarding.
- Confirm the dashboard shows only the active workspace data.

## 2. Task Creation

- Go to `/dashboard/create-task`.
- Confirm the 18 configured agents are available and grouped across the 3 departments.
- Submit with no agent, title, or description.
- Confirm validation prevents creation.
- Select an agent, add a title, description, and priority.
- Submit the form.
- Confirm the new task is stored with `pending` status.
- Confirm it appears on `/dashboard/tasks` and its detail page.

## 3. n8n Execution Guard

- Leave `N8N_WEBHOOK_URL` or `N8N_CALLBACK_SECRET` unset or as placeholders.
- Open a pending task detail page.
- Confirm `Run Task` is disabled and the UI says n8n is not connected.
- Set valid server-side n8n values, including `APP_BASE_URL` with the current ngrok HTTPS URL, and restart the dev server.
- Confirm `Run Task` becomes available only when `TASK_EXECUTION_ENABLED=true`, the webhook URL is valid, and the callback secret is set.

## 4. Callback Secret Validation

- Send a POST request to `/api/n8n/callback` with no `x-callback-secret` header.
- Confirm the API returns `401 Invalid callback secret`.
- Send a POST request with an incorrect `x-callback-secret`.
- Confirm the API returns `401 Invalid callback secret`.
- Send a POST request with the correct secret, a valid `task_id`, and a success payload.
- Confirm the task moves to `needs_review` and stores the callback result.
- Send a failure payload with `status=failed` or `error_message`.
- Confirm the task moves to `failed` and stores the error object.

## 5. Review Actions

- Prepare a task with `needs_review` status.
- Open `/dashboard/review?taskId=<task_id>`.
- Approve the task.
- Confirm a review record is created and the task moves to `completed`.
- Prepare another task with `needs_review` status.
- Request changes with empty feedback.
- Confirm validation requires feedback.
- Add feedback and request changes.
- Confirm a review record is created and the task moves back to `pending`.

## 6. Responsive Smoke Check

- Test `/`, `/auth/login`, `/auth/signup`, `/dashboard`, `/dashboard/agents`, `/dashboard/tasks`, `/dashboard/review`, `/dashboard/reports`, and `/dashboard/settings`.
- Check viewport widths `360px`, `390px`, `430px`, `768px`, and desktop.
- Confirm there is no page-level horizontal scroll.
- Confirm cards, buttons, tables, badges, and headers wrap inside the viewport.
- Confirm the desktop sidebar becomes a mobile drawer on small screens.
