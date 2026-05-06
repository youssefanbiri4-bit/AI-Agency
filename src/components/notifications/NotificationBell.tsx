'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Inbox, X } from 'lucide-react';
import {
  countUnreadNotifications,
  listLatestNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/data/notifications';
import { cn, formatTimeAgo } from '@/lib/utils';
import { buttonStyles } from '@/components/ui/Button';
import { useDashboardContext } from '@/components/layout/DashboardContext';
import type { NotificationRecord } from '@/types/database';

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

interface NotificationBellProps {
  initialNotifications?: NotificationRecord[];
  initialUnreadCount?: number;
}

export function NotificationBell({
  initialNotifications = [],
  initialUnreadCount = 0,
}: NotificationBellProps) {
  const { user, workspace } = useDashboardContext();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] =
    useState<NotificationRecord[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  const refreshNotifications = useCallback(async () => {
    const [notificationsResult, countResult] = await Promise.all([
      listLatestNotifications({
        workspaceId: workspace.id,
        userId: user.id,
        limit: 6,
      }),
      countUnreadNotifications({
        workspaceId: workspace.id,
        userId: user.id,
      }),
    ]);

    if (!notificationsResult.error) {
      setNotifications(notificationsResult.data);
    }

    if (!countResult.error) {
      setUnreadCount(countResult.data);
    }
  }, [user.id, workspace.id]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationRead({
      workspaceId: workspace.id,
      userId: user.id,
      notificationId,
    });
    await refreshNotifications();
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsRead({
      workspaceId: workspace.id,
      userId: user.id,
    });
    await refreshNotifications();
  };

  const handleToggleNotifications = () => {
    setIsOpen((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        void refreshNotifications();
      }

      return nextOpen;
    });
  };

  const countLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label="Open notifications"
        aria-expanded={isOpen}
        onClick={handleToggleNotifications}
        className={cn(buttonStyles({ variant: 'ghost', size: 'icon' }), 'relative')}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F55477] px-1 text-[10px] font-black text-white shadow-sm">
            {countLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-[min(calc(100vw-1.5rem),24rem)] rounded-lg border border-black/8 bg-white p-3 shadow-[0_24px_60px_rgba(0,0,0,0.16)]">
          <div className="flex items-start justify-between gap-3 border-b border-black/8 pb-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-black">Notifications</p>
              <p className="mt-0.5 text-xs text-black/52">
                Latest workspace updates for you.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close notifications"
              className={buttonStyles({ variant: 'ghost', size: 'icon', className: 'h-8 w-8' })}
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[24rem] overflow-y-auto py-2">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Inbox className="mx-auto h-8 w-8 text-black/28" />
                <p className="mt-3 text-sm font-bold text-black">Nothing new yet</p>
                <p className="mt-1 text-xs leading-5 text-black/52">
                  Task and campaign updates will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => {
                  const isUnread = notification.status === 'unread';

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'rounded-lg border p-3 transition-colors',
                        isUnread
                          ? 'border-[#8B3CDE]/18 bg-[#F0DBEF]/48'
                          : 'border-black/8 bg-white'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={getNotificationHref(notification)}
                          onClick={() => setIsOpen(false)}
                          className="min-w-0 flex-1"
                        >
                          <p className="line-clamp-2 text-sm font-bold text-black">
                            {notification.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-black/58">
                            {notification.message}
                          </p>
                          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-black/36">
                            {formatTimeAgo(notification.created_at)}
                          </p>
                        </Link>
                        {isUnread && (
                          <button
                            type="button"
                            className="rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] font-bold text-black/58 hover:border-[#8B3CDE]/35 hover:text-[#8B3CDE]"
                            onClick={() => void handleMarkAsRead(notification.id)}
                          >
                            Read
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-black/8 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/dashboard/notifications"
              onClick={() => setIsOpen(false)}
              className={buttonStyles({ variant: 'outline', size: 'sm' })}
            >
              View all
            </Link>
            <button
              type="button"
              disabled={unreadCount === 0}
              className={buttonStyles({ variant: 'ghost', size: 'sm' })}
              onClick={() => void handleMarkAllAsRead()}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
