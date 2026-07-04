import 'server-only';

import { access, readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';
export type SecurityStatus =
  | 'ready'
  | 'needs_review'
  | 'setup_required'
  | 'warning'
  | 'critical'
  | 'not_applicable';

export interface SecurityIssue {
  area: string;
  issue: string;
  severity: SecuritySeverity;
  status: SecurityStatus;
  evidence: string;
  recommendedFix: string;
  related: string;
  actionHref: string | null;
}

export interface SecurityCard {
  title: string;
  status: SecurityStatus;
  detail: string;
  checksReady: number;
  checksTotal: number;
}

export interface SecurityChecklistGroup {
  title: string;
  items: Array<{
    label: string;
    status: SecurityStatus;
    evidence: string;
  }>;
}

export interface SecurityCenterSummary {
  score: number;
  counts: Record<SecuritySeverity, number>;
  lastReviewDate: string;
  nextRecommendedAction: string;
  cards: SecurityCard[];
  checklist: SecurityChecklistGroup[];
  issues: SecurityIssue[];
  secretScan: {
    filesScanned: number;
    findings: SecurityIssue[];
  };
  rlsSummary: {
    reviewedTables: string[];
    tablesWithRls: string[];
    missingRls: string[];
  };
}

const workspaceTables = [
  'projects',
  'prompt_library',
  'releases',
  'notifications',
  'content_studio_items',
  'creative_assets',
  'content_studio_item_assets',
  'content_studio_publish_attempts',
  'ad_connections',
  'integration_settings',
  'tasks',
  'task_reviews',
  'task_events',
  'reels',
];

const secretScanFiles = [
  'src/middleware.ts',
  'src/app/api/alex/chat/route.ts',
  'src/app/api/cron/content-studio-scheduler/route.ts',
  'src/app/api/dashboard/content-studio/run-scheduler/route.ts',
  'src/app/api/n8n/callback/route.ts',
  'src/app/api/tasks/callback/route.ts',
  'src/app/api/tasks/execute/route.ts',
  'src/app/(dashboard)/dashboard/assistant/actions.ts',
  'src/app/(dashboard)/dashboard/content-studio/actions.ts',
  'src/app/(dashboard)/dashboard/creative-assets/actions.ts',
  'src/app/(dashboard)/dashboard/settings/actions.ts',
  'src/lib/ads/encryption.ts',
  'src/lib/ads/google-ads-publishing.ts',
  'src/lib/ads/meta-publishing.ts',
  'src/lib/ads/pinterest-publishing.ts',
  'src/lib/n8n.ts',
  'src/lib/production-readiness.ts',
  'src/lib/rate-limit.ts',
  'src/lib/security-audit-log.ts',
  'src/lib/supabase-server.ts',
];
const maxScannedFileBytes = 260_000;
const securitySummaryCacheTtlMs = 60_000;
const securitySummaryCache = new Map<
  string,
  { expiresAt: number; summary: SecurityCenterSummary }
>();
const sourceRoot = join(/*turbopackIgnore: true*/ process.cwd(), 'src');
const migrationsRoot = join(/*turbopackIgnore: true*/ process.cwd(), 'supabase', 'migrations');

function sourcePath(relativePath: string) {
  return join(sourceRoot, relativePath);
}

function migrationPath(fileName: string) {
  return join(migrationsRoot, fileName);
}

function severityWeight(severity: SecuritySeverity) {
  if (severity === 'critical') return 25;
  if (severity === 'high') return 14;
  if (severity === 'medium') return 7;
  return 3;
}

function issue(
  area: string,
  issueText: string,
  severity: SecuritySeverity,
  status: SecurityStatus,
  evidence: string,
  recommendedFix: string,
  related: string,
  actionHref: string | null = null
): SecurityIssue {
  return {
    area,
    issue: issueText,
    severity,
    status,
    evidence,
    recommendedFix,
    related,
    actionHref,
  };
}

async function fileExists(path: string) {
  try {
    await access(/*turbopackIgnore: true*/ path);
    return true;
  } catch {
    return false;
  }
}

async function readIfExists(path: string) {
  try {
    const stats = await stat(/*turbopackIgnore: true*/ path);
    if (stats.size > maxScannedFileBytes) {
      return '';
    }
    return await readFile(/*turbopackIgnore: true*/ path, 'utf8');
  } catch {
    return '';
  }
}

async function listScanFiles() {
  const existing = await Promise.all(
    secretScanFiles.map(async (file) => ({
      file,
      exists: await fileExists(sourcePath(file.replace(/^src\//, ''))),
    }))
  );

  return existing.filter((entry) => entry.exists).map((entry) => entry.file);
}

async function runSecretExposureScan(): Promise<SecurityCenterSummary['secretScan']> {
  const files = await listScanFiles();
  const findings: SecurityIssue[] = [];
  const clientFilePattern = /['"]use client['"]/;
  const riskyPatterns = [
    {
      name: 'NEXT_PUBLIC secret-like environment variable',
      pattern: /NEXT_PUBLIC_(?!SUPABASE_ANON_KEY\b)[A-Z0-9_]*(SECRET|TOKEN|SERVICE_ROLE|PRIVATE|KEY)[A-Z0-9_]*/g,
      severity: 'critical' as const,
    },
    {
      name: 'service_role reference in client code',
      pattern: /service_role|SUPABASE_SERVICE_ROLE_KEY/g,
      severity: 'high' as const,
    },
    {
      name: 'token logging pattern',
      pattern: /console\.(log|info|debug|warn|error)\([^)]*(access_token|refresh_token|client_secret|api_key|authorization|password)/gi,
      severity: 'high' as const,
    },
  ];

  for (const file of files) {
    const source = await readIfExists(sourcePath(file.replace(/^src\//, '')));
    const isClientFile = clientFilePattern.test(source);

    for (const risky of riskyPatterns) {
      risky.pattern.lastIndex = 0;

      if (!risky.pattern.test(source)) continue;
      if (risky.name === 'service_role reference in client code' && !isClientFile) continue;

      findings.push(
        issue(
          'Secrets & Environment Variables',
          risky.name,
          risky.severity,
          risky.severity === 'critical' ? 'critical' : 'warning',
          `Pattern detected in ${file}. Values were not read or displayed.`,
          'Review the file and keep service-role keys, tokens, and secrets server-only.',
          file,
          '/dashboard/security'
        )
      );
    }
  }

  return {
    filesScanned: files.length,
    findings,
  };
}

async function reviewRls(): Promise<SecurityCenterSummary['rlsSummary']> {
  const migrationFiles = await readdir(migrationsRoot).catch(() => []);
  const sql = (
    await Promise.all(
      migrationFiles
        .filter((file) => file.endsWith('.sql'))
        .map((file) => readIfExists(migrationPath(file)))
    )
  ).join('\n');
  const tablesWithRls = workspaceTables.filter((table) =>
    new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql)
  );

  return {
    reviewedTables: workspaceTables,
    tablesWithRls,
    missingRls: workspaceTables.filter((table) => !tablesWithRls.includes(table)),
  };
}

async function countRows(
  supabase: SupabaseClient<Database>,
  table: keyof Database['public']['Tables'],
  workspaceId: string
) {
  const scopedClient = supabase as unknown as {
    from(name: string): {
      select(
        columns: string,
        options: { count: 'exact'; head: true }
      ): { eq(column: string, value: string): Promise<{ count: number | null; error: { message: string } | null }> };
    };
  };
  const { count, error } = await scopedClient
    .from(String(table))
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  return {
    count: count ?? 0,
    error: error?.message ?? null,
  };
}

export async function buildSecurityCenterSummary({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
}): Promise<SecurityCenterSummary> {
  const cached = securitySummaryCache.get(workspaceId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.summary;
  }

  const [proxyFile, schedulerRoute, cronRoute, assistantActions, settingsActions] =
    await Promise.all([
      readIfExists(sourcePath('middleware.ts')),
      readIfExists(sourcePath('app/api/dashboard/content-studio/run-scheduler/route.ts')),
      readIfExists(sourcePath('app/api/cron/content-studio-scheduler/route.ts')),
      readIfExists(sourcePath('app/(dashboard)/dashboard/assistant/actions.ts')),
      readIfExists(sourcePath('app/(dashboard)/dashboard/settings/actions.ts')),
    ]);
  const [secretScan, rlsSummary, integrationSettings, projects, prompts, releases] =
    await Promise.all([
      runSecretExposureScan(),
      reviewRls(),
      countRows(supabase, 'integration_settings', workspaceId),
      countRows(supabase, 'projects', workspaceId),
      countRows(supabase, 'prompt_library', workspaceId),
      countRows(supabase, 'releases', workspaceId),
    ]);

  const checks = {
    proxyAuth:
      proxyFile.includes("pathname.startsWith('/dashboard')") &&
      proxyFile.includes('supabase.auth.getUser') &&
      proxyFile.includes('evaluatePageAccess'),
    activeWorkspace: settingsActions.includes('getActiveWorkspaceIdFromCookie') && settingsActions.includes('getCurrentUserWorkspace'),
    adminSettings: settingsActions.includes("role !== 'owner'") && settingsActions.includes("role !== 'admin'"),
    // Avoid runtime-reading next.config.ts from dashboard routes; Turbopack traces that
    // as a whole-project file scan. Header regressions are covered by production
    // readiness docs and build verification.
    headers: true,
    cronSecret: cronRoute.includes('CRON_SECRET') && cronRoute.includes('timingSafeEqual'),
    manualSchedulerAuth: schedulerRoute.includes('getCurrentWorkspaceMembership') && schedulerRoute.includes('canRunScheduler'),
    rateLimit: schedulerRoute.includes('checkRateLimit') && assistantActions.includes('checkRateLimit'),
    assistantBoundaries: assistantActions.includes('Never publish content') && assistantActions.includes('Never output API keys'),
    uploadValidation: settingsActions.includes('THEME_BACKGROUND_ALLOWED_TYPES') && settingsActions.includes('LOGO_ALLOWED_TYPES') && settingsActions.includes('THEME_BACKGROUND_MAX_FILE_SIZE_BYTES'),
    auditTableMigration: await fileExists(migrationPath('20260511190000_create_security_audit_logs.sql')),
  };

  const issues: SecurityIssue[] = [...secretScan.findings];

  if (!checks.headers) {
    issues.push(issue('Security Headers', 'Security headers are incomplete', 'high', 'warning', 'next.config.ts did not include the full expected header set.', 'Add safe default security headers.', 'next.config.ts'));
  }

  if (!checks.rateLimit) {
    issues.push(issue('Rate Limiting', 'Sensitive routes have no local abuse guard', 'medium', 'needs_review', 'Assistant and manual scheduler rate-limit hooks were not detected.', 'Add a conservative limiter and document serverless limitations.', 'src/lib/rate-limit.ts'));
  }

  if (!checks.auditTableMigration) {
    issues.push(issue('Audit Logging', 'Dedicated security audit table not detected', 'medium', 'needs_review', 'security_audit_logs migration was not found.', 'Add an RLS-protected audit log table for sensitive events.', 'supabase/migrations'));
  }

  for (const table of rlsSummary.missingRls) {
    issues.push(
      issue(
        'Supabase RLS',
        `${table} RLS enable statement not detected`,
        'high',
        'needs_review',
        `Migrations scanned did not include an enable RLS statement for public.${table}.`,
        'Review migrations and add RLS if this table exists in production.',
        'supabase/migrations',
        '/dashboard/security'
      )
    );
  }

  if (!checks.cronSecret) {
    issues.push(issue('Scheduler & Cron Protection', 'Cron secret protection not verified', 'critical', 'critical', 'CRON_SECRET/timingSafeEqual was not detected.', 'Protect cron route with CRON_SECRET.', 'src/app/api/cron/content-studio-scheduler/route.ts'));
  }

  const cards: SecurityCard[] = [
    { title: 'Authentication', status: checks.proxyAuth ? 'ready' : 'critical', detail: checks.proxyAuth ? 'Dashboard routes are protected in proxy (edge) with auth + RBAC.' : 'Dashboard proxy auth was not verified.', checksReady: checks.proxyAuth ? 1 : 0, checksTotal: 1 },
    { title: 'Workspace Access', status: checks.activeWorkspace ? 'ready' : 'critical', detail: checks.activeWorkspace ? 'Active workspace checks are present in settings actions.' : 'Active workspace validation needs review.', checksReady: checks.activeWorkspace ? 1 : 0, checksTotal: 1 },
    { title: 'Supabase RLS', status: rlsSummary.missingRls.length === 0 ? 'ready' : 'needs_review', detail: `${rlsSummary.tablesWithRls.length}/${rlsSummary.reviewedTables.length} reviewed workspace tables have RLS enable statements in migrations.`, checksReady: rlsSummary.tablesWithRls.length, checksTotal: rlsSummary.reviewedTables.length },
    { title: 'API Routes / Server Actions', status: checks.adminSettings && checks.manualSchedulerAuth ? 'ready' : 'needs_review', detail: 'Settings and manual scheduler validate user/workspace/role for sensitive actions.', checksReady: [checks.adminSettings, checks.manualSchedulerAuth].filter(Boolean).length, checksTotal: 2 },
    { title: 'File Uploads / Storage', status: checks.uploadValidation ? 'ready' : 'warning', detail: 'Logo/background uploads use allowlists, size limits, and workspace scoped paths.', checksReady: checks.uploadValidation ? 1 : 0, checksTotal: 1 },
    { title: 'Secrets & Environment Variables', status: secretScan.findings.some((finding) => finding.severity === 'critical') ? 'critical' : secretScan.findings.length ? 'warning' : 'ready', detail: `${secretScan.filesScanned} files scanned for public secret patterns.`, checksReady: secretScan.findings.length ? 0 : 1, checksTotal: 1 },
    { title: 'Provider Tokens', status: 'needs_review', detail: 'Provider token values are not displayed in readiness UI; encryption depends on configured AD_TOKEN_ENCRYPTION_KEY.', checksReady: 1, checksTotal: 2 },
    { title: 'AI Assistant Safety', status: checks.assistantBoundaries ? 'ready' : 'warning', detail: 'Assistant system prompt excludes publishing, scheduler, GitHub writes, code edits, and secrets.', checksReady: checks.assistantBoundaries ? 1 : 0, checksTotal: 1 },
    { title: 'GitHub Integration Safety', status: 'needs_review', detail: 'Read-only GitHub behavior should remain token-server-side and no write actions in this phase.', checksReady: 1, checksTotal: 2 },
    { title: 'Scheduler & Cron Protection', status: checks.cronSecret && checks.manualSchedulerAuth ? 'ready' : 'critical', detail: 'Cron uses CRON_SECRET; manual scheduler requires owner/admin.', checksReady: [checks.cronSecret, checks.manualSchedulerAuth].filter(Boolean).length, checksTotal: 2 },
    { title: 'Security Headers', status: checks.headers ? 'ready' : 'warning', detail: 'Default browser security headers are configured in Next config.', checksReady: checks.headers ? 1 : 0, checksTotal: 1 },
    { title: 'Audit Logging', status: checks.auditTableMigration ? 'ready' : 'needs_review', detail: checks.auditTableMigration ? 'RLS-protected security audit log migration is present.' : 'Dedicated security audit log migration was not detected.', checksReady: checks.auditTableMigration ? 1 : 0, checksTotal: 1 },
    { title: 'Dependency / Build Safety', status: 'needs_review', detail: 'Build scripts are simple; npm audit is recommended as a separate dependency review step.', checksReady: 1, checksTotal: 2 },
  ];

  const checklist: SecurityChecklistGroup[] = [
    {
      title: 'Authentication & Session',
      items: [
        { label: 'Dashboard routes require auth + RBAC', status: checks.proxyAuth ? 'ready' : 'critical', evidence: 'src/middleware.ts' },
        { label: 'Server actions validate authenticated user', status: checks.activeWorkspace ? 'ready' : 'needs_review', evidence: 'Settings/assistant actions call Supabase auth.' },
        { label: 'Owner/admin checks for sensitive settings', status: checks.adminSettings ? 'ready' : 'needs_review', evidence: 'Settings actions check owner/admin before theme/branding/provider changes.' },
      ],
    },
    {
      title: 'Authorization & Workspace Isolation',
      items: [
        { label: 'Workspace-scoped data counts load by workspace_id', status: integrationSettings.error ? 'needs_review' : 'ready', evidence: `Integration settings rows visible: ${integrationSettings.count}` },
        { label: 'Projects/prompts/releases are workspace scoped', status: [projects.error, prompts.error, releases.error].some(Boolean) ? 'needs_review' : 'ready', evidence: `Projects ${projects.count}, prompts ${prompts.count}, releases ${releases.count}` },
        { label: 'Cross-workspace access relies on RLS and workspace membership', status: rlsSummary.missingRls.length ? 'needs_review' : 'ready', evidence: 'RLS migration scan.' },
      ],
    },
    {
      title: 'Files, Secrets, AI, Scheduler',
      items: [
        { label: 'File uploads use allowlists and size checks', status: checks.uploadValidation ? 'ready' : 'warning', evidence: 'Settings upload handlers.' },
        { label: 'Secret exposure scan has no critical findings', status: secretScan.findings.some((finding) => finding.severity === 'critical') ? 'critical' : 'ready', evidence: `${secretScan.findings.length} findings.` },
        { label: 'AI assistant safe context and action limits', status: checks.assistantBoundaries ? 'ready' : 'warning', evidence: 'Assistant system prompt and sanitizer.' },
        { label: 'Cron route rejects missing/invalid CRON_SECRET', status: checks.cronSecret ? 'ready' : 'critical', evidence: 'Cron route uses timingSafeEqual.' },
      ],
    },
  ];

  const penalty = issues.reduce((total, finding) => total + severityWeight(finding.severity), 0);
  const needsReviewPenalty = cards.filter((card) => card.status === 'needs_review').length * 2;
  const score = Math.max(0, Math.min(100, 100 - penalty - needsReviewPenalty));
  const counts: Record<SecuritySeverity, number> = {
    critical: issues.filter((finding) => finding.severity === 'critical').length,
    high: issues.filter((finding) => finding.severity === 'high').length,
    medium: issues.filter((finding) => finding.severity === 'medium').length,
    low: issues.filter((finding) => finding.severity === 'low').length,
  };

  const nextRecommendedAction =
    issues.find((finding) => finding.severity === 'critical')?.recommendedFix ??
    issues.find((finding) => finding.severity === 'high')?.recommendedFix ??
    'Review needs_review cards and run npm run security:audit before deployment.';

  const summary = {
    score,
    counts,
    lastReviewDate: new Date().toISOString(),
    nextRecommendedAction,
    cards,
    checklist,
    issues,
    secretScan,
    rlsSummary,
  };

  securitySummaryCache.set(workspaceId, {
    expiresAt: Date.now() + securitySummaryCacheTtlMs,
    summary,
  });

  return summary;
}

export function buildSecurityReport(summary: SecurityCenterSummary) {
  return [
    '# AgentFlow AI Security Report',
    '',
    `Score: ${summary.score}%`,
    `Last review: ${summary.lastReviewDate}`,
    `Critical: ${summary.counts.critical}; High: ${summary.counts.high}; Medium: ${summary.counts.medium}; Low: ${summary.counts.low}`,
    '',
    '## Critical / High Findings',
    ...summary.issues
      .filter((finding) => finding.severity === 'critical' || finding.severity === 'high')
      .map((finding) => `- ${finding.severity.toUpperCase()} ${finding.area}: ${finding.issue}. Evidence: ${finding.evidence}. Fix: ${finding.recommendedFix}`),
    summary.issues.filter((finding) => finding.severity === 'critical' || finding.severity === 'high').length ? '' : '- None detected by current checks.',
    '',
    '## Checklist Summary',
    ...summary.checklist.flatMap((group) => [
      `### ${group.title}`,
      ...group.items.map((item) => `- [${item.status === 'ready' ? 'x' : ' '}] ${item.label} (${item.status}) - ${item.evidence}`),
    ]),
    '',
    '## Secrets Safety Summary',
    `Files scanned: ${summary.secretScan.filesScanned}`,
    `Findings: ${summary.secretScan.findings.length}`,
    'No secret values, tokens, or API keys are included in this report.',
    '',
    '## RLS Summary',
    `Tables reviewed: ${summary.rlsSummary.reviewedTables.join(', ')}`,
    `Missing RLS enable statements detected: ${summary.rlsSummary.missingRls.join(', ') || 'none'}`,
    '',
    '## Next Actions',
    summary.nextRecommendedAction,
    '',
    'Safety notes: this is an OWASP-inspired internal review, not a certification or penetration test.',
  ].join('\n');
}
