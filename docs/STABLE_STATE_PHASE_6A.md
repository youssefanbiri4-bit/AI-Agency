# Stable State: Phase 6A

Date locked: 2026-05-05
Project: AgentFlow AI
Purpose: record the known-good production state before new feature work.

## Production State

Phase 6A is the current stable baseline. Production has been tested successfully with:

- Production URL reachable.
- Supabase, Auth, and workspace flows working.
- 18 configured agents available.
- Task creation working.
- n8n v5 production webhook working.
- Research, Content, and Sales tasks working.
- `callbackPayload` working.
- `structuredOutput` working.
- Client-ready Report rendering.
- Copy Report working.
- Approve changes `needs_review` to `completed`.
- Request Changes changes `needs_review` to `pending`.

## Stability Rules

Do not change the following without a new phase plan and explicit approval:

- Supabase schema.
- Auth logic.
- Workspace logic.
- Task creation.
- Task status flow.
- Approve logic.
- Request Changes logic.
- n8n callback API.
- `callbackPayload` structure.
- Environment variables.
- n8n workflow.
- Vercel settings.

## Task Status Flow

The stable task lifecycle is:

1. A user creates a task in an authenticated workspace.
2. The task is stored in Supabase with `pending` status.
3. Running the task sends it to the configured n8n production webhook.
4. The app updates the task to `processing`.
5. n8n calls back into the app.
6. A successful callback stores the result and moves the task to `needs_review`.
7. A failed callback stores an error result and moves the task to `failed`.
8. Approve stores a review and moves `needs_review` to `completed`.
9. Request Changes stores a review and moves `needs_review` to `pending`.

Supported database task statuses remain:

- `draft`
- `pending`
- `processing`
- `needs_review`
- `completed`
- `failed`
- `cancelled`

Phase 6A production behavior uses `pending`, `processing`, `needs_review`, `completed`, and `failed` in the active execution and review path.

## n8n Execution Boundary

Task execution is server-side only.

The app sends n8n this stable payload from `POST /api/tasks/execute`:

```json
{
  "taskId": "task-uuid",
  "workspaceId": "workspace-uuid",
  "agentId": "market_research",
  "agentName": "Market Research Agent",
  "department": "Research & Strategy",
  "title": "Task title",
  "description": "Task description",
  "priority": "Normal",
  "status": "processing",
  "callbackUrl": "https://production-domain.example/api/n8n/callback",
  "task_id": "task-uuid",
  "workspace_id": "workspace-uuid",
  "agent_type": "market_research",
  "callback_url": "https://production-domain.example/api/n8n/callback"
}
```

Both camelCase and snake_case task/workspace/callback keys are part of the stable n8n boundary and should remain compatible.

## Callback Result Contract

The production callback endpoint is:

```text
POST /api/n8n/callback
```

The callback must include the `x-n8n-callback-secret` header. The expected value is read from `N8N_CALLBACK_SECRET`.

The stable success callback stores `payload.result` as the task result and changes the task to `needs_review`.

The stable failure callback includes either:

- `status: "failed"`
- `error_message: "Reason"`

Failure changes the task to `failed` and stores an `error_message` result.

## structuredOutput Shape

The frontend extracts structured report data from these locations, in order:

1. `callbackPayload.structuredOutput`
2. `callbackPayload.result`
3. `callback_payload.structuredOutput`
4. `callback_payload.result`
5. `result.structuredOutput`
6. `result`
7. `structuredOutput`
8. The full task result object

The stable structured output shape is:

```json
{
  "summary": "Executive summary text",
  "analysis": {
    "keyFinding": "Value"
  },
  "contentPlan": {
    "topics": ["Topic A", "Topic B"]
  },
  "outreachPlan": {
    "audience": "Target audience"
  },
  "recommendations": ["Recommendation"],
  "nextActions": [
    {
      "title": "Action title",
      "description": "Action description",
      "priority": "high"
    }
  ],
  "qualityNotes": ["Quality note"],
  "metadata": {
    "taskId": "task-uuid",
    "workspaceId": "workspace-uuid",
    "departmentKey": "research_strategy",
    "agentName": "Market Research Agent",
    "agentId": "market_research"
  }
}
```

Accepted `nextActions[].priority` values are `high`, `medium`, and `low`. Unknown priorities render as `medium`.

## Frontend Report Behavior

Task detail pages render output as follows:

- If the task failed, show the error message.
- If no result exists, show the empty state.
- If no structured output can be extracted, show the raw JSON block.
- If structured output exists, render the Client-ready Report, summary, details, recommendations, next actions, quality notes, and raw output.
- Copy Report copies a Markdown version of the Client-ready Report to the clipboard.

The Client-ready Report includes:

- Executive Summary.
- Main Report Section from `analysis`, `contentPlan`, and `outreachPlan`.
- Recommendations.
- Next Actions.
- Quality Notes.
- `Generated by AgentFlow AI`.

## Lock Notes

This document records behavior only. It does not change schema, auth, workspace behavior, task creation, status transitions, n8n callback behavior, environment variables, n8n workflows, or deployment settings.
