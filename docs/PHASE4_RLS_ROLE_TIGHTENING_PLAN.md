# Phase 4 RLS Role Tightening Plan

Current production hardening keeps workspace isolation in Supabase RLS and
enforces fine-grained roles in server actions/routes.

## Keep Workspace-Member Readable

- `workspaces`
- `workspace_members`
- `tasks`
- `task_reviews`
- `task_events`
- `content_studio_items`
- `creative_assets`
- `prompt_library`
- `releases`
- `backup_records`
- `notifications` scoped to `user_id`
- reporting source tables that are already workspace-scoped

## Tighten Writes In Future Migrations

Use role-aware database functions before changing policies broadly:

- `tasks`: create/edit by owner/admin/operator/editor, run status changes by owner/admin/operator.
- `task_reviews`: create by owner/admin/operator/editor.
- `content_studio_items`: create/edit by owner/admin/operator/editor; publish/schedule fields by owner/admin/operator.
- `creative_assets`: create/edit by owner/admin/operator/editor; delete by owner/admin.
- `prompt_library`: create/edit by owner/admin/operator/editor; delete by owner/admin.
- `releases`: write by owner/admin.
- `backup_records`: create/archive by owner/admin.
- `integration_settings`: write by owner/admin.

## Keep Service-Role Only

- `ad_connections`
- provider token storage
- OAuth callback token writes
- n8n callback idempotency records
- scheduler service operations

## Recommended Approach

Keep role enforcement server-side until Supabase role data can be evaluated
reliably in policies through stable helper functions. Custom JWT claims are not
recommended yet because workspace role can vary per workspace and must reflect
active membership changes quickly.
