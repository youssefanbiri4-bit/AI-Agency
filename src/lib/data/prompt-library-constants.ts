import type { PromptCategory, PromptTargetTool } from '@/types/database';

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