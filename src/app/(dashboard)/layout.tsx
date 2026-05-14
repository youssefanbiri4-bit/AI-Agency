import { DashboardShell } from '@/components/layout/DashboardShell';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
  isSupabaseServerConfigured,
} from '@/lib/supabase-server';
import {
  countUnreadNotifications,
  listLatestNotifications,
} from '@/lib/data/notifications';
import { getBrandingForWorkspace } from '@/lib/data/branding';
import { getWorkspaceTheme } from '@/lib/data/theme';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export const maxDuration = 120;

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isSupabaseServerConfigured) {
    redirect('/auth/login?message=Supabase is not configured yet');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const [notificationsResult, unreadCountResult, brandingResult, themeResult] = await Promise.all([
    listLatestNotifications(
      {
        workspaceId: workspaceResult.data.id,
        userId: user.id,
        limit: 5,
        status: 'unread',
      },
      supabase
    ),
    countUnreadNotifications(
      {
        workspaceId: workspaceResult.data.id,
        userId: user.id,
      },
      supabase
    ),
    getBrandingForWorkspace(supabase, workspaceResult.data.id),
    getWorkspaceTheme(supabase, workspaceResult.data.id),
  ]);

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
          logoUrl: brandingResult.error ? null : brandingResult.data.branding.logo_url,
          logoAltText: brandingResult.error
            ? null
            : brandingResult.data.branding.logo_alt_text,
        },
      }}
      initialNotifications={notificationsResult.error ? [] : notificationsResult.data}
      initialUnreadCount={unreadCountResult.error ? 0 : unreadCountResult.data}
      theme={themeResult.data}
    >
      {children}
    </DashboardShell>
  );
}
