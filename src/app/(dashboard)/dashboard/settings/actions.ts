'use server';

import { access, readFile } from 'node:fs/promises';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import {
  getCurrentUserWorkspace,
  getCurrentWorkspaceMembership,
} from '@/lib/data/workspaces';
import {
  canManageProviders,
  canManageSettings,
  getPermissionLevelSummary,
  permissionsMatrix,
  normalizeWorkspaceRole,
  type StrictWorkspaceRole,
} from '@/lib/workspace-permissions';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  getBrandKitForWorkspace,
  normalizeBrandKit,
  saveBrandKitForWorkspace,
} from '@/lib/data/brand-kit';
import {
  defaultWorkspaceBranding,
  getBrandingForWorkspace,
  normalizeWorkspaceBranding,
  resetBrandingForWorkspace,
  saveBrandingForWorkspace,
  type WorkspaceBranding,
} from '@/lib/data/branding';
import { getGoogleAdsConfigReadiness } from '@/lib/ads/google-ads';
import { getPinterestConfigReadiness } from '@/lib/ads/pinterest';
import { checkOpenAIImageReadiness } from '@/lib/ai/openai-images';
import { checkOpenAIContentReadiness } from '@/lib/ai/openai-content';
import {
  checkOpenAITextProviderReadiness,
  checkNvidiaTextProviderReadiness,
  getAITextProviderConfig,
  testNvidiaTextProviderConnection,
  type AITextProvider,
} from '@/lib/ai/text-provider';
import {
  CREATIVE_ASSETS_BUCKET,
  checkCreativeAssetsStorageReadiness,
  createCreativeAssetPublicUrl,
} from '@/lib/storage/creative-assets';
import {
  CONTENT_STUDIO_SCHEDULER_ROUTE_PATH,
  getContentStudioSchedulerReadiness,
} from '@/lib/content-studio/scheduler';
import {
  defaultWorkspaceTheme,
  normalizeWorkspaceTheme,
  sanitizeHexColor,
  sanitizeThemeNumber,
  type ThemeBackgroundMode,
  type ThemeCardStyle,
  type WorkspaceTheme,
} from '@/lib/theme';
import {
  getWorkspaceTheme,
  resetWorkspaceTheme,
  saveWorkspaceTheme,
} from '@/lib/data/theme';
import { getGitHubReadiness } from '@/lib/github';
import { listProjectsForWorkspace, normalizeProjectMetadata } from '@/lib/data/projects';
import {
  getMetaAdAccountsForWorkspace,
  getGoogleAdsConnectionStatus,
  getMetaConnectionStatus,
  updateMetaConnectionMetadata,
  type MetaAdAccountCampaignsData,
} from '@/lib/data/ad-connections';
import {
  getMetaPublishingScopes,
  listMetaPublishingTargets,
  type MetaPublishingPageOption,
} from '@/lib/ads/meta-publishing';
import {
  getPinterestConnectionSettings,
  getPinterestPublishingReadiness,
  updatePinterestSelectedBoard,
  type PinterestBoardOption,
} from '@/lib/ads/pinterest-publishing';
import type { JsonObject } from '@/types';
import type { BrandKit } from '@/types/brand-kit';

export interface AIImageGenerationReadinessState {
  openAIKeyStatus: 'configured' | 'missing';
  generationStatus: 'ready' | 'disabled';
  storageStatus: 'configured' | 'required';
  message: string;
  storageMessage: string;
}

export interface ProviderReadinessItem {
  key: 'openai' | 'meta' | 'google_ads' | 'pinterest' | 'linkedin_planner';
  label: string;
  status:
    | 'Ready'
    | 'Setup Required'
    | 'Draft-only'
    | 'Manual Mode'
    | 'External Approval Pending';
  detail: string;
}

export interface ProviderReadinessState {
  items: ProviderReadinessItem[];
  aiTextProvider: {
    activeProvider: AITextProvider;
    openaiStatus: 'ready' | 'quota_limit' | 'setup_required';
    nvidiaStatus: 'ready' | 'setup_required' | 'credits_required' | 'error';
    openaiMessage: string;
    nvidiaMessage: string;
    nvidiaBaseUrlStatus: 'present' | 'missing';
    nvidiaModelStatus: 'present' | 'missing';
    nvidiaKeyStatus: 'present' | 'missing';
    nvidiaModel: string;
    nvidiaLastTestPath: string;
    nvidiaLastTestStatus: 'not_run' | 'ok' | 'failed';
    nvidiaLastTestStatusCode: number | null;
    nvidiaLastTestCategory: string | null;
    nvidiaLastTestMessage: string | null;
  };
}

export interface BrandKitSettingsState {
  error: string | null;
  message?: string | null;
  brandKit: BrandKit;
  exists: boolean;
}

export interface BrandingSettingsState {
  error: string | null;
  message?: string | null;
  branding: WorkspaceBranding;
  exists: boolean;
}

export interface ThemeSettingsState {
  error: string | null;
  message?: string | null;
  theme: WorkspaceTheme;
  exists: boolean;
}

export type ProviderSetupStatus =
  | 'ready'
  | 'setup_required'
  | 'token_missing'
  | 'permission_missing'
  | 'approval_pending'
  | 'quota_limit'
  | 'credits_required'
  | 'customer_id_missing'
  | 'board_missing'
  | 'manual_only'
  | 'unsupported'
  | 'needs_review'
  | 'error';

export type ProviderSetupCheckStatus =
  | 'present'
  | 'missing'
  | 'needs_review'
  | 'approval_pending'
  | 'manual_only'
  | 'error';

export interface ProviderSetupCheckItem {
  label: string;
  status: ProviderSetupCheckStatus;
  explanation: string;
  nextAction: string;
}

export interface ProviderSetupWizardProvider {
  key:
    | 'openai'
    | 'nvidia'
    | 'meta'
    | 'google_ads'
    | 'pinterest'
    | 'linkedin'
    | 'github'
    | 'scheduler'
    | 'supabase_storage';
  name: string;
  description: string;
  status: ProviderSetupStatus;
  statusLabel: string;
  checklist: ProviderSetupCheckItem[];
  safeLastError: string | null;
  primaryActionLabel: string;
  primaryActionHref: string | null;
}

export interface ProviderSetupWizardState {
  error: string | null;
  generatedAt: string;
  summary: {
    ready: number;
    missingSetup: number;
    approvalPending: number;
    manualOnly: number;
    criticalBlockers: number;
    total: number;
  };
  nextBestAction: {
    title: string;
    detail: string;
    providerKey: ProviderSetupWizardProvider['key'] | null;
    href: string | null;
  };
  providers: ProviderSetupWizardProvider[];
}

export interface RolesOverviewState {
  error: string | null;
  currentRole: StrictWorkspaceRole;
  isOwner: boolean;
  isAdmin: boolean;
  memberCount: number | null;
  permissionLevelSummary: string;
  matrix: typeof permissionsMatrix;
}

export interface PinterestConnectionSettingsState {
  error: string | null;
  message?: string | null;
  status: 'connected' | 'expired' | 'revoked' | 'error' | 'not_connected';
  connectedAt: string | null;
  updatedAt: string | null;
  tokenExpiresAt: string | null;
  grantedScopes: string[];
  missingScopes: string[];
  missingEnvironmentVariables: string[];
  connectedAccount: string | null;
  tokenStatus: 'valid' | 'expired' | 'missing' | 'not_connected';
  boards: PinterestBoardOption[];
  selectedBoardId: string | null;
  selectedBoardName: string | null;
}

function getNvidiaProviderSetupStatus(input: {
  keyStatus: 'present' | 'missing';
  baseUrlStatus: 'present' | 'missing';
  modelStatus: 'present' | 'missing';
  lastTestStatus: 'not_run' | 'ok' | 'failed';
  errorCategory: string | null;
}): 'ready' | 'setup_required' | 'credits_required' | 'error' {
  if (input.keyStatus === 'missing' || input.baseUrlStatus === 'missing' || input.modelStatus === 'missing') {
    return 'setup_required';
  }

  if (input.errorCategory === 'rate_limited') return 'credits_required';
  if (input.lastTestStatus === 'failed') return 'error';
  return 'ready';
}

function buildAITextProviderReadinessState(input: {
  activeProvider: AITextProvider;
  openaiReady: boolean;
  openaiMessage: string;
  nvidiaMessage: string;
  nvidiaDiagnostic: Awaited<ReturnType<typeof testNvidiaTextProviderConnection>>;
}): ProviderReadinessState['aiTextProvider'] {
  return {
    activeProvider: input.activeProvider,
    openaiStatus: input.openaiReady ? 'ready' : 'setup_required',
    nvidiaStatus: getNvidiaProviderSetupStatus({
      keyStatus: input.nvidiaDiagnostic.keyStatus,
      baseUrlStatus: input.nvidiaDiagnostic.baseUrlStatus,
      modelStatus: input.nvidiaDiagnostic.modelStatus,
      lastTestStatus: input.nvidiaDiagnostic.lastTestStatus,
      errorCategory: input.nvidiaDiagnostic.errorCategory,
    }),
    openaiMessage: input.openaiMessage,
    nvidiaMessage: input.nvidiaMessage,
    nvidiaBaseUrlStatus: input.nvidiaDiagnostic.baseUrlStatus,
    nvidiaModelStatus: input.nvidiaDiagnostic.modelStatus,
    nvidiaKeyStatus: input.nvidiaDiagnostic.keyStatus,
    nvidiaModel: input.nvidiaDiagnostic.model,
    nvidiaLastTestPath: input.nvidiaDiagnostic.requestPath,
    nvidiaLastTestStatus: input.nvidiaDiagnostic.lastTestStatus,
    nvidiaLastTestStatusCode: input.nvidiaDiagnostic.responseStatusCode,
    nvidiaLastTestCategory: input.nvidiaDiagnostic.errorCategory,
    nvidiaLastTestMessage: input.nvidiaDiagnostic.safeProviderMessage,
  };
}

export interface MetaConnectionSettingsState {
  error: string | null;
  message?: string | null;
  status: 'connected' | 'expired' | 'revoked' | 'error' | 'not_connected';
  connectedAt: string | null;
  updatedAt: string | null;
  tokenExpiresAt: string | null;
  grantedScopes: string[];
  requiredOrganicScopes: string[];
  missingOrganicScopes: string[];
  connectedMetaUserId: string | null;
  connectedMetaApplication: string | null;
  scopesVerified: boolean;
  scopeWarning: string | null;
  pages: MetaPublishingPageOption[];
  adAccounts: MetaAdAccountCampaignsData[];
  selectedFacebookPageId: string | null;
  selectedFacebookPageName: string | null;
  selectedInstagramBusinessAccountId: string | null;
  selectedInstagramUsername: string | null;
  selectedInstagramAssociatedFacebookPageId: string | null;
  selectedMetaAdAccountId: string | null;
  selectedMetaAdAccountName: string | null;
  selectedMetaAdAccountCurrency: string | null;
  selectedMetaAdAccountTimezone: string | null;
}

const disconnectedMetaSettings: MetaConnectionSettingsState = {
  error: null,
  status: 'not_connected',
  connectedAt: null,
  updatedAt: null,
  tokenExpiresAt: null,
  grantedScopes: [],
  requiredOrganicScopes: getMetaPublishingScopes(),
  missingOrganicScopes: getMetaPublishingScopes(),
  connectedMetaUserId: null,
  connectedMetaApplication: null,
  scopesVerified: false,
  scopeWarning: null,
  pages: [],
  adAccounts: [],
  selectedFacebookPageId: null,
  selectedFacebookPageName: null,
  selectedInstagramBusinessAccountId: null,
  selectedInstagramUsername: null,
  selectedInstagramAssociatedFacebookPageId: null,
  selectedMetaAdAccountId: null,
  selectedMetaAdAccountName: null,
  selectedMetaAdAccountCurrency: null,
  selectedMetaAdAccountTimezone: null,
};

const disconnectedPinterestSettings: PinterestConnectionSettingsState = {
  error: null,
  status: 'not_connected',
  connectedAt: null,
  updatedAt: null,
  tokenExpiresAt: null,
  grantedScopes: [],
  missingScopes: [],
  missingEnvironmentVariables: [],
  connectedAccount: null,
  tokenStatus: 'not_connected',
  boards: [],
  selectedBoardId: null,
  selectedBoardName: null,
};

const LOGO_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const LOGO_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const THEME_BACKGROUND_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const THEME_BACKGROUND_ALLOWED_TYPES = LOGO_ALLOWED_TYPES;

function formatEnvList(envVars: string[]) {
  return envVars.length > 0 ? envVars.join(', ') : 'provider environment variables';
}

function isEnvPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function envCheck(label: string, envName: string, presentDetail?: string): ProviderSetupCheckItem {
  const present = isEnvPresent(envName);

  return {
    label,
    status: present ? 'present' : 'missing',
    explanation: present
      ? presentDetail ?? `${envName} is present server-side. The value is not shown.`
      : `${envName} is missing from the server environment.`,
    nextAction: present ? 'No action needed.' : `Add ${envName} in Vercel and redeploy.`,
  };
}

function optionalEnvReview(label: string, envName: string, detail: string): ProviderSetupCheckItem {
  const present = isEnvPresent(envName);

  return {
    label,
    status: present ? 'present' : 'needs_review',
    explanation: present ? `${envName} is present server-side. The value is not shown.` : detail,
    nextAction: present ? 'No action needed.' : `Review whether ${envName} should be set for this workspace.`,
  };
}

function checklistProgress(checklist: ProviderSetupCheckItem[]) {
  const present = checklist.filter((item) => item.status === 'present').length;
  const total = checklist.length;

  return { present, total };
}

function titleCaseStatus(status: ProviderSetupStatus) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function providerStatusFromChecklist(
  checklist: ProviderSetupCheckItem[],
  fallback: ProviderSetupStatus = 'ready'
): ProviderSetupStatus {
  if (checklist.some((item) => item.status === 'error')) {
    return 'error';
  }

  if (checklist.some((item) => item.status === 'missing')) {
    return 'setup_required';
  }

  if (checklist.some((item) => item.status === 'approval_pending')) {
    return 'approval_pending';
  }

  if (checklist.some((item) => item.status === 'needs_review')) {
    return 'needs_review';
  }

  return fallback;
}

function buildProvider(input: Omit<ProviderSetupWizardProvider, 'statusLabel'>) {
  const progress = checklistProgress(input.checklist);

  return {
    ...input,
    statusLabel: `${titleCaseStatus(input.status)} · ${progress.present}/${progress.total}`,
  };
}

function safeErrorMessage(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return normalized.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]').slice(0, 240);
}

async function schedulerRouteFileExists() {
  try {
    await access('src/app/api/cron/content-studio-scheduler/route.ts');
    return true;
  } catch {
    return false;
  }
}

async function dashboardSchedulerButtonFileExists() {
  try {
    await access('src/app/(dashboard)/dashboard/DashboardSchedulerButton.tsx');
    return true;
  } catch {
    return false;
  }
}

async function readVercelCronStatus() {
  try {
    const raw = await readFile('vercel.json', 'utf8');
    const parsed = JSON.parse(raw) as {
      crons?: Array<{ path?: unknown; schedule?: unknown }>;
    };
    const cron = parsed.crons?.find(
      (item) => item.path === CONTENT_STUDIO_SCHEDULER_ROUTE_PATH
    );

    return {
      exists: Boolean(cron),
      dailyHobbySchedule: cron?.schedule === '0 9 * * *',
      schedule: typeof cron?.schedule === 'string' ? cron.schedule : null,
    };
  } catch {
    return {
      exists: false,
      dailyHobbySchedule: false,
      schedule: null,
    };
  }
}

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function emptyToNull(value: string) {
  return value.length > 0 ? value : null;
}

function readPositiveNumberField(formData: FormData, key: string) {
  const value = Number(readField(formData, key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readMultiValueField(formData: FormData, key: string) {
  return readField(formData, key)
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function readBrandKitFormData(formData: FormData): BrandKit {
  return normalizeBrandKit({
    brandName: readField(formData, 'brandName'),
    description: emptyToNull(readField(formData, 'description')),
    websiteUrl: emptyToNull(readField(formData, 'websiteUrl')),
    offer: emptyToNull(readField(formData, 'offer')),
    services: emptyToNull(readField(formData, 'services')),
    industry: emptyToNull(readField(formData, 'industry')),
    targetMarket: emptyToNull(readField(formData, 'targetMarket')),
    targetAudience: emptyToNull(readField(formData, 'targetAudience')),
    painPoints: emptyToNull(readField(formData, 'painPoints')),
    audienceGoals: emptyToNull(readField(formData, 'audienceGoals')),
    audienceLanguage: emptyToNull(readField(formData, 'audienceLanguage')),
    market: emptyToNull(readField(formData, 'market')),
    toneOfVoice: emptyToNull(readField(formData, 'toneOfVoice')),
    writingStyle: emptyToNull(readField(formData, 'writingStyle')),
    brandPersonality: emptyToNull(readField(formData, 'brandPersonality')),
    wordsToUse: emptyToNull(readField(formData, 'wordsToUse')),
    wordsToAvoid: emptyToNull(readField(formData, 'wordsToAvoid')),
    defaultCta: emptyToNull(readField(formData, 'defaultCta')),
    defaultHashtags: emptyToNull(readField(formData, 'defaultHashtags')),
    primaryColor: emptyToNull(readField(formData, 'primaryColor')),
    secondaryColor: emptyToNull(readField(formData, 'secondaryColor')),
    accentColor: emptyToNull(readField(formData, 'accentColor')),
    backgroundColor: emptyToNull(readField(formData, 'backgroundColor')),
    logoAssetId: emptyToNull(readField(formData, 'logoAssetId')),
    logoUrl: emptyToNull(readField(formData, 'logoUrl')),
    visualStyle: emptyToNull(readField(formData, 'visualStyle')),
    imageStyleNotes: emptyToNull(readField(formData, 'imageStyleNotes')),
    designInspirationNotes: emptyToNull(readField(formData, 'designInspirationNotes')),
    campaignDefaults: {
      defaultObjective: emptyToNull(readField(formData, 'defaultObjective')),
      defaultDestinationUrl: emptyToNull(readField(formData, 'defaultDestinationUrl')),
      defaultPlatforms: readMultiValueField(formData, 'defaultPlatforms'),
      defaultPostingStyle: emptyToNull(readField(formData, 'defaultPostingStyle')),
      defaultCreativeDirection: emptyToNull(readField(formData, 'defaultCreativeDirection')),
      defaultOffer: emptyToNull(readField(formData, 'defaultOffer')),
      defaultDisclaimer: emptyToNull(readField(formData, 'defaultDisclaimer')),
    },
    aiPreferences: {
      providerMode: readField(formData, 'providerMode'),
      defaultLanguage: readField(formData, 'defaultLanguage'),
      contentLength: readField(formData, 'contentLength'),
      emojiUsage: readField(formData, 'emojiUsage'),
      hashtagCount: readPositiveNumberField(formData, 'hashtagCount'),
      ctaStyle: emptyToNull(readField(formData, 'ctaStyle')),
    },
  });
}

function readMetadataString(metadata: JsonObject, key: string) {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readOptionalFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function safeLogoStorageFileName(file: File) {
  const extension = LOGO_EXTENSIONS[file.type] ?? 'png';
  const baseName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `${Date.now()}-${baseName || 'logo'}.${extension}`;
}

function safeThemeBackgroundStorageFileName(file: File) {
  const extension = LOGO_EXTENSIONS[file.type] ?? 'png';
  const baseName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `background-${Date.now()}-${baseName || 'theme'}.${extension}`;
}

function readThemeFormData(formData: FormData): WorkspaceTheme {
  const rawBackgroundMode = readField(formData, 'background_mode') as ThemeBackgroundMode;
  const rawCardStyle = readField(formData, 'card_background_style') as ThemeCardStyle;
  const backgroundImageUrl = readField(formData, 'background_image_url');

  return normalizeWorkspaceTheme({
    theme: {
      primary_color: sanitizeHexColor(
        readField(formData, 'primary_color'),
        defaultWorkspaceTheme.primary_color
      ),
      secondary_color: sanitizeHexColor(
        readField(formData, 'secondary_color'),
        defaultWorkspaceTheme.secondary_color
      ),
      accent_color: sanitizeHexColor(
        readField(formData, 'accent_color'),
        defaultWorkspaceTheme.accent_color
      ),
      background_color: sanitizeHexColor(
        readField(formData, 'background_color'),
        defaultWorkspaceTheme.background_color
      ),
      text_color: sanitizeHexColor(readField(formData, 'text_color'), defaultWorkspaceTheme.text_color),
      card_background_style: rawCardStyle,
      background_mode: rawBackgroundMode,
      background_image_url: backgroundImageUrl || null,
      background_image_storage_path: readField(formData, 'background_image_storage_path') || null,
      background_opacity: sanitizeThemeNumber(
        readField(formData, 'background_opacity'),
        defaultWorkspaceTheme.background_opacity,
        0.35,
        1
      ),
      card_opacity: sanitizeThemeNumber(
        readField(formData, 'card_opacity'),
        defaultWorkspaceTheme.card_opacity,
        0.68,
        1
      ),
      glass_enabled: formData.get('glass_enabled') === 'on',
      updated_at: new Date().toISOString(),
    },
  });
}

async function getSettingsWorkspaceContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Sign in to manage provider publishing settings.', user: null, workspace: null, supabase, role: 'viewer' as StrictWorkspaceRole };
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    return { error: workspaceResult.error ?? 'Workspace not found.', user: null, workspace: null, supabase, role: 'viewer' as StrictWorkspaceRole };
  }

  const membershipResult = await getCurrentWorkspaceMembership(
    supabase,
    workspaceResult.data.id,
    user.id
  );
  const role = normalizeWorkspaceRole(membershipResult.data?.role, workspaceResult.data, user.id);

  return { error: membershipResult.error, user, workspace: workspaceResult.data, supabase, role };
}

async function denySettingsAction(context: Awaited<ReturnType<typeof getSettingsWorkspaceContext>>, message: string) {
  if (context.user && context.workspace) {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'settings',
      message,
      metadata: { role: context.role },
    });
  }
}

async function countMembersForSettings(workspaceId: string) {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from('workspace_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  return error ? null : count;
}

export async function getRolesOverviewAction(): Promise<RolesOverviewState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      currentRole: 'viewer',
      isOwner: false,
      isAdmin: false,
      memberCount: null,
      permissionLevelSummary: getPermissionLevelSummary('viewer'),
      matrix: permissionsMatrix,
    };
  }

  return {
    error: null,
    currentRole: context.role,
    isOwner: context.role === 'owner',
    isAdmin: context.role === 'owner' || context.role === 'admin',
    memberCount: await countMembersForSettings(context.workspace.id),
    permissionLevelSummary: getPermissionLevelSummary(context.role),
    matrix: permissionsMatrix,
  };
}

export async function getBrandKitSettingsAction(): Promise<BrandKitSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      brandKit: normalizeBrandKit(null),
      exists: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const result = await getBrandKitForWorkspace(supabase, context.workspace.id);

  return {
    error: result.error,
    brandKit: result.data.brandKit,
    exists: result.data.exists,
  };
}

export async function getBrandingSettingsAction(): Promise<BrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      branding: defaultWorkspaceBranding,
      exists: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const result = await getBrandingForWorkspace(supabase, context.workspace.id);

  return {
    error: result.error,
    branding: result.data.branding,
    exists: result.data.exists,
  };
}

export async function getThemeSettingsAction(): Promise<ThemeSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      theme: defaultWorkspaceTheme,
      exists: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const result = await getWorkspaceTheme(supabase, context.workspace.id);

  return {
    error: result.error,
    theme: result.data,
    exists: !result.error,
  };
}

export async function saveThemeSettingsAction(
  _state: ThemeSettingsState,
  formData: FormData
): Promise<ThemeSettingsState> {
  const context = await getSettingsWorkspaceContext();
  let theme = readThemeFormData(formData);

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      theme,
      exists: false,
    };
  }

  const supabase = context.supabase;

  if (!canManageSettings(context.role)) {
    await denySettingsAction(context, 'Only workspace owners and admins can update theme settings.');
    return {
      error: 'Only workspace owners and admins can update theme settings.',
      theme,
      exists: false,
    };
  }

  const backgroundFile = readOptionalFile(formData, 'background_file');

  if (backgroundFile) {
    if (!THEME_BACKGROUND_ALLOWED_TYPES.has(backgroundFile.type)) {
      return {
        error: 'Unsupported file type.',
        theme,
        exists: false,
      };
    }

    if (backgroundFile.size > THEME_BACKGROUND_MAX_FILE_SIZE_BYTES) {
      return {
        error: 'File is too large.',
        theme,
        exists: false,
      };
    }

    const storagePath = `${context.workspace.id}/${context.user.id}/theme/${safeThemeBackgroundStorageFileName(backgroundFile)}`;
    const { error: uploadError } = await supabase.storage
      .from(CREATIVE_ASSETS_BUCKET)
      .upload(storagePath, backgroundFile, {
        cacheControl: '31536000',
        contentType: backgroundFile.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        error: uploadError.message,
        theme,
        exists: false,
      };
    }

    const backgroundUrl = createCreativeAssetPublicUrl(storagePath);

    if (!backgroundUrl) {
      return {
        error: 'Could not create background image URL.',
        theme,
        exists: false,
      };
    }

    theme = {
      ...theme,
      background_image_url: backgroundUrl,
      background_image_storage_path: storagePath,
      background_mode: 'image',
    };
  }

  const result = await saveWorkspaceTheme(supabase, context.workspace.id, context.user.id, theme);

  if (!result.error) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'sensitive_settings_updated',
      entityType: 'theme',
      message: 'Workspace theme settings updated.',
      metadata: { background_uploaded: Boolean(backgroundFile) },
    });
  }

  return {
    error: result.error,
    message: result.error ? null : backgroundFile ? 'Background uploaded.' : 'Theme saved.',
    theme: result.data,
    exists: !result.error,
  };
}

export async function resetThemeSettingsAction(): Promise<ThemeSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      theme: defaultWorkspaceTheme,
      exists: false,
    };
  }

  const supabase = context.supabase;

  if (!canManageSettings(context.role)) {
    await denySettingsAction(context, 'Only workspace owners and admins can update theme settings.');
    return {
      error: 'Only workspace owners and admins can update theme settings.',
      theme: defaultWorkspaceTheme,
      exists: false,
    };
  }

  const result = await resetWorkspaceTheme(supabase, context.workspace.id, context.user.id);

  if (!result.error) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'sensitive_settings_updated',
      entityType: 'theme',
      message: 'Workspace theme settings reset.',
    });
  }

  return {
    error: result.error,
    message: result.error ? null : 'Theme reset to default.',
    theme: result.data,
    exists: !result.error,
  };
}

export async function saveBrandingSettingsAction(
  _state: BrandingSettingsState,
  formData: FormData
): Promise<BrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();
  const fallbackBranding = normalizeWorkspaceBranding({
    logo_alt_text: readField(formData, 'logoAltText'),
  });

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      branding: fallbackBranding,
      exists: false,
    };
  }

  const supabase = context.supabase;

  if (!canManageSettings(context.role)) {
    await denySettingsAction(context, 'Only workspace owners and admins can update branding.');
    return {
      error: 'Only workspace owners and admins can update branding.',
      branding: fallbackBranding,
      exists: false,
    };
  }

  const logoFile = readOptionalFile(formData, 'logoFile');

  if (!logoFile) {
    return {
      error: 'Select a logo before saving.',
      branding: fallbackBranding,
      exists: false,
    };
  }

  if (!LOGO_ALLOWED_TYPES.has(logoFile.type)) {
    return {
      error: 'Unsupported file type.',
      branding: fallbackBranding,
      exists: false,
    };
  }

  if (logoFile.size > LOGO_MAX_FILE_SIZE_BYTES) {
    return {
      error: 'Logo file is too large.',
      branding: fallbackBranding,
      exists: false,
    };
  }

  const storagePath = `${context.workspace.id}/${context.user.id}/branding/${safeLogoStorageFileName(logoFile)}`;
  const { error: uploadError } = await supabase.storage
    .from(CREATIVE_ASSETS_BUCKET)
    .upload(storagePath, logoFile, {
      cacheControl: '31536000',
      contentType: logoFile.type,
      upsert: false,
    });

  if (uploadError) {
    return {
      error: uploadError.message,
      branding: fallbackBranding,
      exists: false,
    };
  }

  const logoUrl = createCreativeAssetPublicUrl(storagePath);

  if (!logoUrl) {
    return {
      error: 'Could not create logo URL.',
      branding: fallbackBranding,
      exists: false,
    };
  }

  const result = await saveBrandingForWorkspace(
    supabase,
    context.workspace.id,
    context.user.id,
    normalizeWorkspaceBranding({
      logo_url: logoUrl,
      logo_storage_path: storagePath,
      logo_alt_text: readField(formData, 'logoAltText') || 'AgentFlow AI logo',
      favicon_url: null,
    })
  );

  if (result.error) {
    return {
      error: result.error,
      branding: fallbackBranding,
      exists: false,
    };
  }

  await logSecurityAuditEvent({
    supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'branding',
    message: 'Workspace logo updated.',
  });

  return {
    error: null,
    message: 'Logo updated successfully.',
    branding: result.data.branding,
    exists: true,
  };
}

export async function resetBrandingSettingsAction(): Promise<BrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      branding: defaultWorkspaceBranding,
      exists: false,
    };
  }

  const supabase = context.supabase;

  if (!canManageSettings(context.role)) {
    await denySettingsAction(context, 'Only workspace owners and admins can update branding.');
    return {
      error: 'Only workspace owners and admins can update branding.',
      branding: defaultWorkspaceBranding,
      exists: false,
    };
  }

  const result = await resetBrandingForWorkspace(
    supabase,
    context.workspace.id,
    context.user.id
  );

  if (!result.error) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'sensitive_settings_updated',
      entityType: 'branding',
      message: 'Workspace branding reset.',
    });
  }

  return {
    error: result.error,
    message: result.error ? null : 'Logo reset to default.',
    branding: result.data.branding,
    exists: result.data.exists,
  };
}

export async function saveBrandKitSettingsAction(
  _state: BrandKitSettingsState,
  formData: FormData
): Promise<BrandKitSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      brandKit: normalizeBrandKit(null),
      exists: false,
    };
  }

  const supabase = context.supabase;

  if (!canManageSettings(context.role)) {
    await denySettingsAction(context, 'Only workspace owners and admins can update the Brand Kit.');
    return {
      error: 'Only workspace owners and admins can update the Brand Kit.',
      brandKit: readBrandKitFormData(formData),
      exists: false,
    };
  }

  const brandKit = readBrandKitFormData(formData);

  if (!brandKit.brandName.trim()) {
    return {
      error: 'Please complete the required brand name field.',
      brandKit,
      exists: false,
    };
  }

  const result = await saveBrandKitForWorkspace(
    supabase,
    context.workspace.id,
    context.user.id,
    brandKit
  );

  if (result.error) {
    return {
      error: result.error,
      brandKit,
      exists: false,
    };
  }

  await logSecurityAuditEvent({
    supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'brand_kit',
    message: 'Workspace Brand Kit updated.',
  });

  return {
    error: null,
    message: 'Brand Kit saved.',
    brandKit: result.data.brandKit,
    exists: true,
  };
}

export async function getMetaConnectionSettingsAction(): Promise<MetaConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedMetaSettings,
      error: context.error,
    };
  }

  const connectionResult = await getMetaConnectionStatus(context.workspace.id, context.user.id);

  if (connectionResult.error) {
    return {
      ...disconnectedMetaSettings,
      error: connectionResult.error,
    };
  }

  const connection = connectionResult.data;
  const requiredScopes = getMetaPublishingScopes();
  const missingScopes = requiredScopes.filter((scope) => !connection.scopes.includes(scope));

  if (connection.status !== 'connected') {
    return {
      ...disconnectedMetaSettings,
      status: connection.status,
      connectedAt: connection.connectedAt,
      updatedAt: connection.updatedAt,
      tokenExpiresAt: connection.tokenExpiresAt,
      grantedScopes: connection.scopes,
      missingOrganicScopes: missingScopes,
      error: null,
    };
  }

  const [targets, adAccountsResult] = await Promise.all([
    listMetaPublishingTargets({
      workspaceId: context.workspace.id,
      userId: context.user.id,
    }),
    getMetaAdAccountsForWorkspace(context.workspace.id, context.user.id),
  ]);
  const metadata = connection.metadata;
  const adAccounts =
    adAccountsResult.data.state === 'connected' ? adAccountsResult.data.accounts : [];

  return {
    error: targets.error,
    status: connection.status,
    connectedAt: connection.connectedAt,
    updatedAt: connection.updatedAt,
    tokenExpiresAt: connection.tokenExpiresAt,
    grantedScopes: connection.scopes,
    requiredOrganicScopes: requiredScopes,
    missingOrganicScopes: missingScopes,
    connectedMetaUserId: readMetadataString(metadata, 'meta_user_id'),
    connectedMetaApplication: readMetadataString(metadata, 'meta_application'),
    scopesVerified: metadata.scopes_verified === true,
    scopeWarning:
      readMetadataString(metadata, 'scope_warning') ??
      readMetadataString(metadata, 'scope_verification_warning'),
    pages: targets.pages,
    adAccounts,
    selectedFacebookPageId: targets.selectedFacebookPageId,
    selectedFacebookPageName: targets.selectedFacebookPageName,
    selectedInstagramBusinessAccountId: targets.selectedInstagramBusinessAccountId,
    selectedInstagramUsername: targets.selectedInstagramUsername,
    selectedInstagramAssociatedFacebookPageId:
      targets.selectedInstagramAssociatedFacebookPageId,
    selectedMetaAdAccountId: readMetadataString(metadata, 'selected_meta_ad_account_id'),
    selectedMetaAdAccountName: readMetadataString(metadata, 'selected_meta_ad_account_name'),
    selectedMetaAdAccountCurrency: readMetadataString(metadata, 'selected_meta_ad_account_currency'),
    selectedMetaAdAccountTimezone: readMetadataString(metadata, 'selected_meta_ad_account_timezone'),
  };
}

export async function selectMetaFacebookPageAction(
  _state: MetaConnectionSettingsState,
  formData: FormData
): Promise<MetaConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedMetaSettings,
      error: context.error,
    };
  }

  if (!canManageProviders(context.role)) {
    await denySettingsAction(context, 'Only workspace owners and admins can update provider settings.');
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Only workspace owners and admins can update provider settings.',
    };
  }

  const pageId = readField(formData, 'facebook_page_id');
  const targets = await listMetaPublishingTargets({
    workspaceId: context.workspace.id,
    userId: context.user.id,
  });
  const selectedPage = targets.pages.find((page) => page.id === pageId);

  if (!selectedPage) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Facebook Page setup required.',
    };
  }

  const updateResult = await updateMetaConnectionMetadata(
    context.workspace.id,
    context.user.id,
    {
      selected_facebook_page_id: selectedPage.id,
      selected_facebook_page_name: selectedPage.name,
      selected_facebook_page_selected_at: new Date().toISOString(),
    }
  );

  if (updateResult.error) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: updateResult.error,
    };
  }

  await logSecurityAuditEvent({
    supabase: context.supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'provider_settings',
    message: 'Meta Facebook Page selected.',
    metadata: { provider: 'meta' },
  });

  return {
    ...(await getMetaConnectionSettingsAction()),
    message: 'Facebook Page selected.',
    error: null,
  };
}

export async function selectMetaInstagramAccountAction(
  _state: MetaConnectionSettingsState,
  formData: FormData
): Promise<MetaConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedMetaSettings,
      error: context.error,
    };
  }

  if (!canManageProviders(context.role)) {
    await denySettingsAction(context, 'Only workspace owners and admins can update provider settings.');
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Only workspace owners and admins can update provider settings.',
    };
  }

  const instagramBusinessAccountId = readField(formData, 'instagram_business_account_id');
  const targets = await listMetaPublishingTargets({
    workspaceId: context.workspace.id,
    userId: context.user.id,
  });
  const selectedPage = targets.pages.find(
    (page) => page.instagramBusinessAccountId === instagramBusinessAccountId
  );

  if (!selectedPage?.instagramBusinessAccountId) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Instagram Business Account setup required.',
    };
  }

  const updateResult = await updateMetaConnectionMetadata(
    context.workspace.id,
    context.user.id,
    {
      selected_instagram_business_account_id: selectedPage.instagramBusinessAccountId,
      selected_instagram_username: selectedPage.instagramUsername ?? '',
      selected_instagram_associated_facebook_page_id: selectedPage.id,
      selected_instagram_associated_facebook_page_name: selectedPage.name,
      selected_instagram_selected_at: new Date().toISOString(),
    }
  );

  if (updateResult.error) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: updateResult.error,
    };
  }

  await logSecurityAuditEvent({
    supabase: context.supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'provider_settings',
    message: 'Meta Instagram account selected.',
    metadata: { provider: 'meta' },
  });

  return {
    ...(await getMetaConnectionSettingsAction()),
    message: 'Instagram account selected.',
    error: null,
  };
}

export async function selectMetaAdAccountAction(
  _state: MetaConnectionSettingsState,
  formData: FormData
): Promise<MetaConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedMetaSettings,
      error: context.error,
    };
  }

  if (!canManageProviders(context.role)) {
    await denySettingsAction(context, 'Only workspace owners and admins can update provider settings.');
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Only workspace owners and admins can update provider settings.',
    };
  }

  const adAccountId = readField(formData, 'meta_ad_account_id');
  const accountsResult = await getMetaAdAccountsForWorkspace(context.workspace.id, context.user.id);
  const accounts =
    accountsResult.data.state === 'connected' ? accountsResult.data.accounts : [];
  const selectedAccount = accounts.find(
    (account) => account.id === adAccountId || account.accountId === adAccountId
  );

  if (!selectedAccount?.accountId) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Meta Ad Account is not selected.',
    };
  }

  const updateResult = await updateMetaConnectionMetadata(
    context.workspace.id,
    context.user.id,
    {
      selected_meta_ad_account_id: selectedAccount.accountId,
      selected_meta_ad_account_name: selectedAccount.name ?? '',
      selected_meta_ad_account_currency: selectedAccount.currency ?? '',
      selected_meta_ad_account_timezone: selectedAccount.timezoneName ?? '',
      selected_at: new Date().toISOString(),
    }
  );

  if (updateResult.error) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: updateResult.error,
    };
  }

  await logSecurityAuditEvent({
    supabase: context.supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'provider_settings',
    message: 'Meta Ad Account selected.',
    metadata: { provider: 'meta' },
  });

  return {
    ...(await getMetaConnectionSettingsAction()),
    message: 'Meta Ad Account selected.',
    error: null,
  };
}

export async function getPinterestConnectionSettingsAction(): Promise<PinterestConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedPinterestSettings,
      error: context.error,
    };
  }

  const settings = await getPinterestConnectionSettings({
    workspaceId: context.workspace.id,
    userId: context.user.id,
  });

  return settings;
}

export async function selectPinterestBoardAction(
  _state: PinterestConnectionSettingsState,
  formData: FormData
): Promise<PinterestConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedPinterestSettings,
      error: context.error,
    };
  }

  if (!canManageProviders(context.role)) {
    await denySettingsAction(context, 'Only workspace owners and admins can update provider settings.');
    return {
      ...(await getPinterestConnectionSettingsAction()),
      error: 'Only workspace owners and admins can update provider settings.',
    };
  }

  const boardId = readField(formData, 'pinterest_board_id');

  if (!boardId) {
    return {
      ...(await getPinterestConnectionSettingsAction()),
      error: 'Pinterest board is required.',
    };
  }

  const updateResult = await updatePinterestSelectedBoard({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    boardId,
  });

  if (updateResult.error) {
    return {
      ...(await getPinterestConnectionSettingsAction()),
      error: updateResult.error,
    };
  }

  await logSecurityAuditEvent({
    supabase: context.supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'provider_settings',
    message: 'Pinterest board selected.',
    metadata: { provider: 'pinterest' },
  });

  return {
    ...(await getPinterestConnectionSettingsAction()),
    message: 'Pinterest board selected.',
    error: null,
  };
}

export async function getAIImageGenerationReadinessAction(): Promise<AIImageGenerationReadinessState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      openAIKeyStatus: 'missing',
      generationStatus: 'disabled',
      storageStatus: 'required',
      message: 'Sign in to check image generation readiness.',
      storageMessage: 'creative-assets bucket status could not be checked.',
    };
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const readiness = checkOpenAIImageReadiness();

  if (!workspaceResult.data) {
    return {
      openAIKeyStatus: readiness.isReady ? 'configured' : 'missing',
      generationStatus: readiness.isReady ? 'ready' : 'disabled',
      storageStatus: 'required',
      message: readiness.message,
      storageMessage: 'creative-assets bucket status could not be checked.',
    };
  }

  const storageReadiness = await checkCreativeAssetsStorageReadiness(
    supabase,
    workspaceResult.data.id
  );

  return {
    openAIKeyStatus: readiness.isReady ? 'configured' : 'missing',
    generationStatus: readiness.isReady ? 'ready' : 'disabled',
    storageStatus: storageReadiness.isConfigured ? 'configured' : 'required',
    message: readiness.message,
    storageMessage: storageReadiness.message,
  };
}

export async function getProviderReadinessAction(): Promise<ProviderReadinessState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const openAITextReadiness = checkOpenAIContentReadiness();
  const nvidiaTextReadiness = checkNvidiaTextProviderReadiness();
  const aiTextProviderConfig = getAITextProviderConfig();
  const nvidiaDiagnostic = await testNvidiaTextProviderConnection();
  const googleAdsReadiness = getGoogleAdsConfigReadiness();
  const pinterestReadiness = getPinterestConfigReadiness();
  const metaEnvConfigured = Boolean(
    process.env.META_APP_ID?.trim() &&
      process.env.META_APP_SECRET?.trim() &&
      process.env.META_REDIRECT_URI?.trim()
  );

  if (!user) {
    return {
      items: [
        {
          key: 'openai',
          label: 'OpenAI',
          status: openAITextReadiness.isReady ? 'Ready' : 'Setup Required',
          detail: openAITextReadiness.isReady
            ? 'Server-side AI generation is configured. quota or quota issues can still temporarily block generation.'
            : openAITextReadiness.message,
        },
        {
          key: 'meta',
          label: 'Meta Ads / Instagram & Facebook',
          status: metaEnvConfigured ? 'Setup Required' : 'Setup Required',
          detail: metaEnvConfigured
            ? 'Meta OAuth foundation is configured, but sign in to check workspace connection status.'
            : 'Meta provider setup still needs META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.',
        },
        {
          key: 'google_ads',
          label: 'Google Ads',
          status: googleAdsReadiness.isConfigured ? 'Draft-only' : 'Setup Required',
          detail: googleAdsReadiness.isConfigured
            ? 'Google Ads stays draft-only until developer token/basic access is fully approved.'
            : `Google Ads setup still needs: ${formatEnvList(googleAdsReadiness.missingEnvironmentVariables)}.`,
        },
        {
          key: 'pinterest',
          label: 'Pinterest',
          status: pinterestReadiness.isConfigured ? 'Draft-only' : 'Setup Required',
          detail: pinterestReadiness.isConfigured
            ? 'Pinterest draft planning is available, but send remains disabled in this phase.'
            : `Pinterest setup still needs: ${formatEnvList(pinterestReadiness.missingEnvironmentVariables)}.`,
        },
        {
          key: 'linkedin_planner',
          label: 'LinkedIn Planner',
          status: 'Manual Mode',
          detail: 'LinkedIn stays planner-only with copy-ready text. No OAuth or publishing API is enabled.',
        },
      ],
      aiTextProvider: {
        ...buildAITextProviderReadinessState({
          activeProvider: aiTextProviderConfig.activeProvider,
          openaiReady: openAITextReadiness.isReady,
          openaiMessage: openAITextReadiness.message,
          nvidiaMessage: nvidiaTextReadiness.message,
          nvidiaDiagnostic,
        }),
      },
    };
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    return {
      items: [
        {
          key: 'openai',
          label: 'OpenAI',
          status: openAITextReadiness.isReady ? 'Ready' : 'Setup Required',
          detail: openAITextReadiness.isReady
            ? 'Server-side AI generation is configured. quota or quota issues can still temporarily block generation.'
            : openAITextReadiness.message,
        },
        {
          key: 'meta',
          label: 'Meta Ads / Instagram & Facebook',
          status: metaEnvConfigured ? 'Ready' : 'Setup Required',
          detail: metaEnvConfigured
            ? 'Meta OAuth foundation is configured server-side. Workspace connection is checked after workspace selection.'
            : 'Meta provider setup still needs META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.',
        },
        {
          key: 'google_ads',
          label: 'Google Ads',
          status: googleAdsReadiness.isConfigured ? 'Draft-only' : 'Setup Required',
          detail: googleAdsReadiness.isConfigured
            ? 'Google Ads stays draft-only until developer token/basic access is fully approved.'
            : `Google Ads setup still needs: ${formatEnvList(googleAdsReadiness.missingEnvironmentVariables)}.`,
        },
        {
          key: 'pinterest',
          label: 'Pinterest',
          status: pinterestReadiness.isConfigured ? 'Draft-only' : 'Setup Required',
          detail: pinterestReadiness.isConfigured
            ? 'Pinterest draft planning is available, but send remains disabled in this phase.'
            : `Pinterest setup still needs: ${formatEnvList(pinterestReadiness.missingEnvironmentVariables)}.`,
        },
        {
          key: 'linkedin_planner',
          label: 'LinkedIn Planner',
          status: 'Manual Mode',
          detail: 'LinkedIn stays planner-only with copy-ready text. No OAuth or publishing API is enabled.',
        },
      ],
      aiTextProvider: {
        ...buildAITextProviderReadinessState({
          activeProvider: aiTextProviderConfig.activeProvider,
          openaiReady: openAITextReadiness.isReady,
          openaiMessage: openAITextReadiness.message,
          nvidiaMessage: nvidiaTextReadiness.message,
          nvidiaDiagnostic,
        }),
      },
    };
  }

  const workspaceId = workspaceResult.data.id;
  const [metaConnectionResult, googleAdsConnectionResult, pinterestPublishingReadiness] = await Promise.all([
    getMetaConnectionStatus(workspaceId, user.id),
    getGoogleAdsConnectionStatus(workspaceId, user.id),
    getPinterestPublishingReadiness({ workspaceId, userId: user.id }),
  ]);

  const metaStatus =
    !metaEnvConfigured
      ? 'Setup Required'
      : metaConnectionResult.data.status === 'connected'
        ? 'Ready'
        : 'Setup Required';

  const metaDetail = !metaEnvConfigured
    ? 'Meta provider setup still needs META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.'
    : metaConnectionResult.data.status === 'connected'
      ? 'Meta read-only tracking is connected for this workspace.'
      : 'Meta OAuth foundation is configured, but this workspace still needs a Meta connection for tracking.';

  const googleAdsStatus =
    !googleAdsReadiness.isConfigured
      ? 'Setup Required'
      : googleAdsConnectionResult.data.status === 'connected'
        ? 'External Approval Pending'
        : 'Setup Required';

  const googleAdsDetail = !googleAdsReadiness.isConfigured
    ? `Google Ads setup still needs: ${formatEnvList(googleAdsReadiness.missingEnvironmentVariables)}.`
    : googleAdsConnectionResult.data.status === 'connected'
      ? 'Google Ads OAuth is connected, but campaign send stays disabled until developer token/basic access is approved.'
      : 'Google Ads OAuth foundation is configured, but this workspace still needs a Google Ads connection. Even after connect, campaign send stays draft-only.';

  return {
    items: [
      {
        key: 'openai',
        label: 'OpenAI',
        status: openAITextReadiness.isReady ? 'Ready' : 'Setup Required',
        detail: openAITextReadiness.isReady
          ? 'Server-side AI generation is configured. quota or quota issues can still temporarily block generation until OpenAI usage is restored.'
          : openAITextReadiness.message,
      },
      {
        key: 'meta',
        label: 'Meta Ads / Instagram & Facebook',
        status: metaStatus,
        detail: metaDetail,
      },
      {
        key: 'google_ads',
        label: 'Google Ads',
        status: googleAdsStatus,
        detail: googleAdsDetail,
      },
      {
        key: 'pinterest',
        label: 'Pinterest',
        status: pinterestPublishingReadiness.state === 'ready' ? 'Ready' : 'Setup Required',
        detail: pinterestReadiness.isConfigured
          ? pinterestPublishingReadiness.message
          : `Pinterest setup still needs: ${formatEnvList(pinterestReadiness.missingEnvironmentVariables)}.`,
      },
      {
        key: 'linkedin_planner',
        label: 'LinkedIn Planner',
        status: 'Manual Mode',
        detail: 'LinkedIn stays planner-only with copy-ready text. No OAuth or publishing API is enabled.',
      },
    ],
    aiTextProvider: {
      ...buildAITextProviderReadinessState({
        activeProvider: aiTextProviderConfig.activeProvider,
        openaiReady: openAITextReadiness.isReady,
        openaiMessage: openAITextReadiness.message,
        nvidiaMessage: nvidiaTextReadiness.message,
        nvidiaDiagnostic,
      }),
    },
  };
}

export async function getProviderSetupWizardAction(): Promise<ProviderSetupWizardState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      generatedAt: new Date().toISOString(),
      summary: {
        ready: 0,
        missingSetup: 0,
        approvalPending: 0,
        manualOnly: 0,
        criticalBlockers: 0,
        total: 0,
      },
      nextBestAction: {
        title: 'Sign in to review provider setup.',
        detail: context.error ?? 'Provider setup could not be loaded.',
        providerKey: null,
        href: null,
      },
      providers: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  const workspaceId = context.workspace.id;
  const userId = context.user.id;

  const [
    metaSettings,
    pinterestSettings,
    googleConnectionResult,
    storageReadiness,
    routeExists,
    vercelCronStatus,
    recentAttemptsResult,
    projectsResult,
  ] = await Promise.all([
    getMetaConnectionSettingsAction(),
    getPinterestConnectionSettingsAction(),
    getGoogleAdsConnectionStatus(workspaceId, userId),
    checkCreativeAssetsStorageReadiness(supabase, workspaceId),
    schedulerRouteFileExists(),
    readVercelCronStatus(),
    supabase
      .from('content_studio_publish_attempts')
      .select('provider, status, error_message, updated_at')
      .eq('workspace_id', workspaceId)
      .not('error_message', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(30),
    listProjectsForWorkspace(workspaceId, supabase),
  ]);

  const recentAttempts = recentAttemptsResult.data ?? [];
  const lastErrorForProvider = (
    provider: 'meta' | 'google_ads' | 'pinterest' | 'linkedin'
  ) =>
    safeErrorMessage(
      recentAttempts.find((attempt) => attempt.provider === provider)?.error_message ?? null
    );

  const openAITextReadiness = checkOpenAITextProviderReadiness();
  const openAIImageReadiness = checkOpenAIImageReadiness();
  const nvidiaReadiness = checkNvidiaTextProviderReadiness();
  const aiTextProviderConfig = getAITextProviderConfig();
  const nvidiaDiagnostic = await testNvidiaTextProviderConnection();
  const googleConfig = getGoogleAdsConfigReadiness();
  const pinterestConfig = getPinterestConfigReadiness();
  const schedulerReadiness = getContentStudioSchedulerReadiness();
  const githubReadiness = getGitHubReadiness();
  const githubLinkedProjects = projectsResult.data.filter((project) => {
    const metadata = normalizeProjectMetadata(project.metadata);
    return Boolean(project.github_url || (metadata.github.owner && metadata.github.repo));
  }).length;

  const openAIChecklist: ProviderSetupCheckItem[] = [
    envCheck('OPENAI_API_KEY', 'OPENAI_API_KEY'),
    {
      label: 'Text generation',
      status: openAITextReadiness.isReady ? 'present' : 'missing',
      explanation: openAITextReadiness.message,
      nextAction: openAITextReadiness.isReady
        ? 'No action needed.'
        : 'Add OPENAI_API_KEY in Vercel and redeploy.',
    },
    {
      label: 'Image generation',
      status: openAIImageReadiness.isReady ? 'present' : 'missing',
      explanation: openAIImageReadiness.message,
      nextAction: openAIImageReadiness.isReady
        ? 'No action needed.'
        : 'Add OPENAI_API_KEY and confirm image generation access.',
    },
    {
      label: 'quota / quota',
      status: 'needs_review',
      explanation: 'quota and quota are only known after provider responses report a limit issue.',
      nextAction: 'Review OpenAI quota and usage limits if generation fails.',
    },
  ];

  const nvidiaChecklist: ProviderSetupCheckItem[] = [
    envCheck('NVIDIA_API_KEY', 'NVIDIA_API_KEY'),
    {
      label: 'NVIDIA_BASE_URL',
      status: nvidiaDiagnostic.baseUrlStatus === 'present' ? 'present' : 'missing',
      explanation: `NVIDIA base URL is ${nvidiaDiagnostic.baseUrlStatus}.`,
      nextAction: nvidiaDiagnostic.baseUrlStatus === 'present'
        ? 'No action needed.'
        : 'Set NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1 and redeploy.',
    },
    {
      label: 'NVIDIA_MODEL',
      status: nvidiaDiagnostic.modelStatus === 'present' ? 'present' : 'missing',
      explanation: `Model configured: ${nvidiaDiagnostic.model}.`,
      nextAction: nvidiaDiagnostic.modelStatus === 'present'
        ? 'No action needed.'
        : 'Set NVIDIA_MODEL=minimaxai/minimax-m2.7 and redeploy.',
    },
    {
      label: 'AI_TEXT_PROVIDER',
      status:
        aiTextProviderConfig.activeProvider === 'auto' ||
        aiTextProviderConfig.activeProvider === 'nvidia'
          ? 'present'
          : 'needs_review',
      explanation: `Current text provider mode: ${aiTextProviderConfig.activeProvider}.`,
      nextAction:
        aiTextProviderConfig.activeProvider === 'auto' ||
        aiTextProviderConfig.activeProvider === 'nvidia'
          ? 'No action needed.'
          : 'Set AI_TEXT_PROVIDER=auto if NVIDIA should be used as fallback.',
    },
    {
      label: 'Last NVIDIA test',
      status:
        nvidiaDiagnostic.lastTestStatus === 'ok'
          ? 'present'
          : nvidiaDiagnostic.errorCategory === 'rate_limited'
            ? 'needs_review'
            : 'error',
      explanation: `Last test status: ${nvidiaDiagnostic.lastTestStatus}${nvidiaDiagnostic.responseStatusCode ? ` (${nvidiaDiagnostic.responseStatusCode})` : ''}${nvidiaDiagnostic.errorCategory ? ` - ${nvidiaDiagnostic.errorCategory}` : ''}. Path: ${nvidiaDiagnostic.requestPath}.${nvidiaDiagnostic.safeProviderMessage ? ` Message: ${nvidiaDiagnostic.safeProviderMessage}` : ''}`,
      nextAction:
        nvidiaDiagnostic.lastTestStatus === 'ok'
          ? 'No action needed.'
          : 'Review NVIDIA key permissions, model access, quota, and endpoint settings.',
    },
  ];

  const metaEnvChecks: ProviderSetupCheckItem[] = [
    envCheck('META_APP_ID', 'META_APP_ID'),
    envCheck('META_APP_SECRET', 'META_APP_SECRET'),
    envCheck('META_REDIRECT_URI', 'META_REDIRECT_URI'),
    optionalEnvReview(
      'META_GRAPH_API_VERSION',
      'META_GRAPH_API_VERSION',
      'META_GRAPH_API_VERSION is not set. The app uses its default Graph API version.'
    ),
    envCheck('AD_TOKEN_ENCRYPTION_KEY', 'AD_TOKEN_ENCRYPTION_KEY'),
  ];
  const metaConnectionReady = metaSettings.status === 'connected';
  const metaChecklist: ProviderSetupCheckItem[] = [
    ...metaEnvChecks,
    {
      label: 'Meta OAuth connection',
      status: metaConnectionReady ? 'present' : 'missing',
      explanation: metaConnectionReady
        ? 'Meta OAuth connection is active for this workspace.'
        : 'Meta OAuth connection is missing, expired, revoked, or unavailable.',
      nextAction: metaConnectionReady
        ? 'No action needed.'
        : 'Connect or reconnect Meta from Settings.',
    },
    {
      label: 'Granted organic scopes',
      status: metaSettings.missingOrganicScopes.length === 0 ? 'present' : 'missing',
      explanation:
        metaSettings.missingOrganicScopes.length === 0
          ? 'Required Facebook Page and Instagram organic publishing scopes are present.'
          : `Missing scopes: ${metaSettings.missingOrganicScopes.join(', ')}.`,
      nextAction:
        metaSettings.missingOrganicScopes.length === 0
          ? 'No action needed.'
          : 'Request required Meta permissions and reconnect the account.',
    },
    {
      label: 'Selected Facebook Page',
      status: metaSettings.selectedFacebookPageId ? 'present' : 'missing',
      explanation: metaSettings.selectedFacebookPageName
        ? `Selected page: ${metaSettings.selectedFacebookPageName}.`
        : 'No Facebook Page is selected for organic posts.',
      nextAction: metaSettings.selectedFacebookPageId
        ? 'No action needed.'
        : 'Select a Facebook Page in the Meta connection card.',
    },
    {
      label: 'Selected Instagram Business Account',
      status: metaSettings.selectedInstagramBusinessAccountId ? 'present' : 'missing',
      explanation: metaSettings.selectedInstagramUsername
        ? `Selected Instagram account: @${metaSettings.selectedInstagramUsername}.`
        : 'No Instagram Business Account is selected for organic posts and Reels.',
      nextAction: metaSettings.selectedInstagramBusinessAccountId
        ? 'No action needed.'
        : 'Select an Instagram Business Account in the Meta connection card.',
    },
    {
      label: 'Selected Meta Ad Account',
      status: metaSettings.selectedMetaAdAccountId ? 'present' : 'needs_review',
      explanation: metaSettings.selectedMetaAdAccountName
        ? `Selected ad account: ${metaSettings.selectedMetaAdAccountName}.`
        : 'Only required when paused Meta paid ad draft support is used.',
      nextAction: metaSettings.selectedMetaAdAccountId
        ? 'No action needed.'
        : 'Select a Meta Ad Account before using paid ad drafts.',
    },
    {
      label: 'ads_management permission',
      status: metaSettings.grantedScopes.includes('ads_management') ? 'present' : 'needs_review',
      explanation: metaSettings.grantedScopes.includes('ads_management')
        ? 'ads_management scope is present for paused paid ad draft flows.'
        : 'Only required for paused Meta paid ad draft creation; organic publishing does not need it.',
      nextAction: metaSettings.grantedScopes.includes('ads_management')
        ? 'No action needed.'
        : 'Request ads_management only if paused paid ad drafts are intentionally enabled.',
    },
  ];
  const metaStatus = !metaConnectionReady
    ? 'token_missing'
    : metaSettings.missingOrganicScopes.length > 0
      ? 'permission_missing'
      : providerStatusFromChecklist(metaChecklist);

  const googleConnection = googleConnectionResult.data;
  const googleEnvChecks = [
    envCheck('GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_ID'),
    envCheck('GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_CLIENT_SECRET'),
    envCheck('GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_DEVELOPER_TOKEN'),
    envCheck('GOOGLE_ADS_REDIRECT_URI', 'GOOGLE_ADS_REDIRECT_URI'),
    optionalEnvReview(
      'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
      'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
      'No login customer ID is configured. Some manager-account setups require it.'
    ),
    optionalEnvReview(
      'GOOGLE_ADS_API_VERSION',
      'GOOGLE_ADS_API_VERSION',
      'GOOGLE_ADS_API_VERSION is not set. The app uses its default Google Ads API version.'
    ),
  ];
  const googleChecklist: ProviderSetupCheckItem[] = [
    ...googleEnvChecks,
    {
      label: 'OAuth connection',
      status: googleConnection.status === 'connected' ? 'present' : 'missing',
      explanation:
        googleConnection.status === 'connected'
          ? 'Google Ads OAuth connection is active for this workspace.'
          : 'Google Ads OAuth connection is missing or unavailable.',
      nextAction:
        googleConnection.status === 'connected'
          ? 'No action needed.'
          : 'Connect Google Ads OAuth from Campaigns.',
    },
    {
      label: 'Refresh token',
      status: googleConnection.status === 'connected' ? 'present' : 'missing',
      explanation:
        googleConnection.status === 'connected'
          ? 'Refresh token is stored encrypted server-side. The value is not shown.'
          : 'A Google Ads refresh token is required for provider calls.',
      nextAction:
        googleConnection.status === 'connected'
          ? 'No action needed.'
          : 'Reconnect Google Ads OAuth.',
    },
    {
      label: 'Customer ID',
      status: isEnvPresent('GOOGLE_ADS_LOGIN_CUSTOMER_ID') ? 'present' : 'needs_review',
      explanation: isEnvPresent('GOOGLE_ADS_LOGIN_CUSTOMER_ID')
        ? 'A login customer ID is configured server-side. The value is not shown.'
        : 'Customer IDs are item/customer specific. Review Campaigns before creating drafts.',
      nextAction: isEnvPresent('GOOGLE_ADS_LOGIN_CUSTOMER_ID')
        ? 'No action needed.'
        : 'Open Campaigns, verify accessible customers, and set item customer metadata when needed.',
    },
    {
      label: 'Developer token / API approval',
      status: googleConfig.isConfigured ? 'approval_pending' : 'missing',
      explanation: googleConfig.isConfigured
        ? 'Developer token presence is detected, but external API approval cannot be confirmed from env alone.'
        : `Missing Google Ads env vars: ${formatEnvList(googleConfig.missingEnvironmentVariables)}.`,
      nextAction: googleConfig.isConfigured
        ? 'Wait for Google Ads developer token/basic access approval if draft creation is blocked.'
        : 'Add missing Google Ads environment variables and redeploy.',
    },
  ];
  const googleStatus = !googleConfig.isConfigured
    ? 'setup_required'
    : googleConnection.status !== 'connected'
      ? 'token_missing'
      : 'approval_pending';

  const pinterestConnectionReady = pinterestSettings.status === 'connected';
  const pinterestChecklist: ProviderSetupCheckItem[] = [
    envCheck(
      'PINTEREST_APP_ID or PINTEREST_CLIENT_ID',
      isEnvPresent('PINTEREST_APP_ID') ? 'PINTEREST_APP_ID' : 'PINTEREST_CLIENT_ID'
    ),
    envCheck('PINTEREST_APP_SECRET', 'PINTEREST_APP_SECRET'),
    envCheck('PINTEREST_REDIRECT_URI', 'PINTEREST_REDIRECT_URI'),
    {
      label: 'Pinterest OAuth connection',
      status: pinterestConnectionReady ? 'present' : 'missing',
      explanation: pinterestConnectionReady
        ? 'Pinterest OAuth connection is active for this workspace.'
        : 'Pinterest OAuth connection is missing, expired, revoked, or unavailable.',
      nextAction: pinterestConnectionReady
        ? 'No action needed.'
        : 'Connect or reconnect Pinterest from Settings.',
    },
    {
      label: 'Access token validity',
      status: pinterestSettings.tokenStatus === 'valid' ? 'present' : 'missing',
      explanation: `Pinterest token status: ${pinterestSettings.tokenStatus.replace(/_/g, ' ')}.`,
      nextAction:
        pinterestSettings.tokenStatus === 'valid'
          ? 'No action needed.'
          : 'Reconnect Pinterest OAuth.',
    },
    {
      label: 'Selected board',
      status: pinterestSettings.selectedBoardId ? 'present' : 'missing',
      explanation: pinterestSettings.selectedBoardName
        ? `Selected board: ${pinterestSettings.selectedBoardName}.`
        : 'No Pinterest board is selected for Pin publishing.',
      nextAction: pinterestSettings.selectedBoardId
        ? 'No action needed.'
        : 'Select a Pinterest board in the Pinterest connection card.',
    },
    {
      label: 'Pin publishing scopes',
      status: pinterestSettings.missingScopes.length === 0 ? 'present' : 'missing',
      explanation:
        pinterestSettings.missingScopes.length === 0
          ? 'Pinterest scopes are present for the connected account.'
          : `Missing scopes: ${pinterestSettings.missingScopes.join(', ')}.`,
      nextAction:
        pinterestSettings.missingScopes.length === 0
          ? 'No action needed.'
          : 'Reconnect Pinterest after requesting required scopes.',
    },
  ];
  const pinterestStatus = !pinterestConfig.isConfigured
    ? 'setup_required'
    : !pinterestConnectionReady
      ? 'token_missing'
      : !pinterestSettings.selectedBoardId
        ? 'board_missing'
        : providerStatusFromChecklist(pinterestChecklist);

  const linkedinChecklist: ProviderSetupCheckItem[] = [
    {
      label: 'LinkedIn publishing mode',
      status: 'manual_only',
      explanation: 'LinkedIn is currently copy-ready/manual planner only.',
      nextAction: 'Use Copy LinkedIn Package from Content Studio.',
    },
    {
      label: 'Future OAuth integration',
      status: 'manual_only',
      explanation: 'No LinkedIn OAuth or publishing API flow is enabled in this phase.',
      nextAction: 'Plan a future LinkedIn OAuth implementation if needed.',
    },
  ];

  const githubChecklist: ProviderSetupCheckItem[] = [
    {
      label: 'GITHUB_TOKEN',
      status: githubReadiness.tokenPresent ? 'present' : 'missing',
      explanation: githubReadiness.tokenPresent
        ? 'GITHUB_TOKEN is present server-side. The value is not shown.'
        : 'GITHUB_TOKEN is missing. Live repository data will not load.',
      nextAction: githubReadiness.tokenPresent
        ? 'No action needed.'
        : 'Add a fine-grained read-only GITHUB_TOKEN in Vercel and redeploy.',
    },
    {
      label: 'Read-only access',
      status: githubReadiness.tokenPresent ? 'needs_review' : 'missing',
      explanation: githubReadiness.tokenPresent
        ? 'Confirm the GitHub token is fine-grained and read-only for repository metadata, issues, pull requests, and commits.'
        : 'A read-only token is recommended before enabling live GitHub repository views.',
      nextAction: 'Use the least privileged GitHub token possible.',
    },
    {
      label: 'Linked project repositories',
      status: githubLinkedProjects > 0 ? 'present' : 'needs_review',
      explanation:
        githubLinkedProjects > 0
          ? `${githubLinkedProjects} project(s) have GitHub repository metadata.`
          : 'No projects have GitHub repository metadata yet.',
      nextAction:
        githubLinkedProjects > 0
          ? 'Open a project to view read-only repository data.'
          : 'Add a GitHub repository URL to a project.',
    },
  ];

  const schedulerChecklist: ProviderSetupCheckItem[] = [
    {
      label: 'CRON_SECRET',
      status: schedulerReadiness.cronSecretConfigured ? 'present' : 'missing',
      explanation: schedulerReadiness.message,
      nextAction: schedulerReadiness.cronSecretConfigured
        ? 'No action needed.'
        : 'Add CRON_SECRET in Vercel and redeploy.',
    },
    {
      label: CONTENT_STUDIO_SCHEDULER_ROUTE_PATH,
      status: routeExists ? 'present' : 'missing',
      explanation: routeExists
        ? 'Scheduler cron route exists in the app router.'
        : 'Scheduler cron route file was not found.',
      nextAction: routeExists
        ? 'No action needed.'
        : 'Restore the scheduler cron route before enabling Vercel Cron.',
    },
    {
      label: 'vercel.json cron',
      status: vercelCronStatus.exists ? 'present' : 'missing',
      explanation: vercelCronStatus.exists
        ? `Vercel Cron is configured with schedule ${vercelCronStatus.schedule}.`
        : 'Vercel Cron entry was not found.',
      nextAction: vercelCronStatus.exists
        ? 'No action needed.'
        : 'Add the content studio scheduler cron to vercel.json.',
    },
    {
      label: 'Hobby daily schedule',
      status: vercelCronStatus.dailyHobbySchedule ? 'present' : 'needs_review',
      explanation: vercelCronStatus.dailyHobbySchedule
        ? 'Schedule matches 0 9 * * * for Vercel Hobby daily cron.'
        : 'Schedule does not match the requested daily Hobby plan schedule.',
      nextAction: vercelCronStatus.dailyHobbySchedule
        ? 'No action needed.'
        : 'Review whether this project should use 0 9 * * *.',
    },
    {
      label: 'Manual admin scheduler control',
      status: (await dashboardSchedulerButtonFileExists())
        ? 'present'
        : 'needs_review',
      explanation: 'Manager Command Center exposes the existing manual scheduler route for admins.',
      nextAction: 'Use Run Scheduler Now from the dashboard when available.',
    },
    {
      label: 'Recent scheduler attempts',
      status: 'needs_review',
      explanation: 'Recent scheduler runs are summarized through publish attempts and item execution status.',
      nextAction: 'Open Reports for execution summaries after scheduled content runs.',
    },
  ];

  const storageChecklist: ProviderSetupCheckItem[] = [
    {
      label: 'creative-assets bucket',
      status: storageReadiness.isConfigured ? 'present' : 'missing',
      explanation: storageReadiness.message,
      nextAction: storageReadiness.isConfigured
        ? 'No action needed.'
        : 'Create the creative-assets bucket and apply storage policies.',
    },
    {
      label: 'Image upload readiness',
      status: storageReadiness.isConfigured ? 'present' : 'needs_review',
      explanation: storageReadiness.isConfigured
        ? 'Storage bucket is reachable from the current workspace session.'
        : 'Upload readiness cannot be verified until the bucket is reachable.',
      nextAction: storageReadiness.isConfigured
        ? 'Upload a test image from Creative Assets if needed.'
        : 'Create bucket and policies, then test an upload.',
    },
    {
      label: 'Video upload readiness',
      status: storageReadiness.isConfigured ? 'needs_review' : 'missing',
      explanation:
        'Video support depends on upload size, storage policy, and public media URL readiness.',
      nextAction: 'Upload a test Reel video and verify it has a public HTTPS URL.',
    },
    {
      label: 'Public media URL readiness',
      status: storageReadiness.isConfigured ? 'needs_review' : 'missing',
      explanation:
        'Provider publishing requires public HTTPS media URLs. This wizard does not expose URLs.',
      nextAction: 'Use Creative Assets to verify public URL generation for selected assets.',
    },
  ];

  const providers: ProviderSetupWizardProvider[] = [
    buildProvider({
      key: 'openai',
      name: 'OpenAI',
      description: 'AI text and image generation readiness.',
      status: openAITextReadiness.isReady ? 'ready' : 'setup_required',
      checklist: openAIChecklist,
      safeLastError: null,
      primaryActionLabel: openAITextReadiness.isReady ? 'View Details' : 'Fix Env',
      primaryActionHref: null,
    }),
    buildProvider({
      key: 'nvidia',
      name: 'NVIDIA',
      description: `NVIDIA text generation readiness. AI_TEXT_PROVIDER=${aiTextProviderConfig.activeProvider}.`,
      status: getNvidiaProviderSetupStatus({
        keyStatus: nvidiaDiagnostic.keyStatus,
        baseUrlStatus: nvidiaDiagnostic.baseUrlStatus,
        modelStatus: nvidiaDiagnostic.modelStatus,
        lastTestStatus: nvidiaDiagnostic.lastTestStatus,
        errorCategory: nvidiaDiagnostic.errorCategory,
      }),
      checklist: nvidiaChecklist,
      safeLastError: nvidiaDiagnostic.safeProviderMessage ?? nvidiaDiagnostic.errorCategory,
      primaryActionLabel: nvidiaReadiness.isReady ? 'View Details' : 'Fix Env',
      primaryActionHref: null,
    }),
    buildProvider({
      key: 'meta',
      name: 'Meta / Instagram / Facebook',
      description: 'Organic publishing targets and paused paid draft prerequisites.',
      status: metaStatus,
      checklist: metaChecklist,
      safeLastError: safeErrorMessage(metaSettings.error) ?? lastErrorForProvider('meta'),
      primaryActionLabel: metaConnectionReady ? 'View Details' : 'Connect Meta',
      primaryActionHref: metaConnectionReady ? null : '/api/ads/meta/connect?returnTo=settings',
    }),
    buildProvider({
      key: 'google_ads',
      name: 'Google Ads',
      description: 'OAuth, customer access, and paused campaign draft approval status.',
      status: googleStatus,
      checklist: googleChecklist,
      safeLastError: googleConnectionResult.error ?? lastErrorForProvider('google_ads'),
      primaryActionLabel:
        googleConnection.status === 'connected' ? 'View Details' : 'Connect Google Ads',
      primaryActionHref:
        googleConnection.status === 'connected'
          ? null
          : '/api/ads/google/connect?returnTo=campaigns',
    }),
    buildProvider({
      key: 'pinterest',
      name: 'Pinterest',
      description: 'Organic Pin publishing setup and selected board readiness.',
      status: pinterestStatus,
      checklist: pinterestChecklist,
      safeLastError: safeErrorMessage(pinterestSettings.error) ?? lastErrorForProvider('pinterest'),
      primaryActionLabel: pinterestConnectionReady ? 'View Details' : 'Connect Pinterest',
      primaryActionHref: pinterestConnectionReady
        ? null
        : '/api/ads/pinterest/connect?returnTo=settings',
    }),
    buildProvider({
      key: 'linkedin',
      name: 'LinkedIn',
      description: 'Manual planner and copy-ready workflow.',
      status: 'manual_only',
      checklist: linkedinChecklist,
      safeLastError: null,
      primaryActionLabel: 'Open LinkedIn Planner',
      primaryActionHref: '/dashboard/content-studio?tab=linkedin',
    }),
    buildProvider({
      key: 'github',
      name: 'GitHub Integration',
      description: 'Read-only repository visibility for projects, releases, issues, commits, and pull requests.',
      status: githubReadiness.tokenPresent ? 'ready' : 'setup_required',
      checklist: githubChecklist,
      safeLastError: projectsResult.error,
      primaryActionLabel: githubLinkedProjects > 0 ? 'Open Projects' : 'Link Repository',
      primaryActionHref: '/dashboard/projects',
    }),
    buildProvider({
      key: 'scheduler',
      name: 'Scheduler',
      description: 'Secure cron and manual scheduler readiness.',
      status: providerStatusFromChecklist(schedulerChecklist),
      checklist: schedulerChecklist,
      safeLastError: null,
      primaryActionLabel: 'Open Reports',
      primaryActionHref: '/dashboard/reports',
    }),
    buildProvider({
      key: 'supabase_storage',
      name: 'Supabase Storage',
      description: 'Creative Assets bucket and public media URL readiness.',
      status: providerStatusFromChecklist(storageChecklist),
      checklist: storageChecklist,
      safeLastError: null,
      primaryActionLabel: 'Open Creative Assets',
      primaryActionHref: '/dashboard/creative-assets',
    }),
  ];

  const summary = {
    ready: providers.filter((provider) => provider.status === 'ready').length,
    missingSetup: providers.filter((provider) =>
      ['setup_required', 'token_missing', 'permission_missing', 'customer_id_missing', 'board_missing', 'error'].includes(
        provider.status
      )
    ).length,
    approvalPending: providers.filter((provider) => provider.status === 'approval_pending').length,
    manualOnly: providers.filter((provider) => provider.status === 'manual_only').length,
    criticalBlockers: providers.filter((provider) =>
      ['setup_required', 'token_missing', 'permission_missing', 'error'].includes(provider.status)
    ).length,
    total: providers.length,
  };

  const blockerPriority: ProviderSetupStatus[] = [
    'error',
    'setup_required',
    'token_missing',
    'permission_missing',
    'board_missing',
    'customer_id_missing',
    'approval_pending',
    'quota_limit',
    'credits_required',
    'needs_review',
  ];
  const nextProvider =
    blockerPriority
      .map((status) => providers.find((provider) => provider.status === status))
      .find((provider): provider is ProviderSetupWizardProvider => Boolean(provider)) ?? null;
  const nextMissingCheck = nextProvider?.checklist.find((item) =>
    ['missing', 'approval_pending', 'needs_review', 'error'].includes(item.status)
  );

  return {
    error: null,
    generatedAt: new Date().toISOString(),
    summary,
    nextBestAction: nextProvider
      ? {
          title: nextMissingCheck?.nextAction ?? `Review ${nextProvider.name}.`,
          detail: nextMissingCheck?.explanation ?? nextProvider.description,
          providerKey: nextProvider.key,
          href: nextProvider.primaryActionHref,
        }
      : {
          title: 'Provider setup is in good shape.',
          detail: 'Review any needs-review items before high-volume production use.',
          providerKey: null,
          href: null,
        },
    providers,
  };
}
