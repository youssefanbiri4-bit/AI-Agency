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
  permissionsMatrix,
  type StrictWorkspaceRole,
} from '@/lib/permissions-matrix';
import { normalizeWorkspaceRole } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { normalizeBrandKit } from '@/lib/data/brand-kit';
import type { WorkspaceBranding } from '@/lib/data/branding';
import {
  defaultWorkspaceTheme,
  normalizeWorkspaceTheme,
  sanitizeHexColor,
  sanitizeThemeNumber,
  type ThemeBackgroundMode,
  type ThemeCardStyle,
  type WorkspaceTheme,
} from '@/lib/theme';
import { CONTENT_STUDIO_SCHEDULER_ROUTE_PATH } from '@/lib/content-studio/scheduler';

export { CONTENT_STUDIO_SCHEDULER_ROUTE_PATH };
import type { JsonObject } from '@/types';
import type { BrandKit } from '@/types/brand-kit';
import type { AITextProvider } from '@/lib/ai/text-provider';
import type { PinterestBoardOption } from '@/lib/ads/pinterest-publishing';
import type { MetaPublishingPageOption } from '@/lib/ads/meta-publishing';
import type { MetaAdAccountCampaignsData } from '@/lib/data/ad-connections';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

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
    openaiMessage: string;
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const disconnectedMetaSettings: MetaConnectionSettingsState = {
  error: null,
  status: 'not_connected',
  connectedAt: null,
  updatedAt: null,
  tokenExpiresAt: null,
  grantedScopes: [],
  requiredOrganicScopes: [],
  missingOrganicScopes: [],
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

export const disconnectedPinterestSettings: PinterestConnectionSettingsState = {
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

export const LOGO_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const LOGO_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const LOGO_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
export const THEME_BACKGROUND_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const THEME_BACKGROUND_ALLOWED_TYPES = LOGO_ALLOWED_TYPES;

// ---------------------------------------------------------------------------
// Shared Helper Functions
// ---------------------------------------------------------------------------

export function buildAITextProviderReadinessState(input: {
  activeProvider: AITextProvider;
  openaiReady: boolean;
  openaiMessage: string;
}): ProviderReadinessState['aiTextProvider'] {
  return {
    activeProvider: input.activeProvider,
    openaiStatus: input.openaiReady ? 'ready' : 'setup_required',
    openaiMessage: input.openaiMessage,
  };
}

export async function getSettingsWorkspaceContext() {
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

export async function denySettingsAction(context: Awaited<ReturnType<typeof getSettingsWorkspaceContext>>, message: string) {
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

export async function countMembersForSettings(workspaceId: string) {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from('workspace_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  return error ? null : count;
}

export function formatEnvList(envVars: string[]) {
  return envVars.length > 0 ? envVars.join(', ') : 'provider environment variables';
}

export function isEnvPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function envCheck(label: string, envName: string, presentDetail?: string): ProviderSetupCheckItem {
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

export function optionalEnvReview(label: string, envName: string, detail: string): ProviderSetupCheckItem {
  const present = isEnvPresent(envName);

  return {
    label,
    status: present ? 'present' : 'needs_review',
    explanation: present ? `${envName} is present server-side. The value is not shown.` : detail,
    nextAction: present ? 'No action needed.' : `Review whether ${envName} should be set for this workspace.`,
  };
}

export function checklistProgress(checklist: ProviderSetupCheckItem[]) {
  const present = checklist.filter((item) => item.status === 'present').length;
  const total = checklist.length;

  return { present, total };
}

export function titleCaseStatus(status: ProviderSetupStatus) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function providerStatusFromChecklist(
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

export function buildProvider(input: Omit<ProviderSetupWizardProvider, 'statusLabel'>) {
  const progress = checklistProgress(input.checklist);

  return {
    ...input,
    statusLabel: `${titleCaseStatus(input.status)} · ${progress.present}/${progress.total}`,
  };
}

export function safeErrorMessage(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return normalized.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]').slice(0, 240);
}

export async function schedulerRouteFileExists() {
  try {
    await access('src/app/api/cron/content-studio-scheduler/route.ts');
    return true;
  } catch {
    return false;
  }
}

export async function dashboardSchedulerButtonFileExists() {
  try {
    await access('src/app/(dashboard)/dashboard/DashboardSchedulerButton.tsx');
    return true;
  } catch {
    return false;
  }
}

export async function readVercelCronStatus() {
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

export function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function emptyToNull(value: string) {
  return value.length > 0 ? value : null;
}

export function readPositiveNumberField(formData: FormData, key: string) {
  const value = Number(readField(formData, key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function readMultiValueField(formData: FormData, key: string) {
  return readField(formData, key)
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function readBrandKitFormData(formData: FormData): BrandKit {
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

export function readMetadataString(metadata: JsonObject, key: string) {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readOptionalFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

export function safeLogoStorageFileName(file: File) {
  const extension = LOGO_EXTENSIONS[file.type] ?? 'png';
  const baseName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `${Date.now()}-${baseName || 'logo'}.${extension}`;
}

export function safeThemeBackgroundStorageFileName(file: File) {
  const extension = LOGO_EXTENSIONS[file.type] ?? 'png';
  const baseName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `background-${Date.now()}-${baseName || 'theme'}.${extension}`;
}

export function readThemeFormData(formData: FormData): WorkspaceTheme {
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
