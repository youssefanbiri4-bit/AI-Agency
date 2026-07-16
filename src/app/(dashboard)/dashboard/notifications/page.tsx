import dynamic from 'next/dynamic';
import Link from 'next/link';
import { CheckCheck, LifeBuoy, RefreshCw } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import {
  countUnreadNotifications,
  listLatestNotifications,
} from '@/lib/data/notifications';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { buttonStyles } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { markAllNotificationsReadAction } from './actions';

const NotificationsCenterClient = dynamic(
  () => import('./NotificationsCenterClient').then((mod) => mod.NotificationsCenterClient),
  {
    loading: () => (
      <LoadingState title="Loading notifications" description="Checking for the latest updates." />
    ),
  }
);

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;

  const [notificationsResult, unreadCountResult] =
    workspaceId && user?.id
      ? await Promise.all([
          listLatestNotifications(
            {
              workspaceId,
              userId: user.id,
              limit: 200,
            },
            supabase
          ),
          countUnreadNotifications(
            {
              workspaceId,
              userId: user.id,
            },
            supabase
          ),
        ])
      : [
          { data: [], error: null, isConfigured: true },
          { data: 0, error: null, isConfigured: true },
        ];

  const notifications = notificationsResult.data;
  const unreadCount = unreadCountResult.data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace updates"
        title="Notifications"
        description="Read system alerts, task updates, provider setup messages, scheduler results, and publishing activity."
        actions={
          <>
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                disabled={unreadCount === 0}
                className={buttonStyles({ variant: 'outline' })}
              >
                <CheckCheck className="h-4 w-4" />
                Mark all as read
              </button>
            </form>
            <Link href="/dashboard/notifications" className={buttonStyles({ variant: 'outline' })}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Link>
            <Link href="/dashboard/recovery" className={buttonStyles({ variant: 'secondary' })}>
              <LifeBuoy className="h-4 w-4" />
              Open Recovery Center
            </Link>
          </>
        }
      />

      {(workspaceResult.error || notificationsResult.error || unreadCountResult.error) && (
        <Notice tone="warning" title="Notifications notice">
          {workspaceResult.error ??
            notificationsResult.error ??
            unreadCountResult.error}
        </Notice>
      )}

      <NotificationsCenterClient
        initialNotifications={notifications}
      />
    </div>
  );
}
