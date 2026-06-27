import { DashboardShell } from '@/components/layout/DashboardShell';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
  isSupabaseServerConfigured,
} from '@/lib/supabase-server';
import { countUnreadNotifications } from '@/lib/data/notifications';
import { getBrandingForWorkspace } from '@/lib/data/branding';
import { defaultWorkspaceBranding } from '@/lib/data/branding';
import { getWorkspaceTheme } from '@/lib/data/theme';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { defaultWorkspaceTheme } from '@/lib/theme';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { logger } from '@/lib/logger';

export const maxDuration = 120;

// Improved timeout configurations with better values
const DASHBOARD_LAYOUT_TIMEOUTS = {
  authSession: 3_000,      // Reduced from 4s to 3s for faster failure detection
  workspaceContext: 2_500, // Reduced from 4s to 2.5s
  shellData: 2_000,        // Reduced from 2.5s to 2s for parallel operations
} as const;

const dashboardLayoutLog = logger.child('dashboard:layout');

function traceDashboardLayout(message: string, details?: Record<string, unknown>) {
  if (details) {
    dashboardLayoutLog.info(message, details);
    return;
  }
  dashboardLayoutLog.info(message);
}

function timeoutMessage(sectionName: string): string {
  const timeoutMs = DASHBOARD_LAYOUT_TIMEOUTS[sectionName as keyof typeof DASHBOARD_LAYOUT_TIMEOUTS] ?? 2_000;
  return `${sectionName} did not respond within ${timeoutMs}ms`;
}

function DashboardRouteFallback() {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <section className="rounded-2xl border border-black/7 bg-white/90 p-6 shadow-[0_24px_70px_rgba(93,107,107,0.08)]">
        <h1 className="text-2xl font-black text-[#5D6B6B]">Workspace route is preparing</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/58">
          Navigation remains available while this page finishes loading. Slow data requests are isolated from the dashboard shell.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/dashboard" className="rounded-lg border border-[#F7CBCA]/15 bg-white/78 px-4 py-2 text-sm font-bold text-black shadow-sm">
            Command Center
          </Link>
          <Link href="/dashboard/system-health" className="rounded-lg border border-[#F7CBCA]/15 bg-white/78 px-4 py-2 text-sm font-bold text-black shadow-sm">
            System Health
          </Link>
          <Link href="/dashboard/settings" className="rounded-lg border border-[#F7CBCA]/15 bg-white/78 px-4 py-2 text-sm font-bold text-black shadow-sm">
            Settings
          </Link>
        </div>
      </section>
    </div>
  );
}

async function withLayoutTimeout<T>(
  sectionName: string,
  promise: Promise<T>,
  timeoutMs: number = DASHBOARD_LAYOUT_TIMEOUTS.shellData
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const startedAt = Date.now();
  traceDashboardLayout(`before ${sectionName}`);
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      dashboardLayoutLog.warn('timeout', { sectionName, durationMs: Date.now() - startedAt });
      reject(new Error(timeoutMessage(sectionName)));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      promise.catch((error: unknown) => {
        dashboardLayoutLog.warn('failed', { sectionName, error: error instanceof Error ? error.message : String(error) });
        throw error;
      }),
      timeout,
    ]);
    traceDashboardLayout(`after ${sectionName}`, { durationMs: Date.now() - startedAt });
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  traceDashboardLayout('render start');
  if (!isSupabaseServerConfigured) {
    dashboardLayoutLog.warn('redirect login: Supabase not configured');
    redirect('/auth/login?message=Supabase is not configured yet');
  }

  traceDashboardLayout('before createSupabaseServerClient');
  const supabase = await createSupabaseServerClient({
    fetchTimeoutMs: DASHBOARD_LAYOUT_TIMEOUTS.authSession,
  });
  traceDashboardLayout('after createSupabaseServerClient');
  const authResult = await withLayoutTimeout(
    'auth session',
    supabase.auth.getUser(),
    DASHBOARD_LAYOUT_TIMEOUTS.authSession
  ).catch(() => ({ data: { user: null } }));
  const user = authResult.data.user;

  if (!user) {
    dashboardLayoutLog.warn('redirect login: no user');
    redirect('/auth/login?redirectTo=/dashboard');
  }

  traceDashboardLayout('before active workspace cookie');
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  traceDashboardLayout('after active workspace cookie', { activeWorkspaceId });
  const workspaceResult = await withLayoutTimeout(
    'workspace context',
    getCurrentUserWorkspace(supabase, activeWorkspaceId),
    DASHBOARD_LAYOUT_TIMEOUTS.workspaceContext
  ).catch(() => ({
    data: null,
    error: timeoutMessage('workspace context'),
    isConfigured: true,
  }));

  if (!workspaceResult.data) {
    dashboardLayoutLog.warn('redirect onboarding: no workspace', {
      error: workspaceResult.error,
    });
    redirect('/onboarding');
  }

  traceDashboardLayout('before shell data batch', { workspaceId: workspaceResult.data.id });
  const [unreadCountResult, brandingResult, themeResult] = await Promise.allSettled([
    withLayoutTimeout(
      'notification count',
      countUnreadNotifications(
        {
          workspaceId: workspaceResult.data.id,
          userId: user.id,
        },
        supabase
      ),
      DASHBOARD_LAYOUT_TIMEOUTS.shellData
    ),
    withLayoutTimeout(
      'workspace branding',
      getBrandingForWorkspace(supabase, workspaceResult.data.id),
      DASHBOARD_LAYOUT_TIMEOUTS.shellData
    ),
    withLayoutTimeout(
      'workspace theme',
      getWorkspaceTheme(supabase, workspaceResult.data.id),
      DASHBOARD_LAYOUT_TIMEOUTS.shellData
    ),
  ]);
  traceDashboardLayout('after shell data batch');

  const unreadCount =
    unreadCountResult.status === 'fulfilled' && !unreadCountResult.value.error
      ? unreadCountResult.value.data
      : 0;
  const branding =
    brandingResult.status === 'fulfilled' && !brandingResult.value.error
      ? brandingResult.value.data.branding
      : defaultWorkspaceBranding;
  const theme =
    themeResult.status === 'fulfilled' && !themeResult.value.error
      ? themeResult.value.data
      : defaultWorkspaceTheme;

  traceDashboardLayout('render shell', {
    workspaceId: workspaceResult.data.id,
    unreadCount,
  });

  return (
    <DashboardShell
      user={{
        id: user.id,
        email: user.email ?? '',
        fullName:
          typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name
            : '',
      }}
      workspace={{
        id: workspaceResult.data.id,
        name: workspaceResult.data.name,
        slug: workspaceResult.data.slug,
        branding: {
          logoUrl: branding.logo_url,
          logoAltText: branding.logo_alt_text,
        },
      }}
      initialNotifications={[]}
      initialUnreadCount={unreadCount}
      theme={theme}
    >
      <Suspense fallback={<DashboardRouteFallback />}>
        {children}
      </Suspense>
    </DashboardShell>
  );
}
