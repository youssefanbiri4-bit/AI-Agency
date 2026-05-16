# Saved Playbooks Guide

Saved Playbooks preserve reusable Workflow Builder drafts.

## Page

```text
/dashboard/agent-library/playbooks
```

## Saved Data

Playbooks store:

- Workflow name, description, goal, and notes
- Ordered template steps
- Visual diagram model and Mermaid text
- Readiness summary
- Safe next actions
- Favorite/status metadata

They do not store secrets, provider responses, webhook secrets, API keys, or raw private chat content.

## Actions

- Save from Workflow Builder
- Update saved playbook
- Duplicate as a new playbook
- Open in Workflow Builder with `?playbook=<playbook-id>`
- Favorite/unfavorite
- Export Markdown
- Create pending tasks with confirmation
- Delete saved playbook with confirmation

Delete only removes the saved playbook. It does not remove tasks, content, provider data, or n8n workflows.

## Required Migration

Apply:

```text
supabase/migrations/20260515103000_create_agent_workflow_playbooks.sql
```
