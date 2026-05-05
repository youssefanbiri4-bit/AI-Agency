# n8n v5 Production Contract

Date locked: 2026-05-05
Project: AgentFlow AI

This document is the stable integration contract between AgentFlow AI and the n8n v5 production webhook.

## Server Environment

The app uses these server-side values for execution:

- `TASK_EXECUTION_ENABLED=true`
- `N8N_WEBHOOK_URL`
- `N8N_CALLBACK_SECRET`
- `APP_BASE_URL`

Do not expose these values to client components. Do not rename or rotate them during the stable lock without a planned integration update.

## Execution Request

AgentFlow AI sends tasks to n8n from:

```text
POST /api/tasks/execute
```

The user must be authenticated, an active workspace must exist, the task must belong to that workspace, and the task status must be `pending` or `failed`.

Before calling n8n, the app updates the task to:

```json
{
  "status": "processing",
  "result": null
}
```

The request sent to `N8N_WEBHOOK_URL` is:

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
  "callback_url": "https://production-domain.example/api/n8n/callback",
  "revisionNotes": "Optional reviewer revision notes when a task is sent back for changes.",
  "revision_notes": "Optional reviewer revision notes when a task is sent back for changes."
}
```

The duplicate camelCase and snake_case fields are intentional compatibility fields. Keep both in n8n v5.

The `revisionNotes` and `revision_notes` fields are optional. AgentFlow includes them only when a task has non-empty reviewer feedback saved in `task_reviews.feedback`; fresh tasks omit these fields.

## Callback Endpoint

n8n v5 must call:

```text
POST /api/n8n/callback
```

Required header:

```text
x-n8n-callback-secret: <N8N_CALLBACK_SECRET>
```

The callback endpoint accepts `taskId` or `task_id`.

## Successful Callback

Stable success payload:

```json
{
  "taskId": "task-uuid",
  "status": "completed",
  "result": {
    "callbackPayload": {
      "structuredOutput": {
        "summary": "Executive summary text",
        "analysis": {},
        "contentPlan": {},
        "outreachPlan": {},
        "recommendations": [],
        "nextActions": [],
        "qualityNotes": [],
        "metadata": {
          "taskId": "task-uuid",
          "workspaceId": "workspace-uuid",
          "departmentKey": "research_strategy",
          "agentName": "Market Research Agent",
          "agentId": "market_research"
        }
      }
    }
  }
}
```

The app stores `result` on the task and changes status to `needs_review`.

## Failure Callback

Stable failure payload:

```json
{
  "taskId": "task-uuid",
  "status": "failed",
  "error_message": "Failure reason"
}
```

The app stores:

```json
{
  "error_message": "Failure reason"
}
```

The task changes to `failed`.

## callbackPayload Contract

`callbackPayload` is a stable wrapper used by the frontend report extractor. It may appear directly in the saved result or inside `result`.

Preferred shape:

```json
{
  "callbackPayload": {
    "structuredOutput": {
      "summary": "Executive summary text",
      "analysis": {},
      "contentPlan": {},
      "outreachPlan": {},
      "recommendations": [],
      "nextActions": [],
      "qualityNotes": [],
      "metadata": {
        "taskId": "task-uuid",
        "workspaceId": "workspace-uuid",
        "departmentKey": "research_strategy",
        "agentName": "Market Research Agent",
        "agentId": "market_research"
      }
    }
  }
}
```

Snake_case compatibility is also supported as `callback_payload`.

## structuredOutput Contract

`structuredOutput` is considered renderable when at least one of these fields has usable content:

- `summary`
- `analysis`
- `contentPlan`
- `outreachPlan`
- `recommendations`
- `nextActions`
- `qualityNotes`
- `metadata`

Stable fields:

```json
{
  "summary": "string",
  "analysis": "object, array, string, number, boolean, or null",
  "contentPlan": "object, array, string, number, boolean, or null",
  "outreachPlan": "object, array, string, number, boolean, or null",
  "recommendations": ["string"],
  "nextActions": [
    {
      "title": "string",
      "description": "string",
      "priority": "high | medium | low"
    }
  ],
  "qualityNotes": ["string"],
  "metadata": {
    "taskId": "string",
    "workspaceId": "string",
    "departmentKey": "string",
    "agentName": "string",
    "agentId": "string"
  }
}
```

Notes:

- Objects and arrays may be nested.
- JSON strings that contain valid JSON are parsed by the frontend.
- Internal fields such as `callbackPayload`, `structuredOutput`, `raw`, `rawOutput`, `taskId`, and `workspaceId` are hidden from detail rendering when they appear as report fields.

## Stable Status Mapping

| n8n callback condition | AgentFlow task status |
| --- | --- |
| no `error_message` and `status` is not `failed` | `needs_review` |
| `error_message` exists | `failed` |
| `status` is `failed` | `failed` |

Review actions after callback:

| Review action | Previous status | Next status |
| --- | --- | --- |
| Approve | `needs_review` | `completed` |
| Request Changes | `needs_review` | `pending` |

## Do Not Change During Stable Lock

- Callback path.
- Callback secret header.
- `callbackPayload` shape.
- `structuredOutput` field names.
- Task status mapping.
- Environment variable names.
- n8n workflow routing.
