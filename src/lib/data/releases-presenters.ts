import type { ReleaseRecord, ReleaseStatus, ReleaseType } from '@/types/database';

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
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}