/**
 * Blog Data — Marketing Content
 *
 * In a production environment, this would come from a CMS, MDX files, or a database.
 * For this phase, we use static content to demonstrate the blog feature.
 */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  readTime: string;
  category: string;
  tags: string[];
  featured?: boolean;
}

const posts: BlogPost[] = [
  {
    slug: 'building-ai-agency-operations',
    title: 'Building AI Agency Operations: A Practical Guide',
    excerpt:
      'Learn how to structure your AI agency for repeatable delivery, quality control, and scalable operations — from task intake to client reporting.',
    content: `## Introduction

Running an AI-powered agency requires more than just access to language models and image generators. It demands a structured operational layer that turns AI capabilities into client-ready deliverables.

## The Three Pillars of AI Agency Operations

### 1. Structured Task Intake
Every project starts with a clear brief. Instead of scattered instructions across email, Slack, and sticky notes, use a structured intake system that captures:

- **Department context** — Which team handles this work?
- **Agent parameters** — What AI capabilities are needed?
- **Priority and deadlines** — When does the client need it?
- **Review criteria** — How will success be measured?

### 2. Quality Review Gates
AI output needs human review before it reaches a client. Establish review gates that check for:

- Brand consistency and tone alignment
- Factual accuracy and hallucination detection
- Safety and compliance requirements
- Format readiness for the target platform

### 3. Integration Boundaries
Not every action should be fully automated. Define clear integration boundaries:

- **Read-only integrations** — Campaign performance data, analytics
- **Draft-only mode** — Content that needs human approval before publishing
- **Full automation** — Only after all safety gates pass

## Getting Started

The key insight is that AI agency operations are not about replacing humans — they are about creating a system where AI handles the heavy lifting while humans focus on strategy, review, and client relationships.`,
    date: 'Jul 12, 2026',
    author: 'AgentFlow Team',
    readTime: '5 min read',
    category: 'Strategy',
    tags: ['AI Agency', 'Operations', 'Best Practices'],
    featured: true,
  },
  {
    slug: 'multi-tenant-rbac-for-ai-workspaces',
    title: 'Multi-Tenant RBAC for AI Workspaces',
    excerpt:
      'A deep dive into role-based access control for multi-client AI agencies — keeping data isolated while enabling collaboration.',
    content: `## Why RBAC Matters for AI Agencies

When you serve multiple clients from a single platform, data isolation isn't optional — it's essential. Role-Based Access Control (RBAC) ensures that:

1. **Clients only see their own data** — Workspace-level isolation
2. **Team members have appropriate permissions** — Role-based access
3. **Audit trails are reliable** — Every action is attributed

## The RBAC Model

### Roles
- **Owner** — Full access, billing, team management
- **Admin** — Workspace configuration, member management
- **Operator** — Daily operations within assigned departments
- **Editor** — Content creation and task execution
- **Viewer** — Read-only access for clients

### Department Scoping
Workspace members can be assigned to specific departments:
- Research & Strategy
- Content & Growth
- Sales & Operations

This means an editor in Content & Growth cannot access Sales operations data, even within the same workspace.

## Implementation

Using Supabase Row-Level Security, every query is scoped to the authenticated user's workspace and role. The middleware stack enforces these policies at the API gateway level, and the client-side UI respects the same boundaries.`,
    date: 'Jul 10, 2026',
    author: 'AgentFlow Team',
    readTime: '4 min read',
    category: 'Engineering',
    tags: ['RBAC', 'Security', 'Supabase'],
  },
  {
    slug: 'content-studio-cross-channel-publishing',
    title: 'Content Studio: Cross-Channel Publishing Workflow',
    excerpt:
      'How to plan, create, review, and publish content across Meta, Google Ads, Pinterest, and more from one unified studio.',
    content: `## The Challenge

Marketing teams juggle multiple platforms: Meta for social ads, Google Ads for search, Pinterest for visual discovery, and more. Each platform has its own interface, approval flow, and content requirements.

## The Solution: Content Studio

Content Studio unifies cross-channel content creation into a single workflow:

### 1. Campaign Briefing
Start with a campaign brief that defines the offer, audience, platform, and goals. The brand kit keeps messaging consistent.

### 2. Content Creation
Generate platform-specific drafts:
- **Meta** — Image ads, carousel ads, Reels
- **Google Ads** — Responsive search ads, display ads
- **Pinterest** — Standard pins, video pins

### 3. Quality Review
Every draft goes through quality review before publishing. The review checks for:
- Brand tone consistency
- Platform-specific requirements
- Safety and compliance
- Performance optimization

### 4. Publishing
When ready, content can be published directly or scheduled for later. The n8n integration handles actual platform API calls through secure server-side routes.

## Benefits

- **Single source of truth** for all content
- **Consistent brand voice** across platforms
- **Reduced context switching** between platform interfaces
- **Full audit trail** from creation to publication`,
    date: 'Jul 8, 2026',
    author: 'AgentFlow Team',
    readTime: '6 min read',
    category: 'Product',
    tags: ['Content Studio', 'Publishing', 'Cross-Channel'],
  },
  {
    slug: 'ai-agent-catalog-deep-dive',
    title: 'AI Agent Catalog: 27 Specialists at Your Fingertips',
    excerpt:
      'Explore the full roster of AI agents available in AgentFlow AI — from market researchers to code reviewers, each designed for a specific role.',
    content: `## Meet the Agents

AgentFlow AI comes with 27 specialized AI agents, each designed for a specific role in your agency workflow. Here's a breakdown by department:

### Research & Strategy
- **Market Research Agent** — Analyzes markets, competitors, and opportunities
- **Competitor Analysis Agent** — Deep dives into competitor positioning
- **Marketing Strategy Agent** — Builds campaign strategies
- **SEO Content Planner** — Plans content clusters for search visibility
- **Brand Strategist** — Develops brand positioning and messaging

### Content & Growth
- **Instagram Content Agent** — Creates platform-optimized Instagram content
- **Ad Copy Agent** — Writes persuasive ad copy across platforms
- **Creative Brief Agent** — Generates design and creative briefs
- **Content Calendar Planner** — Plans social media content calendars
- **Newsletter Builder** — Designs and writes email newsletters
- **Viral Hook Generator** — Creates attention-grabbing hooks

### Sales & Operations
- **Lead Scoring Agent** — Qualifies and scores leads
- **Follow-Up Email Agent** — Drafts personalized follow-ups
- **Client Onboarding Agent** — Creates onboarding plans
- **Proposal Writer** — Generates client proposals
- **Operational SOP Writer** — Documents standard procedures

### Engineering & Quality
- **Code Review Agent** — Reviews code changes for issues
- **Bug Diagnosis Agent** — Identifies root causes of bugs
- **Testing Agent** — Creates QA plans and test cases
- **Documentation Agent** — Writes technical docs and guides
- **Deployment Review Agent** — Plans safe deployments
- **Security Reviewer** — Audits for security issues

## How to Use Agents

Each agent follows a standardized template with:
- **Inputs** — What information the agent needs
- **Outputs** — What the agent produces
- **Review checklist** — Criteria for quality review
- **Safety constraints** — What the agent is NOT allowed to do

## Best Practices

1. **Be specific in your briefs** — Clear inputs lead to better outputs
2. **Always review before using** — AI output needs human judgment
3. **Chain agents together** — Use workflows to combine specialist agents
4. **Iterate and refine** — Save successful prompts for reuse`,
    date: 'Jul 5, 2026',
    author: 'AgentFlow Team',
    readTime: '7 min read',
    category: 'Product',
    tags: ['AI Agents', 'Catalog', 'Workflows'],
  },
  {
    slug: 'supabase-rls-security-best-practices',
    title: 'Supabase RLS: Security Best Practices for Multi-Tenant Apps',
    excerpt:
      'Practical security patterns for building multi-tenant applications with Supabase Row-Level Security — from basic policies to advanced patterns.',
    content: `## Why RLS Matters

Row-Level Security (RLS) is the foundation of data isolation in Supabase. Without it, any authenticated user could potentially access data from other tenants.

## Basic Principles

### 1. Always Enable RLS
Every table should have RLS enabled by default. Make it a habit.

### 2. Use Helper Functions
Create reusable helper functions for common patterns:

\`\`\`sql
-- Check if a user has a minimum role in their workspace
CREATE OR REPLACE FUNCTION has_min_role(required text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'operator', 'editor', 'viewer')
    AND role_index(role) >= role_index(required)
  );
$$ LANGUAGE sql STABLE;
\`\`\`

### 3. Scoped Policies
Every policy should check both authentication and workspace membership:

\`\`\`sql
CREATE POLICY "Users can read their workspace tasks"
  ON tasks FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
\`\`\`

## Advanced Patterns

- **Department-level scoping** — Restrict access by department membership
- **Audit logging** — Log all security-sensitive operations
- **Soft deletes** — Use deleted_at timestamps instead of hard deletes
- **Row-level encryption** — For highly sensitive data

## Testing RLS Policies

Always test your RLS policies with both authenticated and anonymous requests to ensure they work as expected.`,
    date: 'Jul 3, 2026',
    author: 'AgentFlow Team',
    readTime: '5 min read',
    category: 'Engineering',
    tags: ['Supabase', 'RLS', 'Security', 'PostgreSQL'],
  },
  {
    slug: 'automating-client-onboarding-workflows',
    title: 'Automating Client Onboarding with AI Workflows',
    excerpt:
      'How to set up automated client onboarding workflows that prepare tasks, assets, and access requirements without manual coordination.',
    content: `## The Onboarding Problem

Every new client requires the same setup steps:
- Collecting business information
- Setting up access to platforms
- Creating initial tasks and projects
- Documenting requirements and preferences

Without automation, this is a manual, error-prone process that scales poorly.

## The Automated Solution

### Step 1: Client Intake
When a new client comes in, the onboarding agent collects:
- Business name and type
- Services purchased
- Project goals and timeline
- Required platform access
- Brand guidelines and assets

### Step 2: Onboarding Plan Generation
The agent automatically generates:
- A structured onboarding checklist
- Required assets and access list
- First internal tasks for the team
- Timeline with milestones
- Questions for the kickoff meeting

### Step 3: Task Creation
Each onboarding step becomes a tracked task with:
- Assigned team member
- Priority and deadline
- Dependencies between steps
- Review criteria for completion

### Step 4: Kickoff Readiness
Before the kickoff meeting, the system verifies:
- All required assets are collected
- Platform access is configured
- Team members are assigned
- The onboarding plan is reviewed

## Results

Teams using automated onboarding report:
- 60% faster onboarding time
- 40% fewer missed steps
- Consistent quality across all clients
- Better visibility into onboarding status`,
    date: 'Jul 1, 2026',
    author: 'AgentFlow Team',
    readTime: '4 min read',
    category: 'Strategy',
    tags: ['Onboarding', 'Automation', 'Workflows'],
  },
];

export function getBlogPosts(): BlogPost[] {
  return posts;
}

export function getBlogPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getFeaturedPost(): BlogPost | undefined {
  return posts.find((p) => p.featured);
}
