# Workflow Builder Guide

Workflow Builder lives at:

```text
/dashboard/agent-library/workflows
```

It combines multiple Agent Library templates into an ordered draft workflow.

## Core Flow

1. Choose a preset or search templates.
2. Add templates as workflow steps.
3. Reorder steps with Up/Down controls.
4. Review the visual diagram.
5. Review readiness and missing inputs.
6. Preview dry run.
7. Export Markdown or create pending tasks after confirmation.

## Visual Diagrams

Every workflow has:

- Visual card/node diagram
- Step numbers
- Category badges
- Safety and execution badges
- Mermaid diagram in Markdown exports

## Review & Readiness

The builder checks missing inputs, duplicate steps, unsafe action wording, provider blockers, required approvals, and safe next actions. These checks are deterministic and local.

## Pending Tasks

Creating tasks from a workflow creates one pending task per step. Tasks do not run automatically and do not trigger n8n.

## Safety

The builder is draft-only. It does not run n8n, publish, schedule, create live ads, spend money, delete data, perform GitHub writes, or change webhooks.
