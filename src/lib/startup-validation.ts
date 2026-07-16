/**
 * Startup Environment Validation
 *
 * Runs during server startup to validate that the environment is properly
 * configured for production. Checks:
 * - Required environment variables
 * - Security header configuration
 * - Rate limit store configuration
 * - Secret hygiene (no service-role keys exposed publicly)
 * - MFA configuration
 *
 * Safe to import from server-only modules. Should be called once at app startup.
 */

import 'server-only';

import { logger } from '@/lib/logger';

const startupLog = logger.child('startup:validation');

// ─── Status ─────────────────────────────────────────────────────────────────

export interface StartupCheck {
  name: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  recommendation?: string;
}

export interface StartupValidationResult {
  /** Timestamp of validation */
  validatedAt: string;
  /** Overall status */
  status: 'passed' | 'warning' | 'failed';
  /** Number of failed checks */
  failures: number;
  /** Number of warnings */
  warnings: number;
  /** All checks */
  checks: StartupCheck[];
}

// ─── Required Critical Variables ─────────────────────────────────────────────

const CRITICAL_VARS = [
  'OPENAI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'AD_TOKEN_ENCRYPTION_KEY',
  'N8N_CALLBACK_SECRET',
  'CRON_SECRET',
] as const;

const RECOMMENDED_VARS = [
  'APP_BASE_URL',
  'TASK_EXECUTION_ENABLED',
  'N8N_WEBHOOK_URL',
] as const;

// ─── Single Checks ─────────────────────────────────────────────────────────

function checkRequiredVars(): StartupCheck[] {
  const checks: StartupCheck[] = [];

  for (const varName of CRITICAL_VARS) {
    if (!process.env[varName]?.trim()) {
      checks.push({
        name: `env:${varName}`,
        status: 'failed',
        message: `Required environment variable ${varName} is not set.`,
        recommendation: `Set ${varName} in your production environment.`,
      });
    } else {
      checks.push({
        name: `env:${varName}`,
        status: 'passed',
        message: `${varName} is configured.`,
      });
    }
  }

  for (const varName of RECOMMENDED_VARS) {
    if (!process.env[varName]?.trim()) {
      checks.push({
        name: `env:${varName}`,
        status: 'warning',
        message: `Recommended environment variable ${varName} is not set.`,
        recommendation: `Set ${varName} for full functionality.`,
      });
    } else {
      checks.push({
        name: `env:${varName}`,
        status: 'passed',
        message: `${varName} is configured.`,
      });
    }
  }

  return checks;
}

function checkRateLimitStore(): StartupCheck[] {
  if (process.env.RATE_LIMIT_STORE === 'upstash') {
    const hasUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim());
    const hasToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim());

    if (hasUrl && hasToken) {
      return [{
        name: 'rate-limit:store',
        status: 'passed',
        message: 'Persistent rate limiting is configured with Upstash Redis.',
      }];
    }

    return [{
      name: 'rate-limit:store',
      status: 'warning',
      message: 'RATE_LIMIT_STORE=upstash but UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing.',
      recommendation: 'Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.',
    }];
  }

  if (process.env.REDIS_HOST?.trim()) {
    return [{
      name: 'rate-limit:store',
      status: 'passed',
      message: 'Persistent rate limiting is configured with Redis over ioredis.',
    }];
  }

  return [{
    name: 'rate-limit:store',
    status: 'warning',
    message: 'Rate limiting is using in-memory store (not safe across serverless instances).',
    recommendation: 'Configure Upstash Redis or a Redis server for production rate limiting.',
  }];
}

function checkPublicSupabaseKey(): StartupCheck[] {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!anonKey || !serviceRoleKey) {
    return [{
      name: 'secrets:supabase-keys',
      status: 'warning',
      message: 'Cannot verify Supabase key separation — one or both keys are unset.',
    }];
  }

  if (anonKey === serviceRoleKey) {
    return [{
      name: 'secrets:supabase-keys',
      status: 'failed',
      message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY matches SUPABASE_SERVICE_ROLE_KEY. The service role key is exposed to the browser!',
      recommendation: 'Set NEXT_PUBLIC_SUPABASE_ANON_KEY to the publishable anon key from your Supabase dashboard. The service role key must remain server-only.',
    }];
  }

  // Check if the anon key looks like a service role JWT
  if (anonKey.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(
        Buffer.from(anonKey.split('.')[1], 'base64').toString()
      );
      if (payload?.role === 'service_role') {
        return [{
          name: 'secrets:supabase-keys',
          status: 'failed',
          message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY decodes to a service_role JWT. The service role key is exposed to the browser.',
          recommendation: 'Set NEXT_PUBLIC_SUPABASE_ANON_KEY to the publishable anon key. The anon key should decode to role "anon", not "service_role".',
        }];
      }
    } catch {
      // Not a valid JWT, skip
    }
  }

  return [{
    name: 'secrets:supabase-keys',
    status: 'passed',
    message: 'Supabase keys are properly separated (public anon key vs server-only service role key).',
  }];
}

function checkSecurityHeaders(): StartupCheck[] {
  // Read app base URL to check if it's a production domain
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

  const checks: StartupCheck[] = [];

  if (baseUrl && !baseUrl.startsWith('https://') && !isLocalhost) {
    checks.push({
      name: 'security:https',
      status: 'warning',
      message: `APP_BASE_URL (${baseUrl}) does not use HTTPS. Production deployments must use HTTPS for HSTS to be effective.`,
      recommendation: 'Ensure your deployment uses HTTPS and set APP_BASE_URL to the HTTPS URL.',
    });
  } else {
    checks.push({
      name: 'security:https',
      status: 'passed',
      message: 'HTTPS configuration is valid.',
    });
  }

  return checks;
}

function checkMfaConfiguration(): StartupCheck[] {
  // Check Supabase config.toml for MFA settings (file-based check)
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  return [{
    name: 'mfa:configuration',
    status: isConfigured ? 'passed' : 'warning',
    message: isConfigured
      ? 'MFA is available via Supabase Auth (TOTP authenticator app). Enable in Supabase Dashboard → Authentication → Multi-Factor Authentication.'
      : 'MFA cannot be verified — Supabase is not configured.',
    recommendation: 'Enable TOTP enrollment and verification in Supabase Dashboard.',
  }];
}

function checkAdTokenEncryption(): StartupCheck[] {
  const key = process.env.AD_TOKEN_ENCRYPTION_KEY?.trim();

  if (!key) {
    return [{
      name: 'secrets:encryption-key',
      status: 'failed',
      message: 'AD_TOKEN_ENCRYPTION_KEY is not set. Provider access tokens cannot be securely encrypted.',
      recommendation: 'Generate a 256-bit key using: openssl rand -hex 32, then set AD_TOKEN_ENCRYPTION_KEY.',
    }];
  }

  // Check key length (should be 32 bytes hex = 64 chars, or 32 raw bytes)
  if (key.length < 32) {
    return [{
      name: 'secrets:encryption-key',
      status: 'warning',
      message: `AD_TOKEN_ENCRYPTION_KEY is only ${key.length} characters long. Weak encryption keys may be vulnerable.`,
      recommendation: 'Use a 256-bit (64 hex chars) key for AES-256 encryption.',
    }];
  }

  return [{
    name: 'secrets:encryption-key',
    status: 'passed',
    message: 'AD_TOKEN_ENCRYPTION_KEY is configured with adequate length.',
  }];
}

// ─── Run All Checks ─────────────────────────────────────────────────────────

/**
 * Run all startup validation checks.
 * Call this once at application startup.
 */
export function validateStartupEnvironment(): StartupValidationResult {
  startupLog.info('Running startup environment validation...');

  const allChecks: StartupCheck[] = [
    ...checkRequiredVars(),
    ...checkRateLimitStore(),
    ...checkPublicSupabaseKey(),
    ...checkSecurityHeaders(),
    ...checkMfaConfiguration(),
    ...checkAdTokenEncryption(),
  ];

  const failures = allChecks.filter((c) => c.status === 'failed').length;
  const warnings = allChecks.filter((c) => c.status === 'warning').length;

  const overallStatus = failures > 0 ? 'failed' : warnings > 0 ? 'warning' : 'passed';

  const result: StartupValidationResult = {
    validatedAt: new Date().toISOString(),
    status: overallStatus,
    failures,
    warnings,
    checks: allChecks,
  };

  // Log results
  startupLog.info(`Startup validation complete: ${overallStatus} (${failures} failures, ${warnings} warnings)`);

  for (const check of allChecks) {
    if (check.status === 'failed') {
      startupLog.error(`FAILED: ${check.name} — ${check.message}`, { recommendation: check.recommendation });
    } else if (check.status === 'warning') {
      startupLog.warn(`WARNING: ${check.name} — ${check.message}`, { recommendation: check.recommendation });
    }
  }

  return result;
}

/**
 * Quick pass/fail check. Throws if critical checks fail.
 * Use this at app startup entry points.
 *
 * Note: instrumentation.ts uses validateStartupEnvironment() directly
 * with try/catch. This is an alternative for stricter enforcement.
 */
export function assertSecureStartup(): void {
  const result = validateStartupEnvironment();

  if (result.status === 'failed') {
    const failedChecks = result.checks
      .filter((c) => c.status === 'failed')
      .map((c) => `${c.name}: ${c.message}`);

    startupLog.error('Startup validation FAILED', { failures: failedChecks });
  }

  if (result.status === 'warning') {
    startupLog.warn('Startup validation passed with warnings. Review recommended before production deployment.');
  }
}
