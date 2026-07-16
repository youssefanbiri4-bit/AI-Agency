import type { JsonObject } from './index';

export type SSOProviderType = 'google_workspace' | 'microsoft_entra' | 'okta';

export type DomainStatus = 'pending' | 'verifying' | 'verified' | 'failed' | 'removed';

export interface WhiteLabelColors extends JsonObject {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  sidebar: string;
  header: string;
}

export interface WhiteLabelConfig extends JsonObject {
  enabled: boolean;
  companyName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  logoStoragePath: string | null;
  logoAltText: string | null;
  faviconUrl: string | null;
  faviconStoragePath: string | null;
  colors: WhiteLabelColors;
  hideAgentFlowBranding: boolean;
  customCss: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CustomDomain extends JsonObject {
  id: string;
  domain: string;
  status: DomainStatus;
  verifiedAt: string | null;
  cnameTarget: string;
  dnsRecords: DomainDnsRecord[];
  lastCheckedAt: string | null;
  errorMessage: string | null;
  createdAt: string | null;
}

export interface DomainDnsRecord extends JsonObject {
  type: string;
  host: string;
  value: string;
  required: boolean;
}

export interface SSOProviderConfig extends JsonObject {
  type: SSOProviderType;
  enabled: boolean;
  clientId: string | null;
  tenantId: string | null;
  domain: string | null;
  issuerUrl: string | null;
  callbackUrl: string | null;
  allowSignUp: boolean;
  domains: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WorkspaceBrandingSettings extends JsonObject {
  whiteLabel: WhiteLabelConfig;
  customDomains: CustomDomain[];
  ssoProviders: SSOProviderConfig[];
  updatedAt: string | null;
}

export const DEFAULT_WHITE_LABEL_COLORS: WhiteLabelColors = {
  primary: '#CA2851',
  secondary: '#FF6766',
  accent: '#FFB173',
  background: '#FFFFFF',
  text: '#171717',
  sidebar: '#F8F9FA',
  header: '#FFFFFF',
};

export const defaultWhiteLabelConfig: WhiteLabelConfig = {
  enabled: false,
  companyName: null,
  tagline: null,
  logoUrl: null,
  logoStoragePath: null,
  logoAltText: null,
  faviconUrl: null,
  faviconStoragePath: null,
  colors: { ...DEFAULT_WHITE_LABEL_COLORS },
  hideAgentFlowBranding: false,
  customCss: null,
  updatedAt: null,
  updatedBy: null,
};

export const defaultSSOProviderConfig: SSOProviderConfig = {
  type: 'google_workspace',
  enabled: false,
  clientId: null,
  tenantId: null,
  domain: null,
  issuerUrl: null,
  callbackUrl: null,
  allowSignUp: true,
  domains: [],
  createdAt: null,
  updatedAt: null,
};

export const defaultWorkspaceBrandingSettings: WorkspaceBrandingSettings = {
  whiteLabel: { ...defaultWhiteLabelConfig },
  customDomains: [],
  ssoProviders: [],
  updatedAt: null,
};

export const CNAME_TARGET = 'cname.agentflow.ai';

export const SSO_PROVIDER_INFO: Record<SSOProviderType, { name: string; description: string; icon: string }> = {
  google_workspace: {
    name: 'Google Workspace',
    description: 'Sign in with Google Workspace accounts. Requires a Google Cloud project with OAuth 2.0 credentials.',
    icon: 'chrome',
  },
  microsoft_entra: {
    name: 'Microsoft Entra ID',
    description: 'Sign in with Microsoft accounts (Azure AD / Entra ID). Requires an App Registration in the Azure portal.',
    icon: 'windows',
  },
  okta: {
    name: 'Okta',
    description: 'Sign in with Okta identity provider. Requires an Okta application with OIDC credentials.',
    icon: 'shield',
  },
};
