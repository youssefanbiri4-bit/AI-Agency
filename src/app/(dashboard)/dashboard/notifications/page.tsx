import Link from 'next/link';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import {
  countUnreadNotifications,
  listLatestNotifications,
} from '@/lib/data/notifications';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { formatDateTime } from '@/lib/utils';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import type { NotificationRecord } from '@/types/database';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from './actions';

function getNotificationHref(notification: NotificationRecord) {
  const taskId =
    typeof notification.metadata.task_id === 'string'
      ? notification.metadata.task_id
      : typeof notification.metadata.taskId === 'string'
        ? notification.metadata.taskId
        : null;

  if (taskId) {
    return `/dashboard/tasks/${taskId}`;
  }

  if (
    notification.type === 'campaign_task_created' ||
    notification.type === 'meta_connection_connected' ||
    notification.type === 'ad_platform_setup_required'
  ) {
    return '/dashboard/campaigns';
  }

  if (notification.type === 'report_ready') {
    return '/dashboard/reports';
  }

  return '/dashboard/notifications';
}

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
              limit: 50,
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
        description="Task, report, and campaign readiness updates for the active workspace."
      />

      {(workspaceResult.error || notificationsResult.error || unreadCountResult.error) && (
        <Notice tone="warning" title="Notifications notice">
          {workspaceResult.error ??
            notificationsResult.error ??
            unreadCountResult.error}
        </Notice>
      )}

      <Card>
        <CardHeader
          title="Latest Notifications"
          description="Only notifications for your user and active workspace are shown."
          action={
            <>
              <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-black/56">
                {unreadCount} unread
              </span>
              <form action={markAllNotificationsReadAction}>
                <button
                  type="submit"
                  disabled={unreadCount === 0}
                  className={buttonStyles({ variant: 'outline', size: 'sm' })}
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark all as read
                </button>
              </form>
            </>
          }
        />

        {notifications.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No notifications yet"
            description="Task review, completion, failure, and campaign updates will appear here once events are recorded."
          />
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const isUnread = notification.status === 'unread';

              return (
                <div
                  key={notification.id}
                  className="muted-panel flex min-w-0 flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Bell className="h-4 w-4 text-[#8B3CDE]" />
                      <h3 className="break-words text-sm font-black text-black">
                        {notification.title}
                      </h3>
                      <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-black/56">
                        {isUnread ? 'Unread' : 'Read'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {notification.message}
                    </p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-black/38">
                      {formatDateTime(notification.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={getNotificationHref(notification)}
                      className={buttonStyles({ variant: 'outline', size: 'sm' })}
                    >
                      Open
                    </Link>
                    {isUnread && (
                      <form action={markNotificationReadAction}>
                        <input
                          type="hidden"
                          name="notificationId"
                          value={notification.id}
                        />
                        <button
                          type="submit"
                          className={buttonStyles({ variant: 'ghost', size: 'sm' })}
                        >
                          Mark as read
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
