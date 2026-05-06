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
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

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

  const [notificationsResult, unreadCountResult] = await Promise.all([
    listLatestNotifications(
      {
        workspaceId: workspaceResult.data.id,
        userId: user.id,
        limit: 6,
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
      }}
      initialNotifications={notificationsResult.error ? [] : notificationsResult.data}
      initialUnreadCount={unreadCountResult.error ? 0 : unreadCountResult.data}
    >
      {children}
    </DashboardShell>
  );
}
