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
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export const maxDuration = 120;

const DASHBOARD_LAYOUT_AUTH_TIMEOUT_MS = 4_000;
const DASHBOARD_LAYOUT_DATA_TIMEOUT_MS = 2_500;

function timeoutMessage(sectionName: string) {
  return `${sectionName} did not respond quickly enough.`;
}

async function withLayoutTimeout<T>(
  sectionName: string,
  promise: Promise<T>,
  timeoutMs = DASHBOARD_LAYOUT_DATA_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.warn('[dashboard-layout] timeout', sectionName);
      reject(new Error(timeoutMessage(sectionName)));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      promise.catch((error: unknown) => {
        console.warn('[dashboard-layout] failed', sectionName, error);
        throw error;
      }),
      timeout,
    ]);
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
  if (!isSupabaseServerConfigured) {
    redirect('/auth/login?message=Supabase is not configured yet');
  }

  const supabase = await createSupabaseServerClient({
    fetchTimeoutMs: DASHBOARD_LAYOUT_AUTH_TIMEOUT_MS,
  });
  const authResult = await withLayoutTimeout(
    'auth session',
    supabase.auth.getUser(),
    DASHBOARD_LAYOUT_AUTH_TIMEOUT_MS
  ).catch(() => ({ data: { user: null } }));
  const user = authResult.data.user;

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await withLayoutTimeout(
    'workspace context',
    getCurrentUserWorkspace(supabase, activeWorkspaceId),
    DASHBOARD_LAYOUT_AUTH_TIMEOUT_MS
  ).catch(() => ({
    data: null,
    error: timeoutMessage('workspace context'),
    isConfigured: true,
  }));

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const [unreadCountResult, brandingResult, themeResult] = await Promise.allSettled([
    withLayoutTimeout(
      'notification count',
      countUnreadNotifications(
        {
          workspaceId: workspaceResult.data.id,
          userId: user.id,
        },
        supabase
      )
    ),
    withLayoutTimeout(
      'workspace branding',
      getBrandingForWorkspace(supabase, workspaceResult.data.id)
    ),
    withLayoutTimeout(
      'workspace theme',
      getWorkspaceTheme(supabase, workspaceResult.data.id)
    ),
  ]);

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
      {children}
    </DashboardShell>
  );
}
