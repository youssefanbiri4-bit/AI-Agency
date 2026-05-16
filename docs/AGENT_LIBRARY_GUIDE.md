# Agent Library Guide

Agent Library is the internal AgentFlow AI template system for reusable agency workflows. It is inspired by public AI-agent collections, but all templates are maintained locally in `src/lib/agent-library/templates.ts`.

## What It Includes

- Research & Strategy templates
- Content & Growth templates
- Sales & Operations templates
- Alex Assistant Skills
- Developer / Code Agents
- n8n Workflow Ideas

Each template includes a name, category, safe description, recommended use cases, inputs, outputs, safety level, execution mode, suggested prompt, and review checklist.

## Safe Actions

- Copy a clean prompt
- Open a template in Alex
- Create a pending Supabase task
- Send safe prefill context to Content Studio
- Export a reference-only n8n workflow plan
- Add templates to a draft workflow

## Blocked Actions

Agent Library does not run n8n, publish content, schedule posts, create ads, spend money, delete data, perform GitHub writes, or change provider settings.

## Testing

1. Open `/dashboard/agent-library`.
2. Search for a template.
3. Filter by category.
4. Copy a prompt and verify clean headings and bullets.
5. Use with Alex and confirm the URL includes `?template=<template-id>`.
6. Create a task and confirm it is pending.
7. Send to Content Studio and confirm it only prefills fields.
8. Export n8n plan and confirm it is a reference plan only.
