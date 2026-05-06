import 'server-only';

const GOOGLE_ADS_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';

export type GoogleAdsConfigStatus =
  | 'configured'
  | 'missing_client_id'
  | 'missing_client_secret'
  | 'missing_developer_token'
  | 'missing_redirect_uri';

export type GoogleAdsRequiredEnvVar =
  | 'GOOGLE_ADS_CLIENT_ID'
  | 'GOOGLE_ADS_CLIENT_SECRET'
  | 'GOOGLE_ADS_DEVELOPER_TOKEN'
  | 'GOOGLE_ADS_REDIRECT_URI';

export interface GoogleAdsConfigReadiness {
  status: GoogleAdsConfigStatus;
  isConfigured: boolean;
  missingEnvironmentVariables: GoogleAdsRequiredEnvVar[];
}

interface GoogleAdsEnv {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  redirectUri: string;
  loginCustomerId: string | null;
  apiVersion: string | null;
}

export class GoogleAdsConfigError extends Error {
  readonly status: GoogleAdsConfigStatus;
  readonly missingEnvironmentVariables: GoogleAdsRequiredEnvVar[];

  constructor(
    status: GoogleAdsConfigStatus,
    missingEnvironmentVariables: GoogleAdsRequiredEnvVar[]
  ) {
    super('Google Ads OAuth environment variables are not fully configured.');
    this.name = 'GoogleAdsConfigError';
    this.status = status;
    this.missingEnvironmentVariables = missingEnvironmentVariables;
  }
}

function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('Google Ads helpers can only run on the server.');
  }
}

function getTrimmedEnv(name: string) {
  return process.env[name]?.trim() ?? '';
}

function getMissingGoogleAdsEnvVars(): GoogleAdsRequiredEnvVar[] {
  const missing: GoogleAdsRequiredEnvVar[] = [];

  if (!getTrimmedEnv('GOOGLE_ADS_CLIENT_ID')) {
    missing.push('GOOGLE_ADS_CLIENT_ID');
  }

  if (!getTrimmedEnv('GOOGLE_ADS_CLIENT_SECRET')) {
    missing.push('GOOGLE_ADS_CLIENT_SECRET');
  }

  if (!getTrimmedEnv('GOOGLE_ADS_DEVELOPER_TOKEN')) {
    missing.push('GOOGLE_ADS_DEVELOPER_TOKEN');
  }

  if (!getTrimmedEnv('GOOGLE_ADS_REDIRECT_URI')) {
    missing.push('GOOGLE_ADS_REDIRECT_URI');
  }

  return missing;
}

function getStatusFromMissingEnv(
  missingEnvironmentVariables: GoogleAdsRequiredEnvVar[]
): GoogleAdsConfigStatus {
  if (missingEnvironmentVariables.includes('GOOGLE_ADS_CLIENT_ID')) {
    return 'missing_client_id';
  }

  if (missingEnvironmentVariables.includes('GOOGLE_ADS_CLIENT_SECRET')) {
    return 'missing_client_secret';
  }

  if (missingEnvironmentVariables.includes('GOOGLE_ADS_DEVELOPER_TOKEN')) {
    return 'missing_developer_token';
  }

  if (missingEnvironmentVariables.includes('GOOGLE_ADS_REDIRECT_URI')) {
    return 'missing_redirect_uri';
  }

  return 'configured';
}

function getGoogleAdsEnv(): GoogleAdsEnv {
  assertServerOnly();

  const missingEnvironmentVariables = getMissingGoogleAdsEnvVars();
  const status = getStatusFromMissingEnv(missingEnvironmentVariables);

  if (status !== 'configured') {
    throw new GoogleAdsConfigError(status, missingEnvironmentVariables);
  }

  return {
    clientId: getTrimmedEnv('GOOGLE_ADS_CLIENT_ID'),
    clientSecret: getTrimmedEnv('GOOGLE_ADS_CLIENT_SECRET'),
    developerToken: getTrimmedEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
    redirectUri: getTrimmedEnv('GOOGLE_ADS_REDIRECT_URI'),
    loginCustomerId: getTrimmedEnv('GOOGLE_ADS_LOGIN_CUSTOMER_ID') || null,
    apiVersion: getTrimmedEnv('GOOGLE_ADS_API_VERSION') || null,
  };
}

export function getGoogleAdsConfigReadiness(): GoogleAdsConfigReadiness {
  assertServerOnly();

  const missingEnvironmentVariables = getMissingGoogleAdsEnvVars();
  const status = getStatusFromMissingEnv(missingEnvironmentVariables);

  return {
    status,
    isConfigured: status === 'configured',
    missingEnvironmentVariables,
  };
}

export function buildGoogleAdsOAuthUrl({ state }: { state: string }) {
  const env = getGoogleAdsEnv();
  const url = new URL(GOOGLE_ADS_OAUTH_URL);

  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_ADS_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  return url;
}
