/**
 * Secrets Scanning Utility
 *
 * Runtime secrets scanner that checks for:
 * - Public environment variables that look like secrets
 * - Hardcoded credential patterns in source files
 * - Misconfigured Supabase keys
 * - Exposed tokens in server-side code paths
 *
 * Safe to import from server-only modules.
 */

import 'server-only';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SecretFinding {
  /** Severity of the finding */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Category of the finding */
  category: 'env_var' | 'hardcoded_secret' | 'misconfiguration' | 'token_exposure';
  /** Description of what was found */
  description: string;
  /** The source file or env var name */
  source: string;
  /** Recommendation for fixing */
  recommendation: string;
}

export interface SecretsScanResult {
  /** Whether the scan passed (no critical/high findings) */
  passed: boolean;
  /** Timestamp of the scan */
  scannedAt: string;
  /** All findings */
  findings: SecretFinding[];
  /** Count by severity */
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// ─── Known secret-like environment variable patterns ────────────────────────

/**
 * Environment variables that should NEVER be exposed via NEXT_PUBLIC_ prefix.
 */
export const FORBIDDEN_PUBLIC_PREFIXES = [
  'SECRET',
  'TOKEN',
  'SERVICE_ROLE',
  'PRIVATE',
  'KEY',
  'PASSWORD',
  'CREDENTIALS',
] as const;



/**
 * Scan environment variables for potential secrets exposure.
 */
export function scanEnvVars(): SecretFinding[] {
  const findings: SecretFinding[] = [];

  // Check for NEXT_PUBLIC_ variables that look like secrets
  for (const [key, value] of Object.entries(process.env)) {
    if (!key || !value) continue;

    // Check if a public var looks like a secret
    if (key.startsWith('NEXT_PUBLIC_')) {
      const suffix = key.replace('NEXT_PUBLIC_', '');
      const hasForbiddenSuffix = FORBIDDEN_PUBLIC_PREFIXES.some(
        (prefix) => suffix.includes(prefix)
      );

      if (hasForbiddenSuffix) {
        findings.push({
          severity: 'critical',
          category: 'env_var',
          description: `Environment variable ${key} has a NEXT_PUBLIC_ prefix but contains "${suffix}" in its name, suggesting it may be a secret exposed to the browser`,
          source: key,
          recommendation: `Rename to remove the NEXT_PUBLIC_ prefix or ensure it's the public/non-secret variant. Never expose service-role keys, API secrets, or tokens via NEXT_PUBLIC_.`,
        });
      }

      // Check the actual value for secret-like patterns
      if (value.startsWith('sk-') && !key.includes('NEXT_PUBLIC_OPENAI')) {
        // If a NEXT_PUBLIC_ variable starts with sk-, it might be an API key
        findings.push({
          severity: 'critical',
          category: 'env_var',
          description: `Variable ${key} starts with "sk-" (typical API key prefix) but is exposed via NEXT_PUBLIC_ prefix`,
          source: key,
          recommendation: 'Move this to a non-public environment variable. API keys must never be exposed to the browser.',
        });
      }

      if (value.startsWith('sb_secret_')) {
        findings.push({
          severity: 'critical',
          category: 'env_var',
          description: `Variable ${key} uses "sb_secret_" prefix which is a Supabase secret key, exposed via NEXT_PUBLIC_`,
          source: key,
          recommendation: 'Use the Supabase anon key (sb_publishable_) instead of the secret key for NEXT_PUBLIC_ variables.',
        });
      }
    }

    // Check service-role keys are not accidentally used as public
    if (key === 'SUPABASE_SERVICE_ROLE_KEY' && value.startsWith('eyJ')) {
      // This is fine server-side, just verify it's not duplicated as NEXT_PUBLIC
      const publicVar = `NEXT_PUBLIC_${key}`;
      if (process.env[publicVar] === value) {
        findings.push({
          severity: 'critical',
          category: 'misconfiguration',
          description: `SUPABASE_SERVICE_ROLE_KEY value matches NEXT_PUBLIC_SUPABASE_ANON_KEY — the service role key is likely being used as the public anon key`,
          source: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          recommendation: 'Set NEXT_PUBLIC_SUPABASE_ANON_KEY to the publishable anon key from your Supabase dashboard, not the service role key.',
        });
      }
    }
  }

  // Check for missing critical env vars
  const criticalVars = [
    'AD_TOKEN_ENCRYPTION_KEY',
    'N8N_CALLBACK_SECRET',
    'CRON_SECRET',
  ];

  for (const varName of criticalVars) {
    if (!process.env[varName]?.trim()) {
      findings.push({
        severity: 'high',
        category: 'env_var',
        description: `Critical secret environment variable ${varName} is not set`,
        source: varName,
        recommendation: `Set ${varName} in your production environment (Vercel dashboard or .env.local for local dev).`,
      });
    }
  }

  return findings;
}

// ─── Check for hardcoded credential patterns ────────────────────────────────

/**
 * Patterns that indicate hardcoded credentials in source code.
 */
const HARDCODED_CREDENTIAL_PATTERNS = [
  {
    pattern: /(['\"])sk-[A-Za-z0-9]{20,}\1/g,
    severity: 'critical' as const,
    description: 'Hardcoded OpenAI API key (sk-... pattern)',
    recommendation: 'Move API keys to environment variables. Never commit API keys to source control.',
  },
  {
    pattern: /(['\"])eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\1/g,
    severity: 'critical' as const,
    description: 'Hardcoded JWT token (eyJ... pattern)',
    recommendation: 'Move tokens to environment variables or secure credential storage.',
  },
  {
    pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g,
    severity: 'high' as const,
    description: 'Hardcoded GitHub personal access token',
    recommendation: 'Use GitHub Actions secrets or environment variables for GitHub tokens.',
  },
  {
    pattern: /(?:AKIA|ASIA)[A-Z0-9]{16,}/g,
    severity: 'high' as const,
    description: 'Hardcoded AWS access key ID',
    recommendation: 'Use AWS IAM roles or environment variables for AWS credentials.',
  },
  {
    pattern: /(?:sk_live_|pk_live_|rk_live_)[A-Za-z0-9]{20,}/g,
    severity: 'high' as const,
    description: 'Hardcoded live Stripe key',
    recommendation: 'Use environment variables for Stripe keys. Live keys should never be in source code.',
  },
  {
    pattern: /(?:xoxb-|xoxp-|xapp-)[A-Za-z0-9_-]{10,}/g,
    severity: 'medium' as const,
    description: 'Hardcoded Slack token',
    recommendation: 'Use environment variables or Slack app credentials for tokens.',
  },
  {
    pattern: /process\.env\.NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|SERVICE_ROLE|PRIVATE_KEY|PASSWORD)[A-Z0-9_]*/g,
    severity: 'critical' as const,
    description: 'Accessing a secret-like environment variable through NEXT_PUBLIC_ prefix',
    recommendation: 'This variable is exposed to the browser. Use a non-public environment variable for secrets.',
  },
];

/**
 * Scan a source string for hardcoded credentials.
 */
export function scanSourceForSecrets(
  source: string,
  sourceName: string
): SecretFinding[] {
  const findings: SecretFinding[] = [];

  for (const check of HARDCODED_CREDENTIAL_PATTERNS) {
    check.pattern.lastIndex = 0;
    if (check.pattern.test(source)) {
      findings.push({
        severity: check.severity,
        category: 'hardcoded_secret',
        description: `${check.description} in ${sourceName}`,
        source: sourceName,
        recommendation: check.recommendation,
      });
    }
  }

  return findings;
}

// ─── Check logging for token exposure ───────────────────────────────────────

/**
 * Check if the logger or console statements might leak sensitive data.
 */
const TOKEN_LOGGING_PATTERNS = [
  {
    pattern: /console\.(?:log|info|debug|warn|error)\([^)]*(?:access_token|refresh_token|client_secret|api_key|authorization|password|secret)/gi,
    severity: 'high' as const,
    description: 'Console statement may log sensitive credential data',
    recommendation: 'Use the structured logger with built-in redaction instead of console.log for debugging.',
  },
] as const;

export function scanForLoggingLeaks(
  source: string,
  sourceName: string
): SecretFinding[] {
  const findings: SecretFinding[] = [];

  for (const check of TOKEN_LOGGING_PATTERNS) {
    check.pattern.lastIndex = 0;
    if (check.pattern.test(source)) {
      findings.push({
        severity: check.severity,
        category: 'token_exposure',
        description: `${check.description} in ${sourceName}`,
        source: sourceName,
        recommendation: check.recommendation,
      });
    }
  }

  return findings;
}

// ─── Run full scan ──────────────────────────────────────────────────────────

/**
 * Run a comprehensive secrets scan across environment variables.
 * For source code scanning, use scanSourceForSecrets() per file.
 */
export function runSecretsScan(): SecretsScanResult {
  const findings: SecretFinding[] = [
    ...scanEnvVars(),
  ];

  const counts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
  };

  return {
    passed: counts.critical === 0 && counts.high === 0,
    scannedAt: new Date().toISOString(),
    findings,
    counts,
  };
}

/**
 * Generate a human-readable report from scan results.
 */
export function formatSecretsScanReport(result: SecretsScanResult): string {
  const lines: string[] = [
    '# Secrets Scan Report',
    '',
    `Scanned at: ${result.scannedAt}`,
    `Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`,
    '',
    '## Summary',
    `Critical: ${result.counts.critical}`,
    `High: ${result.counts.high}`,
    `Medium: ${result.counts.medium}`,
    `Low: ${result.counts.low}`,
    '',
  ];

  if (result.findings.length > 0) {
    lines.push('## Findings');
    for (const finding of result.findings) {
      lines.push(`### ${finding.severity.toUpperCase()}: ${finding.description}`);
      lines.push(`- **Source:** ${finding.source}`);
      lines.push(`- **Category:** ${finding.category}`);
      lines.push(`- **Recommendation:** ${finding.recommendation}`);
      lines.push('');
    }
  } else {
    lines.push('No secrets-related findings detected.');
  }

  lines.push('## Notes');
  lines.push('- Secret values are never displayed or logged by this scanner.');
  lines.push('- This scan checks environment variables and known patterns only.');
  lines.push('- For a full audit, run `node scripts/security-audit.mjs`.');

  return lines.join('\n');
}
