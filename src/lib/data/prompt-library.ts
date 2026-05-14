import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { JsonObject } from '@/types';
import type {
  Database,
  PromptCategory,
  PromptLibraryRecord,
  PromptTargetTool,
} from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

type PromptClient = SupabaseClient<Database>;

export interface PromptLibraryInput {
  title: string;
  description: string | null;
  category: PromptCategory;
  subcategory: string | null;
  targetTool: PromptTargetTool | null;
  promptText: string;
  tags: string[];
  isFavorite: boolean;
  metadata?: JsonObject;
}

export interface CreatePromptLibraryInput extends PromptLibraryInput {
  workspaceId: string;
  userId: string;
}

export interface UpdatePromptLibraryInput extends PromptLibraryInput {
  id: string;
  workspaceId: string;
}

export const promptCategories: PromptCategory[] = [
  'development',
  'deployment',
  'bug_fix',
  'ui_ux',
  'supabase',
  'vercel',
  'n8n',
  'provider_setup',
  'ads_publishing',
  'reports',
  'documentation',
  'project_planning',
  'creative_assets',
  'content_studio',
  'agents',
  'general',
];

export const promptTargetTools: PromptTargetTool[] = [
  'codex',
  'opencode',
  'kilo_code',
  'n8n_ai',
  'chatgpt',
  'supabase_sql_editor',
  'vercel_cli',
  'general_ai_tool',
];

export const starterPrompts: PromptLibraryInput[] = [
  {
    title: 'Safe production deploy',
    description: 'Preflight checklist before deploying a Next.js, Supabase, and Vercel dashboard.',
    category: 'deployment',
    subcategory: 'Production',
    targetTool: 'codex',
    tags: ['deploy', 'vercel', 'safety'],
    isFavorite: true,
    promptText:
      'Review this project for safe production deployment. Check build, type safety, environment variable references without revealing values, Supabase migrations, route coverage, and obvious runtime risks. Do not change provider publishing, task execution, scheduler, callbacks, webhooks, or secrets.',
  },
  {
    title: 'Supabase migration review',
    description: 'Review SQL migrations for workspace scope, RLS, indexes, and rollback risks.',
    category: 'supabase',
    subcategory: 'Migrations',
    targetTool: 'supabase_sql_editor',
    tags: ['supabase', 'migration', 'rls'],
    isFavorite: false,
    promptText:
      'Review this Supabase migration for safety. Confirm IF NOT EXISTS usage where appropriate, workspace-scoped RLS, indexes, updated_at triggers, and that no secrets or unsafe permissions are introduced.',
  },
  {
    title: 'Fix build error',
    description: 'Structured prompt for diagnosing Next.js build failures.',
    category: 'bug_fix',
    subcategory: 'Build',
    targetTool: 'codex',
    tags: ['build', 'typescript', 'nextjs'],
    isFavorite: true,
    promptText:
      'Diagnose and fix this build error. Read the relevant files first, make the smallest safe code change, then run lint, typecheck, and build. Preserve unrelated user changes and do not alter execution/provider/scheduler logic.',
  },
  {
    title: 'Safe implementation prompt',
    description: 'Use a Safe Patch Planner output to implement one approved change.',
    category: 'development',
    subcategory: 'Safe Patch Planner',
    targetTool: 'codex',
    tags: ['safe-patch', 'implementation', 'codex'],
    isFavorite: true,
    promptText:
      'Implement only this approved Safe Patch Planner scope. Read the affected files first, preserve unrelated changes, do not touch no-touch systems, do not expose secrets, do not push to GitHub, do not deploy, and verify with lint, typecheck, build, and route-specific smoke tests.',
  },
  {
    title: 'Safe UI fix prompt',
    description: 'Scoped UI/layout fix prompt with regression checks.',
    category: 'ui_ux',
    subcategory: 'Safe Patch Planner',
    targetTool: 'codex',
    tags: ['safe-patch', 'ui', 'layout'],
    isFavorite: false,
    promptText:
      'Apply this approved UI fix only. Keep provider logic, task execution, scheduler, callbacks, webhooks, env vars, and secrets unchanged. Check desktop/mobile layouts, no horizontal overflow, readable text, and run lint/typecheck/build.',
  },
  {
    title: 'Safe bug fix prompt',
    description: 'Smallest-safe-change bug fix prompt.',
    category: 'bug_fix',
    subcategory: 'Safe Patch Planner',
    targetTool: 'codex',
    tags: ['safe-patch', 'bug-fix', 'regression'],
    isFavorite: false,
    promptText:
      'Fix this bug with the smallest safe change. First identify the root cause and affected files, then patch only the approved scope. Do not change provider publishing, scheduler core, task execution, n8n/callbacks/webhooks, secrets, env vars, GitHub, or deployment behavior. Run lint, typecheck, build, and the feature regression checklist.',
  },
  {
    title: 'Safe migration prompt',
    description: 'Database migration planning and implementation prompt.',
    category: 'supabase',
    subcategory: 'Safe Patch Planner',
    targetTool: 'codex',
    tags: ['safe-patch', 'migration', 'rls'],
    isFavorite: false,
    promptText:
      'Create or review only the approved Supabase migration. Use IF NOT EXISTS where safe, workspace-scoped RLS, indexes, constraints, and rollback notes. Do not expose secrets or alter unrelated tables/functions. Report the migration filename and whether it must be applied before deploy.',
  },
  {
    title: 'Safe deploy prompt',
    description: 'Deployment readiness prompt after an approved patch.',
    category: 'deployment',
    subcategory: 'Safe Patch Planner',
    targetTool: 'codex',
    tags: ['safe-patch', 'deploy', 'vercel'],
    isFavorite: false,
    promptText:
      'Prepare a deployment readiness report for this approved patch. Include files changed, migrations required, lint/typecheck/build results, smoke test routes, rollback plan, and no-secret validation. Do not deploy unless explicitly requested.',
  },
  {
    title: 'Content Studio UI review',
    description: 'Review Content Studio for responsive UI, readability, and workflow clarity.',
    category: 'ui_ux',
    subcategory: 'Content Studio',
    targetTool: 'codex',
    tags: ['ui', 'content-studio', 'review'],
    isFavorite: false,
    promptText:
      'Review the Content Studio UI for a premium SaaS manager workflow. Check responsive layout, density, labels, empty states, filters, and action clarity. Keep provider logic unchanged.',
  },
  {
    title: 'Provider readiness audit',
    description: 'Audit provider readiness surfaces without changing provider actions.',
    category: 'provider_setup',
    subcategory: 'Readiness',
    targetTool: 'codex',
    tags: ['providers', 'readiness', 'audit'],
    isFavorite: false,
    promptText:
      'Audit provider readiness UI and server checks. Verify statuses are based on real configuration/connection data, no secrets are exposed, and no publishing behavior is changed.',
  },
  {
    title: 'n8n node fix',
    description: 'Prompt for diagnosing n8n workflow node configuration issues.',
    category: 'n8n',
    subcategory: 'Workflow',
    targetTool: 'n8n_ai',
    tags: ['n8n', 'workflow', 'node'],
    isFavorite: false,
    promptText:
      'Help diagnose this n8n node issue from the provided error and workflow context. Suggest safe node-level fixes only. Do not expose credentials, tokens, or callback secrets.',
  },
  {
    title: 'Vercel env verification',
    description: 'Verify Vercel environment configuration without revealing secret values.',
    category: 'vercel',
    subcategory: 'Environment',
    targetTool: 'vercel_cli',
    tags: ['vercel', 'env', 'production'],
    isFavorite: false,
    promptText:
      'Verify Vercel environment readiness for production. Confirm required variable names are present, but never print or reveal values. Identify missing setup and deployment risks.',
  },
  {
    title: 'Google Ads readiness test',
    description: 'Readiness-only Google Ads setup prompt.',
    category: 'ads_publishing',
    subcategory: 'Google Ads',
    targetTool: 'codex',
    tags: ['google-ads', 'readiness', 'oauth'],
    isFavorite: false,
    promptText:
      'Check Google Ads readiness from existing app state. Report OAuth, customer ID, developer token, and approval status where available. Do not create, mutate, or publish campaigns.',
  },
  {
    title: 'Meta publishing audit',
    description: 'Audit Meta/Instagram publishing setup safely.',
    category: 'ads_publishing',
    subcategory: 'Meta',
    targetTool: 'codex',
    tags: ['meta', 'instagram', 'publishing'],
    isFavorite: false,
    promptText:
      'Audit Meta and Instagram publishing readiness. Check scopes, selected page/account metadata, and safe error messaging. Do not change provider publishing logic or request ads_management.',
  },
  {
    title: 'Pinterest setup audit',
    description: 'Audit Pinterest setup and selected board readiness.',
    category: 'provider_setup',
    subcategory: 'Pinterest',
    targetTool: 'codex',
    tags: ['pinterest', 'oauth', 'board'],
    isFavorite: false,
    promptText:
      'Audit Pinterest setup. Verify OAuth readiness, required app configuration, selected board metadata, and user-facing setup guidance. Do not publish pins or change provider actions.',
  },
  {
    title: 'Reports design prompt',
    description: 'Improve reports using only real data.',
    category: 'reports',
    subcategory: 'Design',
    targetTool: 'codex',
    tags: ['reports', 'ui', 'real-data'],
    isFavorite: false,
    promptText:
      'Improve the Reports page using only real workspace data. Avoid fake metrics, keep provider/scheduler behavior unchanged, and make the layout clean, readable, and manager-friendly.',
  },
  {
    title: 'Final stabilization audit',
    description: 'Full app stabilization prompt before release.',
    category: 'development',
    subcategory: 'Stabilization',
    targetTool: 'codex',
    tags: ['audit', 'release', 'stability'],
    isFavorite: true,
    promptText:
      'Run a final stabilization audit. Check navigation, dashboard routes, server actions, Supabase access, empty states, lint, typecheck, and build. Do not touch secrets, provider publishing, task execution, scheduler, callbacks, or webhooks.',
  },
  {
    title: 'Create Arabic project report',
    description: 'Prompt for producing a polished Arabic project status report.',
    category: 'documentation',
    subcategory: 'Arabic Report',
    targetTool: 'chatgpt',
    tags: ['arabic', 'report', 'project'],
    isFavorite: false,
    promptText:
      'Create a polished Arabic project report from the provided project facts. Include current progress, completed phases, pending work, risks, and next actions. Do not invent metrics or confidential details.',
  },
  {
    title: 'Create agents usage guide',
    description: 'Prompt for documenting the AgentFlow AI agent catalog.',
    category: 'agents',
    subcategory: 'Guide',
    targetTool: 'chatgpt',
    tags: ['agents', 'guide', 'documentation'],
    isFavorite: false,
    promptText:
      'Create a clear usage guide for the AgentFlow AI agents. Explain when to use each department and agent, expected outputs, example tasks, and manager workflow tips. Keep it practical and concise.',
  },
  {
    title: 'Review this repository',
    description: 'Read-only repository review prompt using pasted GitHub context.',
    category: 'development',
    subcategory: 'GitHub',
    targetTool: 'codex',
    tags: ['github', 'repository', 'review'],
    isFavorite: false,
    promptText:
      'Review this repository context from AgentFlow AI. Summarize architecture, recent commits, open issues, pull requests, and risks. Do not push commits, create pull requests, modify files, or expose tokens.',
  },
  {
    title: 'Generate release notes from commits',
    description: 'Create a release notes draft from read-only GitHub commits.',
    category: 'deployment',
    subcategory: 'GitHub',
    targetTool: 'codex',
    tags: ['github', 'release-notes', 'commits'],
    isFavorite: false,
    promptText:
      'Generate release notes from these GitHub commits. Group changes by feature, fix, documentation, and risk. Use only the provided commit data. Do not create a GitHub release or modify the repository.',
  },
  {
    title: 'Create bug-fix plan from GitHub issue',
    description: 'Turn a GitHub issue into a safe implementation plan.',
    category: 'bug_fix',
    subcategory: 'GitHub Issue',
    targetTool: 'codex',
    tags: ['github', 'issue', 'bug-fix'],
    isFavorite: false,
    promptText:
      'Create a bug-fix plan from this GitHub issue. Include suspected area, files to inspect, test plan, rollback risk, and acceptance criteria. Do not change code until explicitly asked.',
  },
  {
    title: 'Create task from GitHub issue',
    description: 'Convert a GitHub issue into an AgentFlow AI task brief.',
    category: 'project_planning',
    subcategory: 'GitHub Issue',
    targetTool: 'general_ai_tool',
    tags: ['github', 'issue', 'task'],
    isFavorite: false,
    promptText:
      'Convert this GitHub issue into a clear AgentFlow AI task. Include title, background, expected output, constraints, priority suggestion, and review checklist. Do not include secrets or private credentials.',
  },
  {
    title: 'Review this codebase',
    description: 'Analyze project structure, stack, routes, risks, and next actions from analyzer output.',
    category: 'development',
    subcategory: 'Codebase Analyzer',
    targetTool: 'codex',
    tags: ['codebase', 'architecture', 'review'],
    isFavorite: true,
    promptText:
      'Review this codebase analysis report. Summarize architecture, tech stack, routes, API routes, database files, risks, missing docs, testing checklist, and recommended next actions. Do not modify files, run untrusted code, expose secrets, push commits, or create pull requests.',
  },
  {
    title: 'Fix architecture issue',
    description: 'Turn a codebase analyzer finding into a safe implementation plan.',
    category: 'development',
    subcategory: 'Architecture',
    targetTool: 'codex',
    tags: ['architecture', 'plan', 'codebase'],
    isFavorite: false,
    promptText:
      'Create a safe plan to address this architecture finding. Include files to inspect, likely root cause, proposed change, test plan, migration risk, and rollback notes. Do not edit code until explicitly asked.',
  },
  {
    title: 'Generate README',
    description: 'Create README content from codebase analyzer output.',
    category: 'documentation',
    subcategory: 'README',
    targetTool: 'chatgpt',
    tags: ['readme', 'docs', 'codebase'],
    isFavorite: false,
    promptText:
      'Generate a README from this codebase analysis. Include overview, tech stack, setup, scripts, environment variables from .env.example only, routes, deployment, testing, and security notes. Do not include secret values.',
  },
  {
    title: 'Create testing checklist',
    description: 'Create a practical pre-release checklist from analyzer findings.',
    category: 'development',
    subcategory: 'Testing',
    targetTool: 'general_ai_tool',
    tags: ['testing', 'checklist', 'release'],
    isFavorite: false,
    promptText:
      'Create a focused testing checklist from this codebase analysis. Include lint, typecheck, build, route smoke tests, API auth checks, database migration checks, responsive UI checks, and rollback readiness.',
  },
  {
    title: 'Prepare deployment checklist',
    description: 'Prepare deployment steps from analyzer output.',
    category: 'deployment',
    subcategory: 'Checklist',
    targetTool: 'codex',
    tags: ['deployment', 'checklist', 'codebase'],
    isFavorite: false,
    promptText:
      'Prepare a deployment checklist from this codebase analysis. Include migrations, env vars from .env.example only, lint, typecheck, build, Vercel deployment, smoke tests, known risks, and rollback notes. Do not expose secrets or change provider publishing behavior.',
  },
  {
    title: 'Build MVP plan',
    description: 'Turn a software idea into a practical MVP scope and phase plan.',
    category: 'project_planning',
    subcategory: 'Software Planner',
    targetTool: 'chatgpt',
    tags: ['software-planner', 'mvp', 'planning'],
    isFavorite: true,
    promptText:
      'Build an MVP plan for this software idea. Include executive summary, target users, must-have features, pages/routes, database tables, API/server actions, development phases, testing checklist, deployment checklist, risks, and next actions. Planning only; do not generate repository files or expose secrets.',
  },
  {
    title: 'Generate database schema',
    description: 'Create a safe database schema draft for a software project.',
    category: 'supabase',
    subcategory: 'Software Planner',
    targetTool: 'codex',
    tags: ['schema', 'database', 'software-planner'],
    isFavorite: false,
    promptText:
      'Generate a database schema plan for this software project. Include tables, fields, relationships, indexes, RLS/security notes, migration notes, and seed-data warnings. Do not modify the database automatically and do not include secret values.',
  },
  {
    title: 'Generate route map',
    description: 'Create a route and API map for a software project idea.',
    category: 'development',
    subcategory: 'Software Planner',
    targetTool: 'codex',
    tags: ['routes', 'api', 'architecture'],
    isFavorite: false,
    promptText:
      'Generate a route map for this software project. Include public routes, protected dashboard routes, API routes/server actions, auth requirements, purpose, and security notes. Do not write files or change code automatically.',
  },
  {
    title: 'Generate software testing checklist',
    description: 'Create a software testing checklist from a project plan.',
    category: 'development',
    subcategory: 'Software Planner',
    targetTool: 'general_ai_tool',
    tags: ['testing', 'software-planner', 'qa'],
    isFavorite: false,
    promptText:
      'Generate a practical testing checklist from this software project plan. Include auth, database/RLS, forms, API/server actions, UI responsiveness, accessibility basics, security, build, deployment smoke tests, and rollback checks.',
  },
  {
    title: 'Generate deployment checklist',
    description: 'Prepare a deployment checklist from a software plan.',
    category: 'deployment',
    subcategory: 'Software Planner',
    targetTool: 'codex',
    tags: ['deployment', 'vercel', 'software-planner'],
    isFavorite: false,
    promptText:
      'Generate a deployment checklist from this software plan. Include env var names without values, migrations, storage buckets, Vercel settings, lint, typecheck, build, smoke tests, monitoring, rollback notes, and no-secrets verification.',
  },
  {
    title: 'Developer Agent: Code Review',
    description: 'Prompt template for the Code Review Agent.',
    category: 'development',
    subcategory: 'Developer Agents',
    targetTool: 'codex',
    tags: ['developer-agent', 'code-review', 'quality'],
    isFavorite: false,
    promptText:
      'Act as the Code Review Agent. Review the provided changed files or project summary for bugs, readability, structure, maintainability, and risky code. Return findings by severity, recommended fixes, and a testing checklist. Do not edit files, push commits, create pull requests, or expose secrets.',
  },
  {
    title: 'Developer Agent: Bug Fix Plan',
    description: 'Prompt template for the Bug Fix Agent.',
    category: 'bug_fix',
    subcategory: 'Developer Agents',
    targetTool: 'codex',
    tags: ['developer-agent', 'bug-fix', 'debugging'],
    isFavorite: false,
    promptText:
      'Act as the Bug Fix Agent. Analyze the error, logs, route, screenshot, or failing behavior. Return root cause hypotheses, files to inspect, a safe fix plan, test steps, and a Codex prompt. Do not change code until explicitly asked.',
  },
  {
    title: 'Developer Agent: Architecture Plan',
    description: 'Prompt template for the Architecture Agent.',
    category: 'development',
    subcategory: 'Developer Agents',
    targetTool: 'codex',
    tags: ['developer-agent', 'architecture', 'planning'],
    isFavorite: false,
    promptText:
      'Act as the Architecture Agent. Plan system architecture, folder structure, data flow, database model, API/server actions, implementation phases, risks, and tradeoffs. Planning only; do not generate repository files.',
  },
  {
    title: 'Developer Agent: Testing Checklist',
    description: 'Prompt template for the Testing Agent.',
    category: 'development',
    subcategory: 'Developer Agents',
    targetTool: 'general_ai_tool',
    tags: ['developer-agent', 'testing', 'qa'],
    isFavorite: false,
    promptText:
      'Act as the Testing Agent. Create a manual and automated QA checklist with route smoke tests, form validation, API/auth checks, provider readiness, responsive UI checks, edge cases, and acceptance criteria.',
  },
  {
    title: 'Developer Agent: Documentation',
    description: 'Prompt template for the Documentation Agent.',
    category: 'documentation',
    subcategory: 'Developer Agents',
    targetTool: 'chatgpt',
    tags: ['developer-agent', 'documentation', 'release-notes'],
    isFavorite: false,
    promptText:
      'Act as the Documentation Agent. Create a clear internal guide, technical report, release notes, FAQ, or checklist from the provided facts. Use Arabic or English as requested. Do not invent unavailable data or include secrets.',
  },
  {
    title: 'Developer Agent: Deployment',
    description: 'Prompt template for the Deployment Agent.',
    category: 'deployment',
    subcategory: 'Developer Agents',
    targetTool: 'codex',
    tags: ['developer-agent', 'deployment', 'vercel'],
    isFavorite: false,
    promptText:
      'Act as the Deployment Agent. Prepare a deployment plan with env variable names only, migration checklist, Vercel checks, lint/typecheck/build commands, smoke tests, rollback plan, and no-secrets validation. Do not deploy automatically.',
  },
  {
    title: 'Developer Agent: Security Audit',
    description: 'Prompt template for the Security Review Agent.',
    category: 'development',
    subcategory: 'Developer Agents',
    targetTool: 'codex',
    tags: ['developer-agent', 'security', 'secrets'],
    isFavorite: false,
    promptText:
      'Act as the Security Review Agent. Review for secret exposure, token logging, RLS gaps, auth validation, upload safety, OAuth/token storage, and client/server boundary risks. Return risks and recommended fixes without exposing secret values.',
  },
  {
    title: 'Developer Agent: Supabase Database Review',
    description: 'Prompt template for the Database Agent.',
    category: 'supabase',
    subcategory: 'Developer Agents',
    targetTool: 'codex',
    tags: ['developer-agent', 'database', 'supabase'],
    isFavorite: false,
    promptText:
      'Act as the Database Agent. Review or plan Supabase schema, migrations, RLS policies, indexes, relationships, and storage bucket policies. Return migration notes, RLS checklist, and testing steps. Do not modify the database automatically.',
  },
  {
    title: 'Developer Agent: UI/UX Review',
    description: 'Prompt template for the UI/UX Review Agent.',
    category: 'ui_ux',
    subcategory: 'Developer Agents',
    targetTool: 'codex',
    tags: ['developer-agent', 'ui-ux', 'responsive'],
    isFavorite: false,
    promptText:
      'Act as the UI/UX Review Agent. Review layout, spacing, cards, forms, readability, accessibility basics, and mobile responsiveness. Return prioritized improvements and a responsive checklist. Do not change code unless explicitly asked.',
  },
];

export function formatPromptCategory(category: PromptCategory) {
  const labels: Record<PromptCategory, string> = {
    development: 'Development',
    deployment: 'Deployment',
    bug_fix: 'Bug Fix',
    ui_ux: 'UI/UX',
    supabase: 'Supabase',
    vercel: 'Vercel',
    n8n: 'n8n',
    provider_setup: 'Provider Setup',
    ads_publishing: 'Ads & Publishing',
    reports: 'Reports',
    documentation: 'Documentation',
    project_planning: 'Project Planning',
    creative_assets: 'Creative Assets',
    content_studio: 'Content Studio',
    agents: 'Agents',
    general: 'General',
  };
  return labels[category];
}

export function formatPromptTargetTool(tool: PromptTargetTool | null) {
  if (!tool) return 'General AI Tool';
  const labels: Record<PromptTargetTool, string> = {
    codex: 'Codex',
    opencode: 'OpenCode',
    kilo_code: 'Kilo Code',
    n8n_ai: 'n8n AI',
    chatgpt: 'ChatGPT',
    supabase_sql_editor: 'Supabase SQL Editor',
    vercel_cli: 'Vercel CLI',
    general_ai_tool: 'General AI Tool',
  };
  return labels[tool];
}

export async function listPromptLibraryForWorkspace(
  workspaceId: string,
  client: PromptClient = supabase as PromptClient
): Promise<DataResult<PromptLibraryRecord[]>> {
  if (!isSupabaseConfigured) return emptyDataResult([], false);

  const { data, error } = await client
    .from('prompt_library')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('is_favorite', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) return errorDataResult([], error.message);
  return emptyDataResult(data ?? [], true);
}

export async function getPromptLibraryItem(
  id: string,
  workspaceId: string,
  client: PromptClient = supabase as PromptClient
): Promise<DataResult<PromptLibraryRecord | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const { data, error } = await client
    .from('prompt_library')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data ?? null, true);
}

export async function createPromptLibraryItem(
  input: CreatePromptLibraryInput,
  client: PromptClient = supabase as PromptClient
): Promise<DataResult<PromptLibraryRecord | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const { data, error } = await client
    .from('prompt_library')
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      title: input.title,
      description: input.description,
      category: input.category,
      subcategory: input.subcategory,
      target_tool: input.targetTool,
      prompt_text: input.promptText,
      tags: input.tags,
      is_favorite: input.isFavorite,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}

export async function updatePromptLibraryItem(
  input: UpdatePromptLibraryInput,
  client: PromptClient = supabase as PromptClient
): Promise<DataResult<PromptLibraryRecord | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const { data, error } = await client
    .from('prompt_library')
    .update({
      title: input.title,
      description: input.description,
      category: input.category,
      subcategory: input.subcategory,
      target_tool: input.targetTool,
      prompt_text: input.promptText,
      tags: input.tags,
      is_favorite: input.isFavorite,
      metadata: input.metadata ?? {},
    })
    .eq('id', input.id)
    .eq('workspace_id', input.workspaceId)
    .select('*')
    .single();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}

export async function deletePromptLibraryItem(
  id: string,
  workspaceId: string,
  client: PromptClient = supabase as PromptClient
): Promise<DataResult<null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const { error } = await client
    .from('prompt_library')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(null, true);
}

export async function updatePromptFavorite(
  id: string,
  workspaceId: string,
  isFavorite: boolean,
  client: PromptClient = supabase as PromptClient
): Promise<DataResult<PromptLibraryRecord | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const { data, error } = await client
    .from('prompt_library')
    .update({ is_favorite: isFavorite })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}

export async function markPromptUsed(
  id: string,
  workspaceId: string,
  client: PromptClient = supabase as PromptClient
): Promise<DataResult<PromptLibraryRecord | null>> {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);

  const existing = await getPromptLibraryItem(id, workspaceId, client);
  if (existing.error || !existing.data) {
    return errorDataResult(null, existing.error ?? 'Prompt not found.');
  }

  const { data, error } = await client
    .from('prompt_library')
    .update({
      usage_count: existing.data.usage_count + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}
