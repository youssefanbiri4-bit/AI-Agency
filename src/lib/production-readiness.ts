import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JsonObject, JsonValue } from '@/types';
import type { ContentStudioPlatform } from '@/types/database';
import type { Database } from '@/types/database';
import type { StrictWorkspaceRole } from '@/lib/permissions-matrix';
import { getGoogleAdsExecutionReadiness } from '@/lib/ads/google-ads-publishing';
import { checkOpenAIContentReadiness } from '@/lib/ai/openai-content';
import { listBackupRecordsForWorkspace } from '@/lib/data/backup-records';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { checkRateLimit, getRateLimitStoreMode } from '@/lib/rate-limit';
import { isRedisAvailable } from '@/lib/redis';
import { setupBlockerMessage } from '@/lib/safe-messages';

export type ProductionReadinessStatus = 'ready' | 'blocked' | 'warning';
export type ProductionCheckStatus = 'ready' | 'blocked' | 'warning' | 'not_configured';
export type LaunchMode = 'blocked' | 'internal' | 'production';
export type PaidProvider = 'meta' | 'google_ads' | 'pinterest';

export interface ProductionCheck {
  key: string;
  label: string;
  status: ProductionCheckStatus;
  message: string;
}

export interface SpendControlSettings extends JsonObject {
  paid_ads_enabled: boolean;
  max_daily_ad_spend: number | null;
  require_manual_confirmation: boolean;
  allowed_providers: PaidProvider[];
  launch_mode: LaunchMode;
}

export interface ProductionReadinessResult {
  overallStatus: ProductionReadinessStatus;
  score: number;
  blockers: string[];
  warnings: string[];
  recommendedActions: string[];
  safeToUseInternally: boolean;
  safeForRealClients: boolean;
  safeForPaidAds: boolean;
  checkedAt: string;
  env: ProductionCheck[];
  migrations: ProductionCheck[];
  security: ProductionCheck[];
  rateLimits: ProductionCheck[];
  providers: ProductionCheck[];
  paidAds: ProductionCheck[];
  backups: ProductionCheck[];
  monitoring: ProductionCheck[];
  spendControls: SpendControlSettings;
}

export interface PaidAdsPreflightInput {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  userId: string;
  role: StrictWorkspaceRole;
  provider: PaidProvider;
  actionLabel: string;
  explicitConfirmation: boolean;
}

export const PRODUCTION_OPERATIONS_SETTINGS_KEY = 'production_operations';

export const defaultSpendControlSettings: SpendControlSettings = {
  paid_ads_enabled: false,
  max_daily_ad_spend: null,
  require_manual_confirmation: true,
  allowed_providers: [],
  launch_mode: 'blocked',
};

const productionReadinessCache = new Map<
  string,
  { expiresAt: number; result: ProductionReadinessResult }
>();

function getProductionReadinessCacheKey(workspaceId: string, userId: string) {
  return `${workspaceId}:${userId}`;
}

export function clearProductionReadinessCache(workspaceId?: string, userId?: string) {
  if (!workspaceId) {
    productionReadinessCache.clear();
    return;
  }

  if (userId) {
    productionReadinessCache.delete(getProductionReadinessCacheKey(workspaceId, userId));
    return;
  }

  for (const key of productionReadinessCache.keys()) {
    if (key.startsWith(`${workspaceId}:`)) {
      productionReadinessCache.delete(key);
    }
  }
}

const requiredEnvNames = [
  'OPENAI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AD_TOKEN_ENCRYPTION_KEY',
  'N8N_CALLBACK_SECRET',
  'N8N_WEBHOOK_URL',
  'TASK_EXECUTION_ENABLED',
  'CRON_SECRET',
] as const;

const providerEnvNames = {
  meta: ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI'],
  google_ads: [
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_REDIRECT_URI',
  ],
  pinterest: ['PINTEREST_APP_SECRET', 'PINTEREST_REDIRECT_URI'],
} as const;

function isEnvPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function checkEnv(name: string): ProductionCheck {
  const present = isEnvPresent(name);

  return {
    key: `env:${name}`,
    label: name,
    status: present ? 'ready' : 'blocked',
    message: present
      ? 'Configured server-side. No value is displayed.'
      : setupBlockerMessage({
          missing: name,
          reason: 'this production dependency is required before the platform can safely run client work',
          next: 'add it in Vercel server environment variables, redeploy, and rerun the production check',
        }),
  };
}

function readObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function readLaunchMode(value: unknown): LaunchMode {
  return value === 'internal' || value === 'production' ? value : 'blocked';
}

function readAllowedProviders(value: unknown): PaidProvider[] {
  if (!Array.isArray(value)) return [];
  return value.filter((provider): provider is PaidProvider =>
    provider === 'meta' || provider === 'google_ads' || provider === 'pinterest'
  );
}

export function normalizeSpendControlSettings(value: unknown): SpendControlSettings {
  const raw = readObject(value);

  return {
    paid_ads_enabled: readBoolean(
      raw.paid_ads_enabled,
      defaultSpendControlSettings.paid_ads_enabled
    ),
    max_daily_ad_spend: readNumberOrNull(raw.max_daily_ad_spend),
    require_manual_confirmation: readBoolean(
      raw.require_manual_confirmation,
      defaultSpendControlSettings.require_manual_confirmation
    ),
    allowed_providers: readAllowedProviders(raw.allowed_providers),
    launch_mode: readLaunchMode(raw.launch_mode),
  };
}

export function serializeSpendControlSettings(settings: SpendControlSettings): JsonObject {
  return {
    paid_ads_enabled: settings.paid_ads_enabled,
    max_daily_ad_spend: settings.max_daily_ad_spend,
    require_manual_confirmation: settings.require_manual_confirmation,
    allowed_providers: settings.allowed_providers,
    launch_mode: settings.launch_mode,
  };
}

async function loadIntegrationSettings(
  supabase: SupabaseClient<Database>,
  workspaceId: string
) {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings, n8n_status, supabase_status')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    return {
      settings: {},
      n8nStatus: null,
      supabaseStatus: null,
      error: error.message,
    };
  }

  return {
    settings: readObject(data?.settings),
    n8nStatus: data?.n8n_status ?? null,
    supabaseStatus: data?.supabase_status ?? null,
    error: null,
  };
}

async function checkN8nCallbackEventsTable() {
  const { client } = getSupabaseAdmin();

  if (!client) {
    return {
      key: 'migration:n8n_callback_events',
      label: 'n8n_callback_events',
      status: 'blocked' as const,
      message: setupBlockerMessage({
        missing: 'Supabase service role server configuration',
        reason: 'the app cannot verify the n8n callback idempotency table without a server-side admin check',
        next: 'configure Supabase server credentials in Vercel and redeploy',
      }),
    };
  }

  const { error: selectError } = await client
    .from('n8n_callback_events')
    .select('id', { count: 'exact', head: true })
    .limit(1);

  return {
    key: 'migration:n8n_callback_events',
    label: 'n8n callback idempotency table',
    status: selectError ? ('blocked' as const) : ('ready' as const),
    message: selectError
      ? setupBlockerMessage({
          missing: 'n8n_callback_events table',
          reason: 'duplicate/replay callback protection cannot be verified',
          next: 'apply the Phase 2 Supabase migration, then rerun the production check',
        })
      : 'n8n callback idempotency table exists.',
  };
}

async function checkSecurityAuditLogsTable() {
  const { client } = getSupabaseAdmin();

  if (!client) {
    return {
      key: 'migration:security_audit_logs',
      label: 'security_audit_logs',
      status: 'blocked' as const,
      message: setupBlockerMessage({
        missing: 'Supabase service role server configuration',
        reason: 'the app cannot verify operational audit logging safely',
        next: 'configure Supabase server credentials in Vercel and redeploy',
      }),
    };
  }

  const { error: selectError } = await client
    .from('security_audit_logs')
    .select('id', { count: 'exact', head: true })
    .limit(1);

  return {
    key: 'migration:security_audit_logs',
    label: 'Security audit logs table',
    status: selectError ? ('blocked' as const) : ('ready' as const),
    message: selectError
      ? setupBlockerMessage({
          missing: 'security_audit_logs table',
          reason: 'production and paid-ads blocker events must be auditable',
          next: 'apply the security audit logs migration, then rerun the production check',
        })
      : 'security_audit_logs table exists for operational events.',
  };
}

function checkProductionAuditMarker(): ProductionCheck {
  const passed = process.env.PRODUCTION_AUDIT_PASSED === 'true';
  const hasDate = isEnvPresent('PRODUCTION_AUDIT_DATE');
  const hasSha = isEnvPresent('PRODUCTION_AUDIT_COMMIT_SHA');

  return {
    key: 'security:npm-audit',
    label: 'Production audit marker',
    status: passed && hasDate && hasSha ? 'ready' : 'blocked',
    message:
      passed && hasDate && hasSha
        ? 'Production audit marker is present for this release.'
        : setupBlockerMessage({
            missing: 'production audit marker',
            reason: 'runtime cannot prove this exact release passed audit/build/smoke checks',
            next: 'set PRODUCTION_AUDIT_PASSED, PRODUCTION_AUDIT_DATE, and PRODUCTION_AUDIT_COMMIT_SHA after CI passes',
          }),
  };
}

async function loadProviderConnectionStatus(
  workspaceId: string,
  userId: string,
  provider: PaidProvider
): Promise<ProductionCheck> {
  const { client } = getSupabaseAdmin();

  if (!client) {
    return {
      key: `provider:${provider}:oauth`,
      label: `${provider} OAuth`,
      status: 'blocked',
      message: setupBlockerMessage({
        missing: 'Supabase service role server configuration',
        reason: `${provider} OAuth state must be verified server-side without exposing tokens`,
        next: 'configure Supabase server credentials and rerun Provider Setup',
      }),
    };
  }

  const { data, error: selectError } = await client
    .from('ad_connections')
    .select('status, token_expires_at, scopes, ad_account_id, metadata')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();

  if (selectError) {
    return {
      key: `provider:${provider}:oauth`,
      label: `${provider} OAuth`,
      status: 'blocked',
      message: setupBlockerMessage({
        missing: `${provider} OAuth verification`,
        reason: 'the provider connection could not be checked safely',
        next: 'reconnect the provider from Settings and rerun the production check',
      }),
    };
  }

  if (!data) {
    return {
      key: `provider:${provider}:oauth`,
      label: `${provider} OAuth`,
      status: 'blocked',
      message: setupBlockerMessage({
        missing: `${provider} OAuth connection`,
        reason: 'provider actions require a verified workspace connection before any send/publish action',
        next: 'connect the provider from Settings > Provider Setup',
      }),
    };
  }

  const expired =
    data.token_expires_at && Date.parse(data.token_expires_at) <= Date.now();

  if (data.status !== 'connected' || expired) {
    return {
      key: `provider:${provider}:oauth`,
      label: `${provider} OAuth`,
      status: 'blocked',
      message: setupBlockerMessage({
        missing: `valid ${provider} OAuth connection`,
        reason: 'the stored provider connection is missing, expired, or revoked',
        next: 'reconnect the provider from Settings > Provider Setup',
      }),
    };
  }

  const scopes = Array.isArray(data.scopes) ? data.scopes : [];
  const metadata = readObject(data.metadata);
  const hasMetaPaidAds =
    provider !== 'meta' ||
    (scopes.includes('ads_management') &&
      Boolean(data.ad_account_id || metadata.selected_meta_ad_account_id));
  const hasGoogleCustomer =
    provider !== 'google_ads' ||
    Boolean(data.ad_account_id || metadata.google_ads_customer_id);
  const hasPinterestBoard =
    provider !== 'pinterest' ||
    Boolean(metadata.selected_pinterest_board_id || metadata.selected_board_id);

  if (!hasMetaPaidAds || !hasGoogleCustomer || !hasPinterestBoard) {
    return {
      key: `provider:${provider}:target`,
      label: `${provider} target`,
      status: 'blocked',
      message: setupBlockerMessage({
        missing: `${provider} account, permission, or target selection`,
        reason: 'provider actions need a selected ad account/page/customer/board before execution',
        next: 'open Provider Setup, select the required account/target, and save settings',
      }),
    };
  }

  if (provider === 'google_ads') {
    const readiness = await getGoogleAdsExecutionReadiness({ workspaceId, userId });

    if (readiness.state !== 'ready') {
      return {
        key: 'provider:google_ads:api-approval',
        label: 'Google Ads API approval',
        status: 'blocked',
        message: setupBlockerMessage({
          missing: 'Google Ads API approval or customer readiness',
          reason: 'Google Ads paid actions require a valid developer token, API approval, OAuth connection, and selected customer',
          next: 'confirm Google Ads API approval and reconnect/select the customer in Provider Setup',
        }),
      };
    }
  }

  return {
    key: `provider:${provider}:oauth`,
    label: `${provider} OAuth`,
    status: 'ready',
    message: `${provider} OAuth state is present without exposing tokens.`,
  };
}

function getProviderEnvChecks(provider: PaidProvider): ProductionCheck[] {
  const names =
    provider === 'pinterest'
      ? [
          process.env.PINTEREST_APP_ID?.trim() || process.env.PINTEREST_CLIENT_ID?.trim()
            ? 'PINTEREST_APP_ID/PINTEREST_CLIENT_ID'
            : 'PINTEREST_APP_ID or PINTEREST_CLIENT_ID',
          ...providerEnvNames.pinterest,
        ]
      : [...providerEnvNames[provider]];

  return names.map((name) => {
    if (name === 'PINTEREST_APP_ID/PINTEREST_CLIENT_ID') {
      return {
        key: 'provider:pinterest:env:id',
        label: name,
        status: 'ready' as const,
        message: 'Pinterest app/client ID is configured server-side.',
      };
    }

    if (name === 'PINTEREST_APP_ID or PINTEREST_CLIENT_ID') {
      return {
        key: 'provider:pinterest:env:id',
        label: name,
        status: 'blocked' as const,
        message: setupBlockerMessage({
          missing: 'PINTEREST_APP_ID or PINTEREST_CLIENT_ID',
          reason: 'Pinterest OAuth cannot start without the app/client id',
          next: 'add the server env in Vercel, redeploy, then reconnect Pinterest',
        }),
      };
    }

    return {
      key: `provider:${provider}:env:${name}`,
      label: name,
      status: isEnvPresent(name) ? ('ready' as const) : ('blocked' as const),
      message: isEnvPresent(name)
        ? `${name} is configured server-side.`
        : setupBlockerMessage({
            missing: name,
            reason: `${provider} provider setup cannot be verified without this server env`,
            next: 'add it in Vercel server environment variables, redeploy, and reconnect the provider if needed',
          }),
    };
  });
}

function addIssuesFromChecks(
  checks: ProductionCheck[],
  blockers: string[],
  warnings: string[]
) {
  for (const check of checks) {
    if (check.status === 'blocked' || check.status === 'not_configured') {
      blockers.push(`${check.label}: ${check.message}`);
    } else if (check.status === 'warning') {
      warnings.push(`${check.label}: ${check.message}`);
    }
  }
}

function calculateScore(checks: ProductionCheck[]) {
  if (checks.length === 0) return 0;

  const total = checks.length * 2;
  const ready = checks.reduce((sum, check) => {
    if (check.status === 'ready') return sum + 2;
    if (check.status === 'warning') return sum + 1;
    return sum;
  }, 0);

  return Math.round((ready / total) * 100);
}

export async function getProductionReadiness({
  supabase,
  workspaceId,
  userId,
  logEvent = false,
  cacheTtlMs = 0,
  forceRefresh = false,
}: {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  userId: string;
  logEvent?: boolean;
  cacheTtlMs?: number;
  forceRefresh?: boolean;
}): Promise<ProductionReadinessResult> {
  const cacheKey = getProductionReadinessCacheKey(workspaceId, userId);
  const cached = productionReadinessCache.get(cacheKey);

  if (!forceRefresh && cacheTtlMs > 0 && cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const [
    integration,
    backupResult,
    n8nCallbackEventsTable,
    securityAuditLogsTable,
    metaConnection,
    googleAdsConnection,
    pinterestConnection,
  ] = await Promise.all([
    loadIntegrationSettings(supabase, workspaceId),
    listBackupRecordsForWorkspace(workspaceId, supabase, 10),
    checkN8nCallbackEventsTable(),
    checkSecurityAuditLogsTable(),
    loadProviderConnectionStatus(workspaceId, userId, 'meta'),
    loadProviderConnectionStatus(workspaceId, userId, 'google_ads'),
    loadProviderConnectionStatus(workspaceId, userId, 'pinterest'),
  ]);
  const spendControls = normalizeSpendControlSettings(
    readObject(integration.settings)[PRODUCTION_OPERATIONS_SETTINGS_KEY]
  );
  const openAI = checkOpenAIContentReadiness();
  const latestBackup = backupResult.data[0] ?? null;
  const latestSuccessfulBackup = backupResult.data.find((backup) => backup.status === 'created') ?? null;

  const env = requiredEnvNames.map(checkEnv);
  const migrations = [
    n8nCallbackEventsTable,
    securityAuditLogsTable,
  ];
  const security: ProductionCheck[] = [
    {
      key: 'security:alex-auth',
      label: 'Alex auth gate',
      status: 'ready',
      message: 'Alex API requires Supabase auth and workspace access before OpenAI.',
    },
    {
      key: 'security:n8n-idempotency',
      label: 'n8n callback idempotency',
      status: migrations[0]?.status === 'ready' ? 'ready' : 'blocked',
      message:
        migrations[0]?.status === 'ready'
          ? 'n8n callback replay protection is available.'
          : 'n8n callback idempotency table is not verified.',
    },
    {
      key: 'security:csp',
      label: 'Production CSP',
      status: 'ready',
      message: 'Production script-src excludes unsafe-eval and inline language script was externalized.',
    },
    checkProductionAuditMarker(),
  ];
  const rateLimitStoreMode = getRateLimitStoreMode();
  const redisAvailable = isRedisAvailable();
  const hasPersistentStore = rateLimitStoreMode === 'upstash' || rateLimitStoreMode === 'redis' || redisAvailable;

  const rateLimits: ProductionCheck[] = [
    {
      key: 'rate-limit:memory',
      label: 'In-memory rate limits',
      status: 'ready',
      message: 'Local/internal abuse limits are active for expensive routes.',
    },
    {
      key: 'rate-limit:persistent',
      label: 'Persistent rate limits',
      status: hasPersistentStore ? 'ready' : 'blocked',
      message: hasPersistentStore
        ? `Persistent rate limit store active (${rateLimitStoreMode}).`
        : setupBlockerMessage({
            missing: 'persistent Redis/Upstash rate limiting',
            reason: 'serverless in-memory limits do not protect full production across instances',
            next: 'set RATE_LIMIT_STORE=upstash with UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or set REDIS_HOST/REDIS_PORT for ioredis',
          }),
    },
    {
      key: 'rate-limit:redis-connection',
      label: 'Redis connection status',
      status: redisAvailable ? 'ready' : (getRateLimitStoreMode() === 'upstash' ? 'warning' : 'blocked'),
      message: redisAvailable
        ? 'Redis client is connected and ready.'
        : getRateLimitStoreMode() === 'upstash'
          ? 'Using Upstash REST (ioredis not required).'
          : setupBlockerMessage({
              missing: 'reachable Redis instance',
              reason: 'persistent sliding window, concurrency, and circuit breaker stores need Redis',
              next: 'verify REDIS_HOST and REDIS_PORT env vars and ensure Redis is reachable',
            }),
    },
  ];
  const providers: ProductionCheck[] = [
    {
      key: 'provider:openai',
      label: 'OpenAI',
      status: openAI.isReady ? 'ready' : 'blocked',
      message: openAI.message,
    },
    ...getProviderEnvChecks('meta'),
    metaConnection,
    ...getProviderEnvChecks('google_ads'),
    googleAdsConnection,
    ...getProviderEnvChecks('pinterest'),
    pinterestConnection,
  ];
  const paidAds: ProductionCheck[] = [
    {
      key: 'paid-ads:enabled',
      label: 'Paid ads enabled',
      status: spendControls.paid_ads_enabled ? 'ready' : 'blocked',
      message: spendControls.paid_ads_enabled
        ? 'Paid ads are enabled by production operations settings.'
        : setupBlockerMessage({
            missing: 'paid_ads_enabled=true',
            reason: 'paid ads must remain off until all production and spend-control gates are green',
            next: 'finish blockers, then enable paid ads from Production Operations',
          }),
    },
    {
      key: 'paid-ads:launch-mode',
      label: 'Launch mode',
      status: spendControls.launch_mode === 'production' ? 'ready' : 'blocked',
      message:
        spendControls.launch_mode === 'production'
          ? 'Launch mode is production.'
          : setupBlockerMessage({
              missing: 'launch_mode=production',
              reason: 'real-client and paid-ads work is blocked until the operator explicitly unlocks production mode',
              next: 'clear all production blockers, then switch launch mode in Production Operations',
            }),
    },
    {
      key: 'paid-ads:manual-confirmation',
      label: 'Manual confirmation',
      status: spendControls.require_manual_confirmation ? 'ready' : 'blocked',
      message: spendControls.require_manual_confirmation
        ? 'Manual confirmation is required for paid ads.'
        : setupBlockerMessage({
            missing: 'require_manual_confirmation=true',
            reason: 'paid ads require a human confirmation before any provider action',
            next: 'enable manual confirmation in Production Operations',
          }),
    },
    {
      key: 'paid-ads:spend-control',
      label: 'Daily spend control',
      status:
        typeof spendControls.max_daily_ad_spend === 'number' &&
        spendControls.max_daily_ad_spend > 0
          ? 'ready'
          : 'blocked',
      message:
        typeof spendControls.max_daily_ad_spend === 'number' &&
        spendControls.max_daily_ad_spend > 0
          ? 'Daily spend limit exists.'
          : setupBlockerMessage({
              missing: 'max_daily_ad_spend',
              reason: 'paid ads cannot be enabled without a daily spend control',
              next: 'set a positive daily spend limit in Production Operations',
            }),
    },
    {
      key: 'paid-ads:allowed-providers',
      label: 'Allowed paid providers',
      status: spendControls.allowed_providers.length > 0 ? 'ready' : 'blocked',
      message:
        spendControls.allowed_providers.length > 0
          ? `Allowed providers: ${spendControls.allowed_providers.join(', ')}.`
          : setupBlockerMessage({
              missing: 'allowed paid ad providers',
              reason: 'paid ads need an explicit provider allowlist',
              next: 'choose allowed providers in Production Operations after their readiness is green',
            }),
    },
  ];
  const backups: ProductionCheck[] = [
    {
      key: 'backup:feature',
      label: 'Backup feature',
      status: 'ready',
      message: 'Backup records feature exists.',
    },
    {
      key: 'backup:latest',
      label: 'Latest successful backup',
      status: latestSuccessfulBackup ? 'ready' : 'blocked',
      message: latestSuccessfulBackup
        ? 'Latest successful backup metadata exists.'
        : latestBackup
          ? setupBlockerMessage({
              missing: 'latest successful backup',
              reason: `the latest backup status is ${latestBackup.status}, so recovery readiness is not proven`,
              next: 'run Backup Center successfully before production unlock',
            })
          : setupBlockerMessage({
              missing: 'latest successful backup',
              reason: 'production unlock requires recoverable workspace metadata',
              next: 'open Backup Center and create a successful backup',
            }),
    },
  ];
  const monitoring: ProductionCheck[] = [
    {
      key: 'monitoring:error-logging',
      label: 'Error logging',
      status: 'ready',
      message: 'Application error logging helpers are present.',
    },
    {
      key: 'monitoring:audit-log',
      label: 'Operational audit logs',
      status: migrations[1]?.status === 'ready' ? 'ready' : 'blocked',
      message:
        migrations[1]?.status === 'ready'
          ? 'security_audit_logs is used for permission and production events.'
          : 'security_audit_logs table is not verified.',
    },
    {
      key: 'monitoring:vercel-logs',
      label: 'Vercel log visibility',
      status: process.env.OPERATIONAL_LOG_VISIBILITY_CONFIRMED === 'true' ? 'ready' : 'blocked',
      message:
        process.env.OPERATIONAL_LOG_VISIBILITY_CONFIRMED === 'true'
          ? 'Deployment/log visibility confirmation marker is present.'
          : setupBlockerMessage({
              missing: 'operational log visibility confirmation',
              reason: 'production incidents need verified access to deployment and runtime logs',
              next: 'confirm Vercel logs/deploy visibility, then set OPERATIONAL_LOG_VISIBILITY_CONFIRMED=true',
            }),
    },
  ];

  const allChecks = [
    ...env,
    ...migrations,
    ...security,
    ...rateLimits,
    ...providers,
    ...paidAds,
    ...backups,
    ...monitoring,
  ];
  const blockers: string[] = [];
  const warnings: string[] = [];

  addIssuesFromChecks(allChecks, blockers, warnings);

  if (integration.error) {
    blockers.push(`Integration settings: ${integration.error}`);
  }

  const providerGreen = providers.every((check) => check.status === 'ready');
  const paidAdsGreen = paidAds.every((check) => check.status === 'ready') && providerGreen;
  const coreSecurityGreen = [...env, ...migrations, ...security].every(
    (check) => check.status === 'ready' || check.status === 'warning'
  );
  const productionGreen = allChecks.every((check) => check.status === 'ready');
  const score = calculateScore(allChecks);
  const overallStatus: ProductionReadinessStatus =
    blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'ready';
  const recommendedActions = [
    ...blockers.slice(0, 8).map((blocker) => `Fix blocker: ${blocker}`),
    ...warnings.slice(0, 4).map((warning) => `Review warning: ${warning}`),
  ];

  const result: ProductionReadinessResult = {
    overallStatus,
    score,
    blockers,
    warnings,
    recommendedActions,
    safeToUseInternally: coreSecurityGreen && migrations.every((check) => check.status === 'ready'),
    safeForRealClients: productionGreen && spendControls.launch_mode === 'production',
    safeForPaidAds: productionGreen && paidAdsGreen,
    checkedAt: new Date().toISOString(),
    env,
    migrations,
    security,
    rateLimits,
    providers,
    paidAds,
    backups,
    monitoring,
    spendControls,
  };

  if (logEvent) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId,
      userId,
      eventType: 'production_readiness_checked',
      severity: result.overallStatus === 'blocked' ? 'warning' : 'info',
      entityType: 'production_readiness',
      message: `Production readiness check completed with ${result.overallStatus}.`,
      metadata: {
        overall_status: result.overallStatus,
        score: result.score,
        blocker_count: result.blockers.length,
        warning_count: result.warnings.length,
        safe_for_real_clients: result.safeForRealClients,
        safe_for_paid_ads: result.safeForPaidAds,
      },
    });
  }

  if (cacheTtlMs > 0) {
    productionReadinessCache.set(cacheKey, {
      expiresAt: Date.now() + cacheTtlMs,
      result,
    });
  }

  return result;
}

function providerLabel(provider: ContentStudioPlatform | PaidProvider) {
  if (provider === 'google_ads') return 'Google Ads';
  if (provider === 'pinterest') return 'Pinterest';
  return 'Meta';
}

export function mapContentTypeToPaidProvider(contentType: string): PaidProvider | null {
  if (contentType === 'google_ads_campaign_draft') return 'google_ads';
  if (
    [
      'facebook_feed_ad',
      'instagram_feed_ad',
      'facebook_reel_ad',
      'instagram_reel_ad',
      'facebook_story_ad',
      'instagram_story_ad',
      'facebook_carousel_ad',
      'instagram_carousel_ad',
    ].includes(contentType)
  ) {
    return 'meta';
  }

  return null;
}

export async function preflightPaidAdsAction(input: PaidAdsPreflightInput): Promise<{
  allowed: boolean;
  message: string;
  readiness: ProductionReadinessResult;
}> {
  const readiness = await getProductionReadiness({
    supabase: input.supabase,
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
  const providerName = providerLabel(input.provider);
  const settings = readiness.spendControls;
  const reasons: string[] = [];
  const limiter = await checkRateLimit({
    key: `provider-paid-action:${input.workspaceId}:${input.userId}:${input.provider}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!limiter.allowed) {
    reasons.push('Provider paid action rate limit reached. عاود المحاولة من بعد.');
  }

  if (input.role !== 'owner' && input.role !== 'admin') {
    reasons.push('Only owner/admin can run paid ads actions. فقط المالك أو المدير يمكنه تنفيذ إعلانات مدفوعة.');
  }

  if (readiness.overallStatus === 'blocked') {
    reasons.push('Production launch gate is blocked. بوابة الإنتاج غير جاهزة.');
  }

  if (!settings.paid_ads_enabled) {
    reasons.push('Paid ads are disabled in production operations settings.');
  }

  if (settings.launch_mode !== 'production') {
    reasons.push(`Launch mode must be production. Current mode: ${settings.launch_mode}.`);
  }

  if (!settings.allowed_providers.includes(input.provider)) {
    reasons.push(`${providerName} is not in allowed paid providers.`);
  }

  if (!settings.max_daily_ad_spend || settings.max_daily_ad_spend <= 0) {
    reasons.push('Daily spend control is missing.');
  }

  if (settings.require_manual_confirmation && !input.explicitConfirmation) {
    reasons.push('Explicit manual confirmation is required. التأكيد اليدوي مطلوب.');
  }

  const providerChecks = readiness.providers.filter((check) =>
    check.key.startsWith(`provider:${input.provider}:`)
  );

  if (providerChecks.some((check) => check.status !== 'ready')) {
    reasons.push(`${providerName} readiness is not green.`);
  }

  if (reasons.length > 0) {
    const message = `Paid ads action blocked: ${reasons.join(' ')}`;

    await logSecurityAuditEvent({
      supabase: input.supabase,
      workspaceId: input.workspaceId,
      userId: input.userId,
      eventType: 'paid_ads_action_blocked',
      severity: 'warning',
      entityType: 'provider_action',
      message,
      metadata: {
        provider: input.provider,
        action: input.actionLabel,
        role: input.role,
        reason_count: reasons.length,
      },
    });

    return { allowed: false, message, readiness };
  }

  await logSecurityAuditEvent({
    supabase: input.supabase,
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventType: 'paid_ads_action_preflight_passed',
    severity: 'info',
    entityType: 'provider_action',
    message: `${providerName} paid ads preflight passed.`,
    metadata: {
      provider: input.provider,
      action: input.actionLabel,
      role: input.role,
    } satisfies JsonObject,
  });

  return {
    allowed: true,
    message: `${providerName} paid ads preflight passed.`,
    readiness,
  };
}

export function buildProductionOperationsSettingsPatch(
  settings: SpendControlSettings
): Record<string, JsonValue> {
  return {
    [PRODUCTION_OPERATIONS_SETTINGS_KEY]: serializeSpendControlSettings(settings),
  };
}
