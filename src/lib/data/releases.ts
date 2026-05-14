import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { JsonObject } from '@/types';
import type { Database, ReleaseRecord, ReleaseStatus, ReleaseType } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

type ReleaseClient = SupabaseClient<Database>;

export interface ReleaseInput {
  projectId: string | null;
  title: string;
  version: string | null;
  phaseName: string | null;
  status: ReleaseStatus;
  releaseType: ReleaseType;
  summary: string | null;
  filesChanged: string | null;
  featuresAdded: string | null;
  fixes: string | null;
  knownIssues: string | null;
  testingChecklist: string | null;
  rollbackNotes: string | null;
  deployUrl: string | null;
  mainProductionUrl: string | null;
  buildStatus: string | null;
  lintStatus: string | null;
  typecheckStatus: string | null;
  deployStatus: string | null;
  deployedAt: string | null;
  metadata?: JsonObject;
}

export interface CreateReleaseInput extends ReleaseInput {
  workspaceId: string;
  userId: string;
}

export interface UpdateReleaseInput extends ReleaseInput {
  id: string;
  workspaceId: string;
}

export const releaseStatuses: ReleaseStatus[] = [
  'draft',
  'ready_for_test',
  'testing',
  'ready_to_deploy',
  'deployed',
  'failed',
  'rolled_back',
  'archived',
];

export const releaseTypes: ReleaseType[] = [
  'feature',
  'bug_fix',
  'ui_update',
  'provider_update',
  'database_migration',
  'deployment',
  'documentation',
  'stabilization',
  'security',
  'internal_tooling',
];

export function formatReleaseStatus(status: ReleaseStatus) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatReleaseType(type: ReleaseType) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getReleaseNextAction(release: ReleaseRecord) {
  if (release.build_status?.toLowerCase().includes('fail')) return 'Fix build errors';
  if (release.deploy_status?.toLowerCase().includes('fail')) return 'Retry deploy';
  if (release.status === 'ready_to_deploy') return 'Deploy to production';
  if (release.known_issues?.trim()) return 'Review known issues';
  if (release.status === 'deployed') return 'Monitor production';
  return 'Continue release documentation';
}

export function buildReleaseReport(release: ReleaseRecord, projectName?: string | null) {
  return [
    `Release: ${release.title}`,
    release.version ? `Version: ${release.version}` : null,
    release.phase_name ? `Phase: ${release.phase_name}` : null,
    projectName ? `Project: ${projectName}` : null,
    `Status: ${formatReleaseStatus(release.status)}`,
    `Type: ${formatReleaseType(release.release_type)}`,
    '',
    'Summary:',
    release.summary || 'Not added.',
    '',
    'Files Changed:',
    release.files_changed || 'Not added.',
    '',
    'Features Added:',
    release.features_added || 'Not added.',
    '',
    'Fixes:',
    release.fixes || 'Not added.',
    '',
    'Checks:',
    `- Lint: ${release.lint_status || 'Not added'}`,
    `- Typecheck: ${release.typecheck_status || 'Not added'}`,
    `- Build: ${release.build_status || 'Not added'}`,
    `- Deploy: ${release.deploy_status || 'Not added'}`,
    '',
    `Deployment URL: ${release.deploy_url || 'Not added'}`,
    `Production URL: ${release.main_production_url || 'Not added'}`,
    '',
    'Known Issues:',
    release.known_issues || 'None recorded.',
    '',
    'Rollback Notes:',
    release.rollback_notes || 'Not added.',
    '',
    'Safety Confirmations:',
    '- Task execution logic was not changed.',
    '- Provider publishing logic was not changed.',
    '- Real Scheduling Execution core logic was not changed.',
    '- n8n/callbacks/webhooks were not changed.',
    '- Environment variables/secrets were not touched.',
    '- ads_management was not added.',
  ].filter((line): line is string => line !== null).join('\n');
}

export async function listReleasesForWorkspace(
  workspaceId: string,
  client: ReleaseClient = supabase as ReleaseClient
): Promise<DataResult<ReleaseRecord[]>> {
  if (!isSupabaseConfigured) return emptyDataResult([], false);
  const { data, error } = await client
    .from('releases')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });
  if (error) return errorDataResult([], error.message);
  return emptyDataResult(data ?? [], true);
}

export async function getReleaseById(id: string, workspaceId: string, client: ReleaseClient = supabase as ReleaseClient) {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);
  const { data, error } = await client
    .from('releases')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data ?? null, true);
}

export async function createRelease(input: CreateReleaseInput, client: ReleaseClient = supabase as ReleaseClient) {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);
  const { data, error } = await client
    .from('releases')
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      ...mapReleaseFields(input),
    })
    .select('*')
    .single();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}

export async function updateRelease(input: UpdateReleaseInput, client: ReleaseClient = supabase as ReleaseClient) {
  if (!isSupabaseConfigured) return emptyDataResult(null, false);
  const { data, error } = await client
    .from('releases')
    .update(mapReleaseFields(input))
    .eq('id', input.id)
    .eq('workspace_id', input.workspaceId)
    .select('*')
    .single();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}

function mapReleaseFields(input: ReleaseInput) {
  return {
    project_id: input.projectId,
    title: input.title,
    version: input.version,
    phase_name: input.phaseName,
    status: input.status,
    release_type: input.releaseType,
    summary: input.summary,
    files_changed: input.filesChanged,
    features_added: input.featuresAdded,
    fixes: input.fixes,
    known_issues: input.knownIssues,
    testing_checklist: input.testingChecklist,
    rollback_notes: input.rollbackNotes,
    deploy_url: input.deployUrl,
    main_production_url: input.mainProductionUrl,
    build_status: input.buildStatus,
    lint_status: input.lintStatus,
    typecheck_status: input.typecheckStatus,
    deploy_status: input.deployStatus,
    deployed_at: input.deployedAt,
    metadata: input.metadata ?? {},
  };
}
