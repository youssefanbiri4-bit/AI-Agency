# AgentFlow AI Safety Guardrails

The Agent Library, Alex integration, Workflow Builder, and Saved Playbooks are designed for safe internal planning.

## Allowed

- Suggest templates
- Draft prompts
- Prepare plans
- Create pending tasks after confirmation
- Prefill Content Studio fields
- Export reference-only n8n plans
- Save reusable playbooks

## Blocked

- Automatic n8n execution
- Creating or editing live n8n workflows
- Provider publishing
- Automatic scheduling
- Live ad creation
- Spending money
- Data deletion without explicit confirmation
- GitHub writes
- Provider setting changes
- Secret exposure

## Secret Handling

Do not store or copy API keys, provider tokens, webhook secrets, private provider responses, `.env` values, or service-role keys into templates, notes, diagrams, exports, or client components.

## Database Safety

Template usage analytics stores safe action metadata only. Saved playbooks store reusable workflow structure only. Supabase service-role access must remain server-side.

## n8n Safety

n8n plans are reference blueprints only. They use placeholders such as `{{N8N_WEBHOOK_PATH}}`, `{{AGENTFLOW_CALLBACK_URL}}`, and `{{OPENAI_API_KEY_FROM_N8N_CREDENTIALS}}`.
