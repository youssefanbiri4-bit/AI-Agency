'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, CheckCheck, CircleAlert, Inbox, X } from 'lucide-react';
import {
  countUnreadNotifications,
  listLatestNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/data/notifications';
import { cn, formatTimeAgo } from '@/lib/utils';
import { buttonStyles } from '@/components/ui/Button';
import { useDashboardContext } from '@/components/layout/DashboardContext';
import {
  getActionableNotificationHref,
  getNotificationCategory,
  getNotificationSeverity,
} from '@/lib/notifications-ui';
import type { NotificationRecord } from '@/types/database';

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
  const previousUnreadCountRef = useRef(initialUnreadCount);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] =
    useState<NotificationRecord[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  const refreshNotifications = useCallback(async () => {
    const [notificationsResult, countResult] = await Promise.all([
      listLatestNotifications({
        workspaceId: workspace.id,
        userId: user.id,
        limit: 5,
        status: 'unread',
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
    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

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
          <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F7CBCA] px-1 text-[10px] font-black text-white shadow-sm">
            {countLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute end-0 top-12 z-50 w-[min(calc(100vw-1.5rem),24rem)] rounded-lg border border-[#F7CBCA]/10 bg-white/92 p-3 shadow-[0_24px_60px_rgba(93,107,107,0.12)] backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)]">
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
                <p className="mt-3 text-sm font-bold text-black">No unread notifications</p>
                <p className="mt-1 text-xs leading-5 text-black/52">
                  Open the center to review older updates.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => {
                  const isUnread = notification.status === 'unread';
                  const severity = getNotificationSeverity(notification);
                  const category = getNotificationCategory(notification);
                  const notificationHref = getActionableNotificationHref(notification) ?? '/dashboard/notifications';
                  const SeverityIcon =
                    severity === 'error' || severity === 'critical'
                      ? CircleAlert
                      : severity === 'warning'
                        ? AlertTriangle
                        : Bell;

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'rounded-lg border p-3 transition-colors',
                        isUnread
                          ? 'border-[#F7CBCA]/18 bg-[#D5E5E5]/48'
                          : 'border-[#F7CBCA]/10 bg-white'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={notificationHref}
                          onClick={() => setIsOpen(false)}
                          className="min-w-0 flex-1"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <SeverityIcon
                              className={cn(
                                'h-4 w-4 shrink-0',
                                severity === 'error' || severity === 'critical'
                                  ? 'text-[#F7CBCA]'
                                  : severity === 'warning'
                                    ? 'text-[#8A4300]'
                                    : 'text-[#F7CBCA]'
                              )}
                            />
                            <p className="line-clamp-2 text-sm font-bold text-black">
                              {notification.title}
                            </p>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-black/58">
                            {notification.message}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-black/36">
                            <span>{category.replace('_', ' ')}</span>
                            <span>{severity}</span>
                            <span>{formatTimeAgo(notification.created_at)}</span>
                          </div>
                        </Link>
                        {isUnread && (
                          <button
                            type="button"
                            className="rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] font-bold text-black/58 hover:border-[#F7CBCA]/35 hover:text-[#F7CBCA]"
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
              View all notifications
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
