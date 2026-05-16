# Alex + Agent Library Integration

Alex can use Agent Library templates as safe internal context. Template context is compact and only includes useful fields such as name, category, description, inputs, outputs, safety level, execution mode, suggested prompt, and review checklist.

## Selected Template URL

Open Alex with:

```text
/dashboard/alex?template=<template-id>
```

Alex shows the selected template panel, starter prompt, safe next actions, and related recommendations.

## Smart Recommendations

Recommendations are deterministic and local. They use:

- User message intent
- Selected template
- Template metadata
- Safe usage counts when analytics are available

Alex does not store private chat content for recommendations.

## Safe Alex Actions

- Recommend templates
- Draft plans and prompts
- Create pending tasks after user confirmation
- Send template context to Content Studio
- Export reference n8n workflow plans
- Open visual workflow builder links

## Safety Rules

Alex does not publish, schedule, spend money, run n8n, delete data, change provider settings, write to GitHub, or expose secrets. OpenAI calls remain server-side.
