# Portfolio Summary

## Project Title

AgentFlow AI / AI Agency Dashboard

## One-liner

A production-tested AI agency dashboard that turns task creation, n8n automation, human review, revision loops, read-only Meta Ads tracking, and client-ready reports into one full-stack workflow.

## Tech Stack

- Next.js
- React
- TypeScript
- Supabase
- n8n
- Vercel
- Tailwind CSS / CSS

## What I Built

I built a full-stack SaaS-style dashboard for managing AI agency workflows. Users can sign in, work inside a workspace, choose from 18 AI agents, create tasks, run automation through n8n, review results, request changes, approve final outputs, copy client-ready reports, export PDFs, browse generated reports, and use read-only Meta Ads tracking to turn real campaign metrics into AI analysis tasks.

## Key Features

- Supabase Auth.
- Workspace onboarding and scoping.
- 18 AI agents across 3 departments.
- Task creation and task status tracking.
- n8n v5/7B automation execution.
- Protected callback flow.
- Human review system.
- Approve workflow.
- Request Changes v2.
- `revisionNotes` loop back into n8n.
- Client-ready Report.
- Copy Report.
- Export PDF.
- Error Handling + Retry.
- Reports Page with search, department filter, and status filter.
- Campaigns Page for planning, manual tracking, and Meta campaign analysis.
- Read-only Meta Ads / Instagram and Facebook OAuth connection.
- Connected Meta ad account and campaign display.
- Last 30 days campaign insights display.
- Local deterministic performance diagnosis from Meta metrics.
- AgentFlow AI analysis task creation from real Meta campaign metrics.
- Production deployment on Vercel.

## What Makes It Impressive

- It is not just a static dashboard; it connects a real product interface to an automation workflow.
- It demonstrates full-stack architecture with auth, database persistence, API routes, and production deployment.
- It includes a human-in-the-loop review and revision process.
- It turns AI output into client-ready deliverables.
- It connects real Meta campaign performance data without enabling publishing risk.
- It handles failed automation runs with a retry path.
- It uses a stable n8n integration contract without exposing secrets.

## GitHub / Portfolio Description

AgentFlow AI is a full-stack AI agency dashboard built with Next.js, TypeScript, Supabase, n8n, and Vercel. It supports authenticated workspaces, 18 specialized AI agents, task creation, n8n execution, structured review flows, Request Changes with revision notes, approval, client-ready report rendering, Copy Report, Export PDF, Error Handling + Retry, a production-tested Reports Page, and read-only Meta Ads campaign tracking.

## LinkedIn Project Description

I built AgentFlow AI as a professional Full Stack Developer / AI Automation Developer portfolio project. It combines a Next.js SaaS dashboard with Supabase authentication, workspace-scoped task data, n8n automation workflows, protected callbacks, human review, request-change revision loops, report generation, PDF export, read-only Meta Ads campaign tracking, and Vercel production deployment.

The project demonstrates how AI workflows can be turned into real operational software instead of isolated prompts or scripts.

## Client-facing Description

AgentFlow AI is a custom AI operations dashboard for agencies and teams that want to manage AI-assisted work in a structured way. It lets users create tasks, run automation, review results, request revisions, approve final outputs, track read-only Meta campaign performance, and export client-ready reports from one workspace.

The current Meta integration is intentionally safe: it uses `ads_read`, displays ad accounts, campaigns, and last 30 days insights, and can create AI analysis tasks from real metrics. It does not request `ads_management` and does not publish ads.

It is a strong foundation for internal AI operations, agency delivery systems, and automation-powered service workflows.
