# Demo Script

Project: AgentFlow AI / AI Agency Dashboard
Production URL: https://agentflow-ai-sigma.vercel.app

## Opening Explanation

"AgentFlow AI is a full-stack AI agency dashboard I built to show how AI automation can move from a prompt-based workflow into a real product system. It combines a Next.js SaaS dashboard, Supabase authentication and database storage, n8n automation workflows, human review, revision loops, and client-ready report delivery."

## Problem The Project Solves

"Most AI work inside agencies happens across disconnected tools: prompts, documents, spreadsheets, and automation workflows. AgentFlow AI turns that into a structured workflow where tasks are created, executed through AI automation, reviewed by a human, revised when needed, approved, and delivered as reports."

## Walkthrough

### 1. Login

- Open the production app.
- Sign in.
- Explain that dashboard access is protected with Supabase Auth.

Talking point:

"The app starts with authentication, so every task, report, and review belongs to a real user and workspace context."

### 2. Dashboard

- Open `/dashboard`.
- Show the workspace-scoped dashboard.
- Point out the operational SaaS layout.

Talking point:

"This is built like a practical agency operations dashboard, not just a static AI demo."

### 3. Agents

- Open `/dashboard/agents`.
- Show the 18 agents across Research & Strategy, Content & Growth, and Sales & Operations.

Talking point:

"Each agent represents a repeatable business workflow, so the interface can support different departments without changing the core task system."

### 4. Create Task

- Open `/dashboard/create-task`.
- Select an agent.
- Enter a title, description, and priority.
- Create the task.

Talking point:

"A task becomes the structured unit of work. It has an owner workspace, an assigned AI agent, and a clear lifecycle."

### 5. Run Task

- Open the Task Details page.
- Click Run Task.
- Show the status moving from `pending` to `processing`.

Talking point:

"The actual execution happens server-side. The app sends the task to n8n and waits for the workflow callback."

### 6. n8n Execution

- Explain the n8n handoff.
- Mention callback URL, task metadata, agent metadata, and optional revision notes.

Talking point:

"n8n is the automation layer. AgentFlow AI owns the product experience and database state, while n8n owns the workflow execution."

### 7. Review Result

- Open a task that has reached `needs_review`.
- Show the Client-ready Report.
- Point out summary, sections, recommendations, next actions, and quality notes.

Talking point:

"Successful workflow output does not become final automatically. It enters a human review step first."

### 8. Request Changes

- Use Request Changes on a `needs_review` task.
- Enter revision feedback.
- Show the task returning to `pending`.
- Explain the rerun with `revisionNotes`.

Talking point:

"This is the human-in-the-loop revision system. Feedback is stored, then sent back to n8n on the next run so the automation can produce a better version."

### 9. Approve

- Approve a reviewed task.
- Show the task moving to `completed`.

Talking point:

"Approval creates the final delivery state. The task is now a completed generated report."

### 10. Reports Page

- Open `/dashboard/reports`.
- Show search.
- Show department filter.
- Show status filter.
- Click Open Report.

Talking point:

"The Reports Page is the delivery library. It only lists generated reports from completed and needs_review tasks, so pending, processing, and failed work does not clutter client-ready output."

### 11. Export PDF

- Open Task Details for a report.
- Show Copy Report.
- Show Export PDF.

Talking point:

"The final output can be copied into client communication or exported as a PDF for delivery."

## Closing Pitch

"AgentFlow AI shows that I can build more than a UI. It demonstrates full-stack product thinking, authentication, database modeling, server-side automation boundaries, n8n workflow integration, human review systems, report generation, error handling, retry logic, and production deployment. It is a practical example of the kind of AI automation products I can build for agencies, startups, and operations teams."

## 60-second Version

"AgentFlow AI is a production-tested full-stack AI agency dashboard. I built it with Next.js, TypeScript, Supabase, n8n, and Vercel. A user can log in, create a workspace task for one of 18 AI agents, run it through n8n, receive structured output, review it, request changes with revision notes, approve the final result, and export a client-ready report as PDF. It includes real task statuses, callback handling, retry for failed tasks, and a reports dashboard with search and filters. It demonstrates my ability to build both SaaS product interfaces and real AI automation workflows."

## 5-minute Version

"AgentFlow AI is a portfolio project I built to show how AI automation can be packaged as a real SaaS-style product. The problem is that AI agency work often lives in disconnected prompts and documents. I wanted to turn that into a structured workflow with authentication, workspace data, task creation, automation execution, human review, revisions, approvals, and report delivery.

The app is built with Next.js, TypeScript, Supabase, n8n, and Vercel. Supabase handles auth and database persistence. n8n handles the automation execution. The Next.js app ties everything together through protected dashboard routes and server-side API routes.

In the demo, I log in, open the dashboard, and show the 18 AI agents across Research, Content, and Sales departments. I create a task, run it, and the app sends it to n8n. The task moves from pending to processing. When n8n finishes, it calls back into the app and the task moves to needs_review.

From there, the output is rendered as a Client-ready Report. I can copy it, export it as a PDF, approve it, or request changes. The Request Changes v2 flow is important because feedback is not just stored; it is sent back to n8n as revision notes when the task is rerun. That creates a real human-in-the-loop automation cycle.

Finally, I open the Reports Page. It lists completed and needs_review reports, excludes unfinished or failed tasks, and supports search plus department and status filters. The result is a complete operational loop from task creation to client-ready delivery.

This project demonstrates full-stack engineering, AI automation integration, product workflow design, production deployment, and the kind of practical systems I can build for real teams."
