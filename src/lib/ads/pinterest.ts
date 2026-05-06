const DEFAULT_PINTEREST_API_VERSION = 'v5';
const PINTEREST_OAUTH_URL = 'https://www.pinterest.com/oauth/';
const PINTEREST_READ_ONLY_SCOPES = ['ads:read', 'user_accounts:read'] as const;

export type PinterestConfigStatus =
  | 'configured'
  | 'missing_app_id'
  | 'missing_app_secret'
  | 'missing_redirect_uri';

export type PinterestRequiredEnvVar =
  | 'PINTEREST_APP_ID'
  | 'PINTEREST_APP_SECRET'
  | 'PINTEREST_REDIRECT_URI';

export interface PinterestConfigReadiness {
  status: PinterestConfigStatus;
  isConfigured: boolean;
  missingEnvironmentVariables: PinterestRequiredEnvVar[];
  scopes: readonly string[];
}

interface PinterestEnv {
  appId: string;
  appSecret: string;
  redirectUri: string;
  apiVersion: string;
}

export class PinterestConfigError extends Error {
  readonly status: PinterestConfigStatus;
  readonly missingEnvironmentVariables: PinterestRequiredEnvVar[];

  constructor(
    status: PinterestConfigStatus,
    missingEnvironmentVariables: PinterestRequiredEnvVar[]
  ) {
    super('Pinterest Ads OAuth environment variables are not fully configured.');
    this.name = 'PinterestConfigError';
    this.status = status;
    this.missingEnvironmentVariables = missingEnvironmentVariables;
  }
}

function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('Pinterest Ads helpers can only run on the server.');
  }
}

function getMissingPinterestEnvVars(): PinterestRequiredEnvVar[] {
  const missing: PinterestRequiredEnvVar[] = [];

  if (!process.env.PINTEREST_APP_ID?.trim()) {
    missing.push('PINTEREST_APP_ID');
  }

  if (!process.env.PINTEREST_APP_SECRET?.trim()) {
    missing.push('PINTEREST_APP_SECRET');
  }

  if (!process.env.PINTEREST_REDIRECT_URI?.trim()) {
    missing.push('PINTEREST_REDIRECT_URI');
  }

  return missing;
}

function getStatusFromMissingEnv(
  missingEnvironmentVariables: PinterestRequiredEnvVar[]
): PinterestConfigStatus {
  if (missingEnvironmentVariables.includes('PINTEREST_APP_ID')) {
    return 'missing_app_id';
  }

  if (missingEnvironmentVariables.includes('PINTEREST_APP_SECRET')) {
    return 'missing_app_secret';
  }

  if (missingEnvironmentVariables.includes('PINTEREST_REDIRECT_URI')) {
    return 'missing_redirect_uri';
  }

  return 'configured';
}

function getPinterestEnv(): PinterestEnv {
  assertServerOnly();

  const missingEnvironmentVariables = getMissingPinterestEnvVars();
  const status = getStatusFromMissingEnv(missingEnvironmentVariables);

  if (status !== 'configured') {
    throw new PinterestConfigError(status, missingEnvironmentVariables);
  }

  return {
    appId: process.env.PINTEREST_APP_ID?.trim() ?? '',
    appSecret: process.env.PINTEREST_APP_SECRET?.trim() ?? '',
    redirectUri: process.env.PINTEREST_REDIRECT_URI?.trim() ?? '',
    apiVersion:
      process.env.PINTEREST_API_VERSION?.trim() || DEFAULT_PINTEREST_API_VERSION,
  };
}

export function getPinterestConfigReadiness(): PinterestConfigReadiness {
  assertServerOnly();

  const missingEnvironmentVariables = getMissingPinterestEnvVars();
  const status = getStatusFromMissingEnv(missingEnvironmentVariables);

  return {
    status,
    isConfigured: status === 'configured',
    missingEnvironmentVariables,
    scopes: PINTEREST_READ_ONLY_SCOPES,
  };
}

export function buildPinterestOAuthUrl({ state }: { state: string }) {
  const env = getPinterestEnv();
  const url = new URL(PINTEREST_OAUTH_URL);

  url.searchParams.set('client_id', env.appId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', PINTEREST_READ_ONLY_SCOPES.join(','));
  url.searchParams.set('state', state);

  return url;
}
