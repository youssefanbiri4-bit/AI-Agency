import 'server-only';

const LINKEDIN_OAUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_READ_ONLY_SCOPES = ['r_ads', 'r_ads_reporting'] as const;

export type LinkedInConfigStatus =
  | 'configured'
  | 'missing_client_id'
  | 'missing_client_secret'
  | 'missing_redirect_uri';

export type LinkedInRequiredEnvVar =
  | 'LINKEDIN_CLIENT_ID'
  | 'LINKEDIN_CLIENT_SECRET'
  | 'LINKEDIN_REDIRECT_URI';

export interface LinkedInConfigReadiness {
  status: LinkedInConfigStatus;
  isConfigured: boolean;
  missingEnvironmentVariables: LinkedInRequiredEnvVar[];
  scopes: readonly string[];
}

interface LinkedInEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiVersion: string | null;
}

export class LinkedInConfigError extends Error {
  readonly status: LinkedInConfigStatus;
  readonly missingEnvironmentVariables: LinkedInRequiredEnvVar[];

  constructor(
    status: LinkedInConfigStatus,
    missingEnvironmentVariables: LinkedInRequiredEnvVar[]
  ) {
    super('LinkedIn Ads OAuth environment variables are not fully configured.');
    this.name = 'LinkedInConfigError';
    this.status = status;
    this.missingEnvironmentVariables = missingEnvironmentVariables;
  }
}

function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('LinkedIn Ads helpers can only run on the server.');
  }
}

function getTrimmedEnv(name: string) {
  return process.env[name]?.trim() ?? '';
}

function getMissingLinkedInEnvVars(): LinkedInRequiredEnvVar[] {
  const missing: LinkedInRequiredEnvVar[] = [];

  if (!getTrimmedEnv('LINKEDIN_CLIENT_ID')) {
    missing.push('LINKEDIN_CLIENT_ID');
  }

  if (!getTrimmedEnv('LINKEDIN_CLIENT_SECRET')) {
    missing.push('LINKEDIN_CLIENT_SECRET');
  }

  if (!getTrimmedEnv('LINKEDIN_REDIRECT_URI')) {
    missing.push('LINKEDIN_REDIRECT_URI');
  }

  return missing;
}

function getStatusFromMissingEnv(
  missingEnvironmentVariables: LinkedInRequiredEnvVar[]
): LinkedInConfigStatus {
  if (missingEnvironmentVariables.includes('LINKEDIN_CLIENT_ID')) {
    return 'missing_client_id';
  }

  if (missingEnvironmentVariables.includes('LINKEDIN_CLIENT_SECRET')) {
    return 'missing_client_secret';
  }

  if (missingEnvironmentVariables.includes('LINKEDIN_REDIRECT_URI')) {
    return 'missing_redirect_uri';
  }

  return 'configured';
}

function getLinkedInEnv(): LinkedInEnv {
  assertServerOnly();

  const missingEnvironmentVariables = getMissingLinkedInEnvVars();
  const status = getStatusFromMissingEnv(missingEnvironmentVariables);

  if (status !== 'configured') {
    throw new LinkedInConfigError(status, missingEnvironmentVariables);
  }

  return {
    clientId: getTrimmedEnv('LINKEDIN_CLIENT_ID'),
    clientSecret: getTrimmedEnv('LINKEDIN_CLIENT_SECRET'),
    redirectUri: getTrimmedEnv('LINKEDIN_REDIRECT_URI'),
    apiVersion: getTrimmedEnv('LINKEDIN_API_VERSION') || null,
  };
}

export function getLinkedInConfigReadiness(): LinkedInConfigReadiness {
  assertServerOnly();

  const missingEnvironmentVariables = getMissingLinkedInEnvVars();
  const status = getStatusFromMissingEnv(missingEnvironmentVariables);

  return {
    status,
    isConfigured: status === 'configured',
    missingEnvironmentVariables,
    scopes: LINKEDIN_READ_ONLY_SCOPES,
  };
}

export function buildLinkedInOAuthUrl({ state }: { state: string }) {
  const env = getLinkedInEnv();
  const url = new URL(LINKEDIN_OAUTH_URL);

  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('scope', LINKEDIN_READ_ONLY_SCOPES.join(' '));
  url.searchParams.set('state', state);

  return url;
}
