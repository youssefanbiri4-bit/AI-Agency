import type { PromptCategory, PromptTargetTool } from '@/types/database';

type Translator = (key: string, fallback?: string) => string;

export const promptCategoryKeys: Record<PromptCategory, string> = {
  development: 'mappings.promptCategory.development',
  deployment: 'mappings.promptCategory.deployment',
  bug_fix: 'mappings.promptCategory.bugFix',
  ui_ux: 'mappings.promptCategory.uiUx',
  supabase: 'mappings.promptCategory.supabase',
  vercel: 'mappings.promptCategory.vercel',
  n8n: 'mappings.promptCategory.n8n',
  provider_setup: 'mappings.promptCategory.providerSetup',
  ads_publishing: 'mappings.promptCategory.adsPublishing',
  reports: 'mappings.promptCategory.reports',
  documentation: 'mappings.promptCategory.documentation',
  project_planning: 'mappings.promptCategory.projectPlanning',
  creative_assets: 'mappings.promptCategory.creativeAssets',
  content_studio: 'mappings.promptCategory.contentStudio',
  agents: 'mappings.promptCategory.agents',
  general: 'mappings.promptCategory.general',
};

export const promptToolKeys: Record<PromptTargetTool, string> = {
  codex: 'mappings.promptTool.codex',
  opencode: 'mappings.promptTool.opencode',
  kilo_code: 'mappings.promptTool.kiloCode',
  n8n_ai: 'mappings.promptTool.n8nAi',
  chatgpt: 'mappings.promptTool.chatgpt',
  supabase_sql_editor: 'mappings.promptTool.supabaseSqlEditor',
  vercel_cli: 'mappings.promptTool.vercelCli',
  general_ai_tool: 'mappings.promptTool.generalAiTool',
};

export function translatePromptCategory(t: Translator, category: PromptCategory) {
  return t(promptCategoryKeys[category], category.replaceAll('_', ' '));
}

export function translatePromptTool(t: Translator, tool: PromptTargetTool | null) {
  if (!tool) return t('mappings.promptTool.generalAiTool', 'General AI Tool');
  return t(promptToolKeys[tool], tool.replaceAll('_', ' '));
}
