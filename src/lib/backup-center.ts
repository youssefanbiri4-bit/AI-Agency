import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JsonObject, JsonValue } from '@/types';
import type { Database, WorkspaceRecord } from '@/types/database';

export type BackupCategory =
  | 'settings'
  | 'projects'
  | 'prompts'
  | 'releases'
  | 'content_studio'
  | 'creative_assets'
  | 'tasks_reviews'
  | 'reports'
  | 'system_security'
  | 'safe_patch_fix';

export const backupCategoryLabels: Record<BackupCategory, string> = {
  settings: 'Settings & Brand Kit',
  projects: 'Projects',
  prompts: 'Prompt Library',
  releases: 'Releases',
  content_studio: 'Content Studio',
  creative_assets: 'Creative Assets Metadata',
  tasks_reviews: 'Tasks & Reviews',
  reports: 'Reports',
  system_security: 'Recovery/System Health/Security',
  safe_patch_fix: 'Safe Patch/Fix Proposals',
};

export const allBackupCategories = Object.keys(backupCategoryLabels) as BackupCategory[];

const secretKeyPattern =
  /(access[_-]?token|refresh[_-]?token|encrypted[_-]?access[_-]?token|encrypted[_-]?refresh[_-]?token|\btoken\b|secret|client[_-]?secret|api[_-]?key|service[_-]?role|password|private[_-]?key|authorization|bearer)/i;

const secretValuePattern = /(Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9._-]{20,})/gi;

export interface BackupCollectorContext {
  workspace: WorkspaceRecord;
  userId: string;
  client: SupabaseClient<Database>;
  categories: BackupCategory[];
}

export interface WorkspaceBackup {
  backup_version: '1.0';
  created_at: string;
  workspace: {
    id: string;
    name: string;
  };
  categories: Record<BackupCategory, boolean>;
  data: {
    settings: JsonObject;
    projects: JsonObject[];
    prompts: JsonObject[];
    releases: JsonObject[];
    content_items: JsonObject[];
    creative_assets_metadata: JsonObject[];
    tasks: JsonObject[];
    reviews: JsonObject[];
    reports: JsonObject[];
    system_health: JsonObject[];
    safe_patch_plans: JsonObject[];
    code_fix_proposals: JsonObject[];
  };
  security: {
    secrets_excluded: true;
    tokens_excluded: true;
    raw_env_values_excluded: true;
    binary_files_included: false;
  };
  summary: {
    record_counts: Record<string, number>;
    total_records: number;
    excluded_sensitive_fields: string[];
    warnings: string[];
    file_name: string;
    size_estimate_bytes: number;
    markdown: string;
  };
}

type LooseRow = Record<string, unknown>;

interface QueryResult {
  data: LooseRow[];
  error: string | null;
}

function looseClient(client: SupabaseClient<Database>) {
  return client as unknown as {
    from(name: string): {
      select(columns: string): {
        eq(column: string, value: string): {
          order(column: string, options: { ascending: boolean }): Promise<{
            data: LooseRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toJsonValue(value: unknown, removed: Set<string>): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (typeof value === 'string') {
      return value.replace(secretValuePattern, '[REDACTED]');
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonValue(entry, removed));
  }

  if (!isObject(value)) {
    return null;
  }

  return sanitizeObject(value, removed);
}

export function sanitizeObject(input: Record<string, unknown>, removed = new Set<string>()): JsonObject {
  const output: JsonObject = {};

  for (const [key, value] of Object.entries(input)) {
    if (secretKeyPattern.test(key)) {
      output[key] = '[REDACTED]';
      removed.add(key);
      continue;
    }

    output[key] = toJsonValue(value, removed);
  }

  return output;
}

function pickSafe(input: LooseRow, keys: string[], removed: Set<string>): JsonObject {
  const output: LooseRow = {};
  for (const key of keys) {
    if (key in input) output[key] = input[key];
  }
  return sanitizeObject(output, removed);
}

function isPublicSafeUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.searchParams.has('token') && !url.pathname.includes('/storage/v1/object/sign/');
  } catch {
    return false;
  }
}

function safeStoragePath(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.includes('..') || secretValuePattern.test(value) ? null : value;
}

async function safeSelect(
  client: SupabaseClient<Database>,
  table: string,
  workspaceId: string,
  warnings: string[]
): Promise<QueryResult> {
  const { data, error } = await looseClient(client)
    .from(table)
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    warnings.push(`${table} unavailable: ${error.message}`);
    return { data: [], error: error.message };
  }

  return { data: data ?? [], error: null };
}

function selected(categories: BackupCategory[], category: BackupCategory) {
  return categories.includes(category);
}

function buildFileName(createdAt: string) {
  return `agentflow-backup-${createdAt.slice(0, 10)}-workspace.json`;
}

function summarizeByStatus(rows: JsonObject[], statusKey = 'status') {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const value = typeof row[statusKey] === 'string' ? row[statusKey] : 'unknown';
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function normalizeBackupCategories(values: string[]) {
  const normalized = values.filter((value): value is BackupCategory =>
    allBackupCategories.includes(value as BackupCategory)
  );

  return normalized.length ? normalized : allBackupCategories;
}

export async function createWorkspaceBackup({
  workspace,
  client,
  categories,
}: BackupCollectorContext): Promise<WorkspaceBackup> {
  const removed = new Set<string>();
  const warnings: string[] = [
    'Binary creative asset files are not included. This export contains metadata only.',
    'Full restore is disabled in this phase to avoid accidental overwrites.',
  ];
  const data: WorkspaceBackup['data'] = {
    settings: {},
    projects: [],
    prompts: [],
    releases: [],
    content_items: [],
    creative_assets_metadata: [],
    tasks: [],
    reviews: [],
    reports: [],
    system_health: [],
    safe_patch_plans: [],
    code_fix_proposals: [],
  };

  if (selected(categories, 'settings')) {
    const settingsResult = await safeSelect(client, 'integration_settings', workspace.id, warnings);
    const adConnections = await safeSelect(client, 'ad_connections', workspace.id, warnings);
    const settings = settingsResult.data[0] ?? {};
    data.settings = {
      workspace: sanitizeObject({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        created_at: workspace.created_at,
        updated_at: workspace.updated_at,
      }, removed),
      integration_settings: pickSafe(settings, ['workspace_id', 'supabase_status', 'n8n_status', 'settings', 'created_at', 'updated_at'], removed),
      provider_readiness_summaries: adConnections.data.map((row) =>
        pickSafe(row, ['provider', 'status', 'ad_account_id', 'ad_account_name', 'scopes', 'metadata', 'created_at', 'updated_at'], removed)
      ) as unknown as JsonValue,
    };
  }

  if (selected(categories, 'projects')) {
    const result = await safeSelect(client, 'projects', workspace.id, warnings);
    data.projects = result.data.map((row) => sanitizeObject(row, removed));
  }

  if (selected(categories, 'prompts')) {
    const result = await safeSelect(client, 'prompt_library', workspace.id, warnings);
    data.prompts = result.data.map((row) => {
      const promptText = typeof row.prompt_text === 'string' ? row.prompt_text : '';
      if (secretKeyPattern.test(promptText) || secretValuePattern.test(promptText)) {
        warnings.push(`Prompt "${row.title ?? 'Untitled prompt'}" may contain a secret-like value and was redacted.`);
        return sanitizeObject({ ...row, prompt_text: '[REDACTED: prompt contained secret-like text]' }, removed);
      }
      return sanitizeObject(row, removed);
    });
  }

  if (selected(categories, 'releases')) {
    const result = await safeSelect(client, 'releases', workspace.id, warnings);
    data.releases = result.data.map((row) => sanitizeObject(row, removed));
  }

  if (selected(categories, 'content_studio')) {
    const result = await safeSelect(client, 'content_studio_items', workspace.id, warnings);
    data.content_items = result.data.map((row) =>
      pickSafe(
        row,
        [
          'id',
          'title',
          'platform',
          'content_type',
          'status',
          'objective',
          'prompt',
          'script',
          'caption',
          'ad_copy',
          'creative_brief',
          'schedule_at',
          'published_at',
          'provider_external_id',
          'provider_response_summary',
          'last_provider_action_at',
          'provider_status',
          'provider_error',
          'scheduled_execution_status',
          'scheduled_execution_started_at',
          'scheduled_execution_finished_at',
          'scheduled_execution_error',
          'scheduled_execution_attempts',
          'metadata',
          'created_at',
          'updated_at',
        ],
        removed
      )
    );
  }

  if (selected(categories, 'creative_assets')) {
    const result = await safeSelect(client, 'creative_assets', workspace.id, warnings);
    data.creative_assets_metadata = result.data.map((row) => {
      const safeRow = { ...row };
      safeRow.image_url = isPublicSafeUrl(row.image_url) ? row.image_url : null;
      safeRow.storage_path = safeStoragePath(row.storage_path);
      return sanitizeObject(safeRow, removed);
    });
  }

  if (selected(categories, 'tasks_reviews')) {
    const tasks = await safeSelect(client, 'tasks', workspace.id, warnings);
    const reviews = await safeSelect(client, 'task_reviews', workspace.id, warnings);
    data.tasks = tasks.data.map((row) => {
      const safeRow = { ...row };
      delete safeRow.n8n_execution_id;
      removed.add('n8n_execution_id');
      return sanitizeObject(safeRow, removed);
    });
    data.reviews = reviews.data.map((row) => sanitizeObject(row, removed));
  }

  if (selected(categories, 'reports')) {
    const releases = await safeSelect(client, 'releases', workspace.id, warnings);
    data.reports = releases.data.map((row) =>
      pickSafe(row, ['id', 'title', 'version', 'summary', 'known_issues', 'testing_checklist', 'rollback_notes', 'build_status', 'lint_status', 'typecheck_status', 'deploy_status', 'created_at', 'updated_at'], removed)
    );
  }

  if (selected(categories, 'system_security')) {
    const auditLogs = await safeSelect(client, 'security_audit_logs', workspace.id, warnings);
    const publishAttempts = await safeSelect(client, 'content_studio_publish_attempts', workspace.id, warnings);
    data.system_health = [
      ...auditLogs.data.map((row) => sanitizeObject(row, removed)),
      ...publishAttempts.data.map((row) =>
        pickSafe(row, ['provider', 'action_type', 'status', 'request_summary', 'provider_response_summary', 'error_message', 'provider_external_id', 'created_at', 'updated_at'], removed)
      ),
    ];
  }

  if (selected(categories, 'safe_patch_fix')) {
    const safePatchPlans = await safeSelect(client, 'safe_patch_plans', workspace.id, warnings);
    const codeFixProposals = await safeSelect(client, 'code_fix_proposals', workspace.id, warnings);
    data.safe_patch_plans = safePatchPlans.data.map((row) => sanitizeObject(row, removed));
    data.code_fix_proposals = codeFixProposals.data.map((row) => sanitizeObject(row, removed));
  }

  const recordCounts = {
    settings: Object.keys(data.settings).length ? 1 : 0,
    projects: data.projects.length,
    prompts: data.prompts.length,
    releases: data.releases.length,
    content_items: data.content_items.length,
    creative_assets_metadata: data.creative_assets_metadata.length,
    tasks: data.tasks.length,
    reviews: data.reviews.length,
    reports: data.reports.length,
    system_health: data.system_health.length,
    safe_patch_plans: data.safe_patch_plans.length,
    code_fix_proposals: data.code_fix_proposals.length,
  };
  const totalRecords = Object.values(recordCounts).reduce((total, count) => total + count, 0);
  const createdAt = new Date().toISOString();
  const fileName = buildFileName(createdAt);
  const categoriesMap = Object.fromEntries(allBackupCategories.map((category) => [category, selected(categories, category)])) as Record<BackupCategory, boolean>;
  const backupWithoutSummary = {
    backup_version: '1.0',
    created_at: createdAt,
    workspace: { id: workspace.id, name: workspace.name },
    categories: categoriesMap,
    data,
    security: {
      secrets_excluded: true,
      tokens_excluded: true,
      raw_env_values_excluded: true,
      binary_files_included: false,
    },
  } satisfies Omit<WorkspaceBackup, 'summary'>;
  const markdown = buildBackupMarkdown({
    ...backupWithoutSummary,
    summary: {
      record_counts: recordCounts,
      total_records: totalRecords,
      excluded_sensitive_fields: Array.from(removed).sort(),
      warnings,
      file_name: fileName,
      size_estimate_bytes: 0,
      markdown: '',
    },
  });
  const sizeEstimate = new Blob([JSON.stringify(backupWithoutSummary)]).size;

  return {
    ...backupWithoutSummary,
    summary: {
      record_counts: recordCounts,
      total_records: totalRecords,
      excluded_sensitive_fields: Array.from(removed).sort(),
      warnings,
      file_name: fileName,
      size_estimate_bytes: sizeEstimate,
      markdown,
    },
  };
}

export function buildBackupMarkdown(backup: WorkspaceBackup) {
  const included = allBackupCategories
    .filter((category) => backup.categories[category])
    .map((category) => `- ${backupCategoryLabels[category]}`);
  const projectSummary = backup.data.projects.slice(0, 8).map((project) => `- ${project.name ?? 'Untitled project'} / ${project.status ?? 'unknown'}`);
  const releaseSummary = backup.data.releases.slice(0, 8).map((release) => `- ${release.title ?? 'Untitled release'} / ${release.status ?? 'unknown'}`);
  const contentSummary = summarizeByStatus(backup.data.content_items);
  const taskSummary = summarizeByStatus(backup.data.tasks);

  return [
    '# AgentFlow AI Workspace Backup Summary',
    '',
    `Backup date: ${backup.created_at}`,
    `Workspace: ${backup.workspace.name} (${backup.workspace.id.slice(0, 8)}...)`,
    `Backup version: ${backup.backup_version}`,
    '',
    '## Included Categories',
    ...(included.length ? included : ['- None selected']),
    '',
    '## Record Counts',
    ...Object.entries(backup.summary.record_counts).map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`),
    `- Total records: ${backup.summary.total_records}`,
    '',
    '## Projects Summary',
    ...(projectSummary.length ? projectSummary : ['- No projects included.']),
    '',
    '## Prompt Library Summary',
    `- Prompts exported: ${backup.data.prompts.length}`,
    '',
    '## Releases Summary',
    ...(releaseSummary.length ? releaseSummary : ['- No releases included.']),
    '',
    '## Content Studio Summary',
    ...Object.entries(contentSummary).map(([key, value]) => `- ${key}: ${value}`),
    ...(Object.keys(contentSummary).length ? [] : ['- No content items included.']),
    '',
    '## Creative Assets Metadata Summary',
    `- Asset metadata records exported: ${backup.data.creative_assets_metadata.length}`,
    '- Binary image/video files are not included.',
    '',
    '## Tasks & Reviews Summary',
    ...Object.entries(taskSummary).map(([key, value]) => `- ${key}: ${value}`),
    `- Reviews exported: ${backup.data.reviews.length}`,
    '',
    '## System/Recovery/Security Summary',
    `- Safe operational records exported: ${backup.data.system_health.length}`,
    '',
    '## Excluded Sensitive Data',
    '- Provider access tokens, refresh tokens, encrypted token fields, API keys, secrets, passwords, authorization headers, raw env values, and n8n execution ids are excluded or redacted.',
    `- Redacted field names detected: ${backup.summary.excluded_sensitive_fields.length ? backup.summary.excluded_sensitive_fields.join(', ') : 'none detected'}`,
    '',
    '## Restore Notes',
    '- Full restore is not enabled in this phase.',
    '- Use this backup for reference, recovery planning, manual comparison, or future preview-only restore validation.',
    '',
    '## Next Recommended Actions',
    '- Store the JSON export somewhere secure.',
    '- Keep a copy of this Markdown summary with release notes or incident records.',
    '- Create a fresh backup before major schema, provider, or deployment changes.',
    '',
    '## Warnings',
    ...backup.summary.warnings.map((warning) => `- ${warning}`),
  ].join('\n');
}
