'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Check, Database, Globe2, LogOut, ShieldCheck, SlidersHorizontal, Workflow } from 'lucide-react';
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
import { getIntegrationSettings } from '@/lib/data/workspaces';
import type { IntegrationSettingsRecord } from '@/types/database';

const productionLaunchChecklist = [
  'Buy a custom domain',
  'Add the domain in Vercel Project Settings',
  'Configure DNS records',
  'Wait for SSL verification',
  'Update APP_BASE_URL to the custom domain',
  'Update Meta Redirect URI',
  'Update Pinterest Redirect URI',
  'Update Google Ads Redirect URI',
  'Update LinkedIn Redirect URI',
  'Redeploy production',
  'Test login',
  'Test Run Task',
  'Test n8n callback',
  'Test Reports',
  'Test Campaigns and ad platform connections',
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { user: dashboardUser, workspace } = useDashboardContext();
  const [userId, setUserId] = useState(dashboardUser.id);
  const [email, setEmail] = useState(dashboardUser.email);
  const [fullName, setFullName] = useState(dashboardUser.fullName);
  const [integrationSettings, setIntegrationSettings] =
    useState<IntegrationSettingsRecord | null>(null);
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

        const integrationResult = await getIntegrationSettings(supabase, workspace.id);

        if (isMounted) {
          setIntegrationSettings(integrationResult.data);
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

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSaving(true);

    if (!isSupabaseConfigured) {
      setError('Profile updates will be available after Supabase environment setup.');
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
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/auth/login?message=Signed out');
      router.refresh();
    } catch (err) {
      reportAppError('Logout error', err);
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
        title="Settings"
        description="Manage account preferences, security boundaries, and integration readiness."
        actions={
          <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}>
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="space-y-8">
          <Card>
            <CardHeader title="Profile" description="Account details connected to the current workspace." />

            {success && (
              <Notice tone="success" title="Profile updated">
                Changes were saved successfully.
              </Notice>
            )}

            {error && (
              <Notice tone="warning" title="Profile storage">
                {error}
              </Notice>
            )}

            <form onSubmit={handleSaveProfile} className="mt-6 space-y-6">
              <div>
                <Label htmlFor="email">Email Address</Label>
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
                <Label htmlFor="fullName">Full Name</Label>
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
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </Card>

          <Card>
            <CardHeader
              title="Workspace"
              description="The active workspace selected for dashboard data."
            />
            <div className="muted-panel p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#8B3CDE] shadow-sm">
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

          <Card>
            <CardHeader
              title="Preferences"
              description="Dashboard notice preferences are stored locally in this browser."
            />

            <div className="space-y-3">
              {[
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
              ].map((item) => (
                <label
                  key={item.key}
                  className="muted-panel flex cursor-pointer items-center justify-between gap-4 p-4"
                >
                  <span className="text-sm font-semibold text-black/70">{item.label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-black/20 text-[#8B3CDE] focus:ring-[#8B3CDE]"
                    checked={preferences[item.key]}
                    onChange={() => handlePreferenceChange(item.key)}
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button onClick={handleSavePreferences}>
                <Check className="h-4 w-4" />
                Save Preferences
              </Button>
              {preferencesSaved && (
                <p className="text-sm font-medium text-[#8B3CDE]">Preferences saved locally.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader
              title="Production Domain & Launch Readiness"
              description="Custom domain readiness for the production launch path."
              action={<StatusBadge status="Ready" type="system" size="sm" />}
            />

            <div className="space-y-4">
              <div className="muted-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                    <Globe2 className="h-4 w-4 text-[#8B3CDE]" />
                    Current Production URL
                  </span>
                  <StatusBadge status="Ready" type="system" size="sm" />
                </div>
                <p className="mt-2 break-all text-sm leading-6 text-black/58">
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
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F0DBEF] text-xs font-black text-[#8B3CDE]">
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
                    <Database className="h-4 w-4 text-[#8B3CDE]" />
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
                    <Workflow className="h-4 w-4 text-[#F55477]" />
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

          <Card className="border-[#8B3CDE]/16 bg-[#F0DBEF]/48">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#8B3CDE] shadow-sm">
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

          <Card className="border-[#F55477]/18 bg-[#F0DBEF]/56">
            <CardHeader
              title="Account Session"
              description="End the current session on this device."
            />
            <Button type="button" variant="danger" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
