'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BookMarked, Building2, Check, Database, DatabaseBackup, Film, Globe2, Image as ImageIcon, LogOut, ShieldCheck, SlidersHorizontal, Sparkles, Workflow } from 'lucide-react';
import { isSupabaseConfigured, logout, supabase } from '@/lib/supabase-client';
import { reportAppError } from '@/lib/logger';
import { useDashboardContext } from '@/components/layout/DashboardContext';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/FormControls';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import { getIntegrationSettings } from '@/lib/data/workspaces';
import {
  getAIImageGenerationReadinessAction,
  getBrandingSettingsAction,
  getBrandKitSettingsAction,
  getProviderSetupWizardAction,
  getProviderReadinessAction,
  getRolesOverviewAction,
  type AIImageGenerationReadinessState,
  type BrandingSettingsState,
  type BrandKitSettingsState,
  type ProviderSetupWizardState,
  type ProviderReadinessState,
  type RolesOverviewState,
} from './actions';
import { BrandKitSettings } from './BrandKitSettings';
import { LogoBrandingSettings } from './LogoBrandingSettings';
import { MetaConnectionSettings } from './MetaConnectionSettings';
import { PinterestConnectionSettings } from './PinterestConnectionSettings';
import { ProviderSetupWizard } from './ProviderSetupWizard';
import { ThemeAppearanceSettings } from './ThemeAppearanceSettings';
import { RolesPermissionsSection } from './RolesPermissionsSection';
import type { IntegrationSettingsRecord } from '@/types/database';
import { useLanguage } from '@/i18n/context';

const productionLaunchChecklist = [
  'Buy a custom domain',
  'Add the domain in Vercel Project Settings',
  'Configure DNS records',
  'Wait for SSL verification',
  'Update APP_BASE_URL to the custom domain',
  'Update Meta Redirect URI',
  'Update Pinterest Redirect URI',
  'Update Google Ads Redirect URI',
  'Redeploy production',
  'Test login',
  'Test Run Task',
  'Test n8n callback',
  'Test Reports',
  'Test Campaigns and ad platform connections',
] as const;

const settingsSections = [
  { id: 'workspace', labelKey: 'page.settings.workspace' },
  { id: 'brand-kit', labelKey: 'page.settings.brandKit' },
  { id: 'providers', labelKey: 'page.settings.providers' },
  { id: 'publishing-scheduling', labelKey: 'page.settings.publishingScheduling' },
  { id: 'roles-permissions', labelKey: 'page.settings.rolesPermissions' },
  { id: 'security', labelKey: 'page.settings.security' },
  { id: 'backups', labelKey: 'page.settings.backups' },
  { id: 'advanced', labelKey: 'page.settings.advanced' },
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: dashboardUser, workspace } = useDashboardContext();
  const { t } = useLanguage();
  const [userId, setUserId] = useState(dashboardUser.id);
  const [email, setEmail] = useState(dashboardUser.email);
  const [fullName, setFullName] = useState(dashboardUser.fullName);
  const [integrationSettings, setIntegrationSettings] =
    useState<IntegrationSettingsRecord | null>(null);
  const [aiImageReadiness, setAiImageReadiness] =
    useState<AIImageGenerationReadinessState | null>(null);
  const [providerReadiness, setProviderReadiness] =
    useState<ProviderReadinessState | null>(null);
  const [providerSetupWizard, setProviderSetupWizard] =
    useState<ProviderSetupWizardState | null>(null);
  const [brandKitSettings, setBrandKitSettings] =
    useState<BrandKitSettingsState | null>(null);
  const [brandingSettings, setBrandingSettings] =
    useState<BrandingSettingsState | null>(null);
  const [rolesOverview, setRolesOverview] =
    useState<RolesOverviewState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [preferences, setPreferences] = useState({
    taskCompletions: true,
    taskFailures: true,
    weeklySummary: false,
  });

  useEffect(() => {
    let isMounted = true;

    const loadUserData = async () => {
      if (!isSupabaseConfigured) {
        if (isMounted) {
          setError('Supabase profile storage is prepared but not configured for this workspace.');
          setIsLoading(false);
        }
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && isMounted) {
          setUserId(user.id);
          setEmail(user.email || '');
          setFullName(
            typeof user.user_metadata?.full_name === 'string'
              ? user.user_metadata.full_name
              : ''
          );
        }

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', user.id)
            .maybeSingle();

          if (profile && isMounted) {
            setEmail(profile.email || user.email || '');
            setFullName(profile.full_name || '');
          }
        }

        const [
          integrationResult,
          aiImageResult,
          providerReadinessResult,
          providerSetupWizardResult,
          brandKitResult,
          brandingResult,
          rolesResult,
        ] = await Promise.all([
          getIntegrationSettings(supabase, workspace.id),
          getAIImageGenerationReadinessAction(),
          getProviderReadinessAction(),
          getProviderSetupWizardAction(),
          getBrandKitSettingsAction(),
          getBrandingSettingsAction(),
          getRolesOverviewAction(),
        ]);

        if (isMounted) {
          setIntegrationSettings(integrationResult.data);
          setAiImageReadiness(aiImageResult);
          setProviderReadiness(providerReadinessResult);
          setProviderSetupWizard(providerSetupWizardResult);
          setBrandKitSettings(brandKitResult);
          setBrandingSettings(brandingResult);
          setRolesOverview(rolesResult);
        }
      } catch (err) {
        reportAppError('Error fetching user', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadUserData();

    return () => {
      isMounted = false;
    };
  }, [workspace.id]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const savedPreferences = window.localStorage.getItem('ai-agency-preferences');

      if (savedPreferences) {
        try {
          setPreferences(JSON.parse(savedPreferences) as typeof preferences);
        } catch {
          window.localStorage.removeItem('ai-agency-preferences');
        }
      }
    });
  }, []);

  useEffect(() => {
    const pinterestStatus = searchParams.get('pinterest');

    if (pinterestStatus === 'connected') {
      toast.success('Pinterest account connected.');
    }

    if (pinterestStatus === 'setup_required') {
      toast.warning('Pinterest setup required.');
    }

    if (pinterestStatus === 'error') {
      toast.error('Pinterest setup required.');
    }
  }, [searchParams]);

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSaving(true);
    const loadingToastId = toast.loading('Saving settings...');

    if (!isSupabaseConfigured) {
      setError('Profile updates will be available after Supabase environment setup.');
      toast.update(loadingToastId, {
        tone: 'warning',
        title: 'Profile storage is not configured.',
        description: 'Supabase environment setup is still required before saving profile changes.',
      });
      setIsSaving(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });

      if (updateError) throw updateError;

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ full_name: fullName, email })
        .eq('id', userId);

      if (profileUpdateError) throw profileUpdateError;

      setSuccess(true);
      toast.update(loadingToastId, {
        tone: 'success',
        title: 'Settings updated.',
        description: 'Your profile changes were saved.',
      });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      toast.update(loadingToastId, {
        tone: 'error',
        title: 'Could not save settings.',
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out.');
      router.replace('/auth/login?message=Signed out');
      router.refresh();
    } catch (err) {
      reportAppError('Logout error', err);
      toast.error('Could not sign out.', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  };

  const handlePreferenceChange = (key: keyof typeof preferences) => {
    setPreferences((current) => ({
      ...current,
      [key]: !current[key],
    }));
    setPreferencesSaved(false);
  };

  const handleSavePreferences = () => {
    window.localStorage.setItem('ai-agency-preferences', JSON.stringify(preferences));
    setPreferencesSaved(true);
    toast.success('Settings updated.', {
      description: 'Local dashboard preferences were saved in this browser.',
    });
    setTimeout(() => setPreferencesSaved(false), 2500);
  };

  if (isLoading) {
    return <LoadingState title="Loading settings" description="Preparing workspace preferences." />;
  }

  const n8nIsConnected = integrationSettings?.n8n_status === 'connected';
  const n8nStatusLabel = n8nIsConnected ? 'Ready' : 'Not Connected';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace controls"
        title={t('page.settings.title')}
        description={t('page.settings.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/docs" className={buttonStyles({ variant: 'outline' })}>
              <BookMarked className="h-4 w-4" />
              {t('action.openGuide')}
            </Link>
            <Link href="/dashboard/backups" className={buttonStyles({ variant: 'outline' })}>
              <DatabaseBackup className="h-4 w-4" />
              {t('action.backupCenter')}
            </Link>
            <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              {t('action.backToDashboard')}
            </Link>
          </div>
        }
      />

      <nav aria-label="Settings sections" className="rounded-lg border border-[#F7CBCA]/10 bg-white/82 p-3 shadow-sm backdrop-blur-[14px]">
        <div className="flex flex-wrap gap-2">
          {settingsSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-md border border-black/8 bg-[#F1F7F7]/72 px-3 py-2 text-sm font-bold text-black/66 transition hover:border-[#F7CBCA]/24 hover:bg-[#D5E5E5]/62 hover:text-[#F7CBCA] focus:outline-none focus:ring-4 focus:ring-[#F7CBCA]/18"
            >
              {t(section.labelKey)}
            </a>
          ))}
        </div>
      </nav>

      <section id="providers" className="scroll-mt-28 space-y-4">
        <SettingsSectionIntro
          title={t('page.settings.providersCard.title')}
          description={t('page.settings.providersCard.description')}
        />
        <ProviderSetupWizard state={providerSetupWizard} />
      </section>

      <section id="roles-permissions" className="scroll-mt-28 space-y-4">
        <SettingsSectionIntro
          title={t('page.settings.rolesCard.title')}
          description={t('page.settings.rolesCard.description')}
        />
        <RolesPermissionsSection
          currentRole={rolesOverview?.currentRole ?? 'owner'}
          isOwner={rolesOverview?.isOwner ?? true}
          isAdmin={rolesOverview?.isAdmin ?? true}
          memberCount={rolesOverview?.memberCount ?? null}
        />
      </section>

      <section id="brand-kit" className="scroll-mt-28 space-y-4">
        <SettingsSectionIntro
          title={t('page.settings.brandKitCard.title')}
          description={t('page.settings.brandKitCard.description')}
        />
        <ThemeAppearanceSettings />
        <BrandKitSettings initialState={brandKitSettings} />
        <LogoBrandingSettings
          initialState={brandingSettings}
          brandKit={brandKitSettings?.brandKit ?? null}
        />
      </section>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="space-y-8">
          <Card id="workspace" className="scroll-mt-28">
            <CardHeader title={t('page.settings.workspaceCard.profile')} description={t('page.settings.workspaceCard.description')} />

            {success && (
              <Notice tone="success" title={t('page.settings.workspaceCard.profileUpdated')}>
                {t('page.settings.workspaceCard.profileUpdatedDesc')}
              </Notice>
            )}

            {error && (
              <Notice tone="warning" title="Profile storage">
                {error}
              </Notice>
            )}

            <form onSubmit={handleSaveProfile} className="mt-6 space-y-6">
              <div>
                <Label htmlFor="email">{t('page.settings.workspaceCard.email')}</Label>
                <Input
                  type="email"
                  id="email"
                  value={email}
                  placeholder="No email available"
                  disabled
                />
                <p className="mt-2 text-xs text-black/52">
                  Email changes are handled through the authentication provider.
                </p>
              </div>

              <div>
                <Label htmlFor="fullName">{t('page.settings.workspaceCard.fullName')}</Label>
                <Input
                  type="text"
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  disabled={isSaving}
                  placeholder="Add your name"
                />
              </div>

              <Button type="submit" disabled={isSaving} size="lg">
                {isSaving ? (
                  <>
                    <SlidersHorizontal className="h-5 w-5 animate-spin" />
                    {t('page.settings.workspaceCard.saving')}
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    {t('page.settings.workspaceCard.saveProfile')}
                  </>
                )}
              </Button>
            </form>
          </Card>

          <Card>
            <CardHeader
              title={t('page.settings.workspace')}
              description="The active workspace selected for dashboard data."
            />
            <div className="muted-panel p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#F7CBCA] shadow-sm">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-black">{workspace.name}</p>
                  <p className="mt-1 text-sm text-black/52">
                    {workspace.slug ? `/${workspace.slug}` : 'No workspace slug set'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card id="backups" className="scroll-mt-28">
            <CardHeader
              title={t('page.settings.backupsCard.title')}
              description={t('page.settings.backupsCard.description')}
              action={<DatabaseBackup className="h-5 w-5 text-[#F7CBCA]" />}
            />
            <div className="muted-panel p-4">
              <p className="text-sm leading-6 text-black/60">
                Backups exclude provider tokens, secrets, raw env values, task execution credentials,
                and binary asset files. Restore writes are not enabled in this phase.
              </p>
              <Link href="/dashboard/backups" className={buttonStyles({ variant: 'outline', className: 'mt-4' })}>
                <DatabaseBackup className="h-4 w-4" />
                {t('action.openBackupCenter')}
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Preferences"
              description="Dashboard notice preferences are stored locally in this browser."
            />

            <div className="space-y-3">
              {([
                {
                  key: 'taskCompletions' as const,
                  label: 'Show task readiness notices',
                },
                {
                  key: 'taskFailures' as const,
                  label: 'Show integration setup reminders',
                },
                {
                  key: 'weeklySummary' as const,
                  label: 'Show weekly readiness summary',
                },
              ] as const).map((item) => (
                <label
                  key={item.key}
                  className="muted-panel flex cursor-pointer items-center justify-between gap-4 p-4"
                >
                  <span className="text-sm font-semibold text-black/70">{item.label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-black/20 text-[#F7CBCA] focus:ring-[#F7CBCA]"
                    checked={preferences[item.key]}
                    onChange={() => handlePreferenceChange(item.key)}
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button onClick={handleSavePreferences}>
                <Check className="h-4 w-4" />
                {t('page.settings.workspaceCard.savePreferences')}
              </Button>
              {preferencesSaved && (
                <p className="text-sm font-medium text-[#F7CBCA]">{t('page.settings.workspaceCard.preferencesSaved')}</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          <MetaConnectionSettings />
          <PinterestConnectionSettings />

          <Card id="advanced" className="scroll-mt-28">
            <CardHeader
              title="Production Domain & Launch Readiness"
              description="Custom domain readiness for the production launch path."
              action={<StatusBadge status="Ready" type="system" size="sm" />}
            />

            <div className="space-y-4">
              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Globe2 className="h-4 w-4 text-[#F7CBCA]" />
                    Current Production URL
                  </span>
                  <StatusBadge status="Ready" type="system" size="sm" />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/58">
                  https://agentflow-ai-sigma.vercel.app
                </p>
              </div>

              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-black/70">Custom Domain</span>
                  <StatusBadge status="Not Connected" type="system" size="sm" />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/58">
                  Ready to connect custom domain from Vercel.
                </p>
              </div>

              <Notice tone="warning" title="Domain management">
                Domain connection is managed in Vercel and DNS provider, not from inside AgentFlow AI.
              </Notice>

              <div className="rounded-lg border border-black/8 bg-white p-4">
                <p className="text-sm font-bold text-black">Launch checklist</p>
                <ol className="mt-4 grid gap-2 text-sm leading-6 text-black/62">
                  {productionLaunchChecklist.map((item, index) => (
                    <li key={item} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#D5E5E5] text-xs font-black text-[#F7CBCA]">
                        {index + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Integration Readiness"
              description="Current backend readiness for this workspace."
            />
            <div className="space-y-4">
              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Database className="h-4 w-4 text-[#F7CBCA]" />
                    Supabase
                  </span>
                  <StatusBadge
                    status={isSupabaseConfigured ? 'Ready' : 'Setup Required'}
                    type="system"
                    size="sm"
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/52">
                  {isSupabaseConfigured
                    ? 'Configured with public anon client access and server-side session checks.'
                    : 'Missing public Supabase environment configuration.'}
                </p>
              </div>
              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Workflow className="h-4 w-4 text-[#F7CBCA]" />
                    n8n
                  </span>
                  <StatusBadge status={n8nStatusLabel} type="system" size="sm" />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/52">
                  {n8nIsConnected
                    ? 'Webhook execution is marked connected for this workspace. Secrets remain server-side.'
                    : 'Guarded for production execution. Run Task remains disabled until server-side n8n configuration is complete.'}
                </p>
              </div>
              {integrationSettings && (
                <div className="rounded-lg border border-black/8 bg-white p-4">
                  <p className="text-sm font-semibold text-black/70">Workspace integration row</p>
                  <p className="mt-2 text-sm leading-6 text-black/52">
                    Supabase status: {integrationSettings.supabase_status}. Stored n8n status:{' '}
                    {integrationSettings.n8n_status}. Production execution is shown as connected only when this status is connected.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Provider Readiness"
              description="External provider setup and approval status for this workspace."
            />
            <div className="space-y-4">
              {(providerReadiness?.items ?? []).map((item) => (
                <div key={item.key} className="muted-panel p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                      <Sparkles className="h-4 w-4 text-[#F7CBCA]" />
                      {item.label}
                    </span>
                    <StatusBadge
                      status={item.status}
                      type="system"
                      size="sm"
                    />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-black/52">{item.detail}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card id="publishing-scheduling" className="scroll-mt-28">
            <CardHeader
              title="AI Image Generation Readiness"
              description="Server-side OpenAI image generation and Creative Assets storage readiness."
              action={
                <StatusBadge
                  status={aiImageReadiness?.generationStatus === 'ready' ? 'Ready' : 'Disabled'}
                  type="system"
                  size="sm"
                />
              }
            />
            <div className="space-y-4">
              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Sparkles className="h-4 w-4 text-[#F7CBCA]" />
                    OPENAI_API_KEY
                  </span>
                  <StatusBadge
                    status={aiImageReadiness?.openAIKeyStatus === 'configured' ? 'Ready' : 'Setup Required'}
                    type="system"
                    size="sm"
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/52">
                  {aiImageReadiness?.openAIKeyStatus === 'configured'
                    ? 'Configured server-side. The key is not exposed to client components.'
                    : 'Missing. Real image generation remains disabled until OPENAI_API_KEY is added in Vercel.'}
                </p>
              </div>

              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <ImageIcon className="h-4 w-4 text-[#F7CBCA]" />
                    Generation Status
                  </span>
                  <StatusBadge
                    status={aiImageReadiness?.generationStatus === 'ready' ? 'Ready' : 'Disabled'}
                    type="system"
                    size="sm"
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/52">
                  {aiImageReadiness?.message ||
                    'Image generation readiness is being checked server-side.'}
                </p>
              </div>

              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Database className="h-4 w-4 text-[#F7CBCA]" />
                    Storage
                  </span>
                  <StatusBadge
                    status={aiImageReadiness?.storageStatus === 'configured' ? 'Ready' : 'Setup Required'}
                    type="system"
                    size="sm"
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/52">
                  {aiImageReadiness?.storageMessage ||
                    'creative-assets bucket is required for generated image files.'}
                </p>
              </div>

              <Notice tone="warning" title="Usage cost">
                Image generation uses paid API usage. Set usage limits in your OpenAI account.
              </Notice>
              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Sparkles className="h-4 w-4 text-[#F7CBCA]" />
                    {t('page.settings.providersCard.aiTextProvider')}
                  </span>
                  <StatusBadge
                    status="Ready"
                    type="system"
                    size="sm"
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/52">
                  Active provider: {providerReadiness?.aiTextProvider.activeProvider ?? 'openai'}.
                  {' '}OpenAI is the only AI text provider for assistant and generation features.
                </p>
              </div>

              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Sparkles className="h-4 w-4 text-[#F7CBCA]" />
                    {t('page.settings.providersCard.openaiStatus')}
                  </span>
                  <StatusBadge
                    status={
                      providerReadiness?.aiTextProvider.openaiStatus === 'ready'
                        ? 'Ready'
                        : 'Setup Required'
                    }
                    type="system"
                    size="sm"
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/52">
                  {providerReadiness?.aiTextProvider.openaiMessage ??
                    'OpenAI text readiness is being checked server-side.'}
                </p>
              </div>

              <Notice tone="warning" title="AI text generation availability">
                {t('page.settings.providersCard.openaiBillingNotice')}
              </Notice>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={t('page.settings.alexCard.title')}
              description={t('page.settings.alexCard.description')}
              action={<Link href="/dashboard/alex"><Sparkles className="h-5 w-5 text-[#F7CBCA]" /></Link>}
            />
            <div className="space-y-4">
              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Sparkles className="h-4 w-4 text-[#F7CBCA]" />
                    Alex Assistant
                  </span>
                  <StatusBadge
                    status={providerReadiness?.aiTextProvider.openaiStatus === 'ready' ? 'Ready' : 'Setup Required'}
                    type="system"
                    size="sm"
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/52">
                  {providerReadiness?.aiTextProvider.openaiStatus === 'ready'
                    ? 'Alex is ready. Open the Alex page to start chatting.'
                    : 'Alex requires OPENAI_API_KEY to be configured.'}
                </p>
                <Link href="/dashboard/alex" className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-3' })}>
                  Open Alex Assistant
                </Link>
              </div>
              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Sparkles className="h-4 w-4 text-[#F7CBCA]" />
                    OPENAI_API_KEY
                  </span>
                  <StatusBadge
                    status={providerReadiness?.aiTextProvider.openaiStatus === 'ready' ? 'ready' : 'setup_required'}
                    type="system"
                    size="sm"
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/52">
                  {providerReadiness?.aiTextProvider.openaiStatus === 'ready'
                    ? 'Configured server-side. The key is not exposed to client components.'
                    : 'Missing. Add OPENAI_API_KEY in Vercel Environment Variables.'}
                </p>
              </div>
              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Sparkles className="h-4 w-4 text-[#F7CBCA]" />
                    OPENAI_MODEL
                  </span>
                  <StatusBadge status="Ready" type="system" size="sm" />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/52">
                  {providerReadiness?.aiTextProvider.openaiMessage
                    ? `Model: ${providerReadiness.aiTextProvider.openaiMessage.split('Model: ')[1]?.split('.')[0] || 'gpt-5.5'}`
                    : 'Default: gpt-5.5'}
                </p>
              </div>
              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Sparkles className="h-4 w-4 text-[#F7CBCA]" />
                    Permissions
                  </span>
                  <StatusBadge status="ready" type="system" size="sm" />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/52">
                  Alex can read and summarize workspace data, prepare drafts and suggestions, but will not execute publishing, scheduler, n8n, GitHub writes, deletion, provider changes, or paid ad actions without explicit confirmation.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Instagram Reels Publishing Readiness"
              description="Organic Reels publishing stays disabled until Meta content publishing setup is complete."
            />
            <div className="space-y-4">
              {[
                {
                  label: 'Meta app configured',
                  status: 'Ready',
                  detail: 'Meta OAuth foundation is configured server-side. Secrets are never shown here.',
                },
                {
                  label: 'Instagram content publishing permission required',
                  status: 'Setup Required',
                  detail: 'Requires instagram_basic and instagram_content_publish permissions.',
                },
                {
                  label: 'Instagram Business / Creator account required',
                  status: 'Setup Required',
                  detail: 'A connected Facebook Page and linked Instagram account are required.',
                },
                {
                  label: 'Facebook Page connection required',
                  status: 'Setup Required',
                  detail: 'Requires pages_show_list and pages_read_engagement for future publishing.',
                },
                {
                  label: 'Publishing disabled until setup complete',
                  status: 'Disabled',
                  detail: 'Reels Studio never publishes automatically and never uses ads_management.',
                },
              ].map((item) => (
                <div key={item.label} className="muted-panel p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                      <Film className="h-4 w-4 text-[#F7CBCA]" />
                      {item.label}
                    </span>
                    <StatusBadge
                      status={item.status as 'Ready' | 'Setup Required' | 'Disabled'}
                      type="system"
                      size="sm"
                    />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-black/52">{item.detail}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card id="security" className="scroll-mt-28 border-[#F7CBCA]/16 bg-[#D5E5E5]/48">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#F7CBCA] shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-black">Integration Readiness</h2>
                <p className="mt-2 text-sm leading-6 text-black/62">
                  Supabase task storage is active. n8n remains explicitly guarded unless it is connected server-side; secrets are not exposed to client components.
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-[#F7CBCA]/18 bg-[#D5E5E5]/56">
            <CardHeader
              title="Account Session"
              description="End the current session on this device."
            />
            <Button type="button" variant="danger" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SettingsSectionIntro({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-black/7 bg-white/74 px-4 py-3 shadow-sm backdrop-blur-[14px]">
      <h2 className="text-base font-black text-black">{title}</h2>
      <p className="mt-1 max-w-4xl text-sm leading-6 text-black/58">{description}</p>
    </div>
  );
}
