'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCheck,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Inbox,
  LifeBuoy,
  Megaphone,
  RadioTower,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/FormControls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  formatNotificationCategory,
  formatNotificationType,
  getActionableNotificationHref,
  getNotificationCategory,
  getNotificationRelatedLabel,
  getNotificationSeverity,
  safeNotificationMetadata,
  type NotificationCategory,
} from '@/lib/notifications-ui';
import { cn, formatDateTime, formatTimeAgo } from '@/lib/utils';
import type { NotificationRecord, NotificationSeverity } from '@/types/database';
import { markAllNotificationsReadAction, markNotificationReadAction } from './actions';

type QuickFilter =
  | 'all'
  | 'unread'
  | 'read'
  | 'errors'
  | 'warnings'
  | 'tasks'
  | 'content'
  | 'providers'
  | 'scheduler'
  | 'publishing';

interface NotificationsCenterClientProps {
  initialNotifications: NotificationRecord[];
}

const filterOptions: Array<{ value: QuickFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'errors', label: 'Errors' },
  { value: 'warnings', label: 'Warnings' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'content', label: 'Content' },
  { value: 'providers', label: 'Providers' },
  { value: 'scheduler', label: 'Scheduler' },
  { value: 'publishing', label: 'Publishing' },
];

const categoryIcons: Record<NotificationCategory, typeof Bell> = {
  task: FileText,
  review: ClipboardCheck,
  content: Megaphone,
  creative_asset: ImageIcon,
  provider: RadioTower,
  scheduler: CalendarDays,
  publishing: Zap,
  system: Bell,
  recovery: LifeBuoy,
  calendar: CalendarDays,
};

const severityStyles: Record<NotificationSeverity, string> = {
  info: 'border-black/10 bg-white text-black/62',
  success: 'border-[#5D6B6B]/12 bg-[#5D6B6B] text-[#D5E5E5]',
  warning: 'border-[#E7F5DC]/36 bg-[#D5E5E5]/76 text-[#7A3A00]',
  error: 'border-[#F7CBCA]/28 bg-[#F1F7F7] text-[#B51F30]',
  critical: 'border-[#F7CBCA]/30 bg-[#F7CBCA] text-white',
};

const severityIcons: Record<NotificationSeverity, typeof Bell> = {
  info: Bell,
  success: Bell,
  warning: AlertTriangle,
  error: CircleAlert,
  critical: CircleAlert,
};

function severityLabel(severity: NotificationSeverity) {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function matchesQuickFilter(notification: NotificationRecord, filter: QuickFilter) {
  const category = getNotificationCategory(notification);
  const severity = getNotificationSeverity(notification);

  if (filter === 'all') return notification.status !== 'archived';
  if (filter === 'unread') return notification.status === 'unread';
  if (filter === 'read') return notification.status === 'read';
  if (filter === 'errors') return severity === 'error' || severity === 'critical';
  if (filter === 'warnings') return severity === 'warning';
  if (filter === 'tasks') return category === 'task' || category === 'review';
  if (filter === 'content') return category === 'content' || category === 'creative_asset' || category === 'calendar';
  if (filter === 'providers') return category === 'provider' || category === 'recovery';
  if (filter === 'scheduler') return category === 'scheduler' || category === 'calendar';
  if (filter === 'publishing') return category === 'publishing';

  return true;
}

export function NotificationsCenterClient({
  initialNotifications,
}: NotificationsCenterClientProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [selectedId, setSelectedId] = useState<string | null>(initialNotifications[0]?.id ?? null);
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const visibleNotifications = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return notifications.filter((notification) => {
      if (!matchesQuickFilter(notification, filter)) return false;

      if (!normalizedSearch) return true;

      return (
        notification.title.toLowerCase().includes(normalizedSearch) ||
        notification.message.toLowerCase().includes(normalizedSearch) ||
        formatNotificationType(notification.type).toLowerCase().includes(normalizedSearch)
      );
    });
  }, [filter, notifications, searchQuery]);

  const selectedNotification =
    visibleNotifications.find((notification) => notification.id === selectedId) ??
    visibleNotifications[0] ??
    null;

  const stats = useMemo(() => {
    return notifications.reduce(
      (accumulator, notification) => {
        const category = getNotificationCategory(notification);
        const severity = getNotificationSeverity(notification);

        if (notification.status === 'unread') accumulator.unread += 1;
        if (severity === 'error' || severity === 'critical') accumulator.errors += 1;
        if (severity === 'warning') accumulator.warnings += 1;
        if (category === 'provider' || notification.type.includes('setup_required') || notification.type.includes('approval_pending')) accumulator.provider += 1;
        if (category === 'scheduler') accumulator.scheduler += 1;
        if (category === 'task' || category === 'review') accumulator.taskReview += 1;

        return accumulator;
      },
      {
        unread: 0,
        errors: 0,
        warnings: 0,
        provider: 0,
        scheduler: 0,
        taskReview: 0,
      }
    );
  }, [notifications]);

  function markOneAsRead(notificationId: string) {
    startTransition(() => {
      const formData = new FormData();
      formData.set('notificationId', notificationId);
      void markNotificationReadAction(formData).then(() => {
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === notificationId
              ? { ...notification, status: 'read', read_at: new Date().toISOString() }
              : notification
          )
        );
        router.refresh();
      });
    });
  }

  function markAllAsRead() {
    startTransition(() => {
      void markAllNotificationsReadAction().then(() => {
        const now = new Date().toISOString();
        setNotifications((current) =>
          current.map((notification) =>
            notification.status === 'unread'
              ? { ...notification, status: 'read', read_at: now }
              : notification
          )
        );
        router.refresh();
      });
    });
  }

  return (
    <div className="space-y-8">
      <div className="dashboard-stat-grid">
        <SummaryTile label="Unread" value={stats.unread} icon={Bell} tone="brand" />
        <SummaryTile label="Errors" value={stats.errors} icon={ShieldAlert} tone="error" />
        <SummaryTile label="Warnings" value={stats.warnings} icon={AlertTriangle} tone="warning" />
        <SummaryTile label="Provider Issues" value={stats.provider} icon={RadioTower} tone="brand" />
        <SummaryTile label="Scheduler Issues" value={stats.scheduler} icon={CalendarDays} tone="warning" />
        <SummaryTile label="Task / Review Updates" value={stats.taskReview} icon={ClipboardCheck} tone="neutral" />
      </div>

      <Card>
        <CardHeader
          title="Notification Filters"
          description="Filter by read state, severity, and operational area. Opening the dropdown does not mark anything as read."
          action={
            <button
              type="button"
              className={buttonStyles({ variant: 'outline', size: 'sm' })}
              onClick={() => router.refresh()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          }
        />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title, message, or notification type"
              className="ps-10"
            />
          </div>
          <Select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as QuickFilter);
              setSelectedId(null);
            }}
            aria-label="Notification filter"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-black transition-colors',
                filter === option.value
                  ? 'border-[#F7CBCA] bg-[#F7CBCA] text-white'
                  : 'border-black/10 bg-white text-black/58 hover:border-[#F7CBCA]/35 hover:text-[#F7CBCA]'
              )}
              onClick={() => {
                setFilter(option.value);
                setSelectedId(null);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.75fr)]">
        <Card>
          <CardHeader
            title="All Notifications"
            description={`${visibleNotifications.length} notification${visibleNotifications.length === 1 ? '' : 's'} match the current view.`}
            action={
              <button
                type="button"
                disabled={isPending || notifications.every((notification) => notification.status !== 'unread')}
                className={buttonStyles({ variant: 'outline', size: 'sm' })}
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-4 w-4" />
                Mark all as read
              </button>
            }
          />

          {visibleNotifications.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No notifications yet"
              description="Important task updates, provider alerts, scheduler results, and publishing messages will appear here."
              action={
                <Link href="/dashboard" className={buttonStyles({ variant: 'secondary' })}>
                  Open Dashboard
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {visibleNotifications.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                  selected={selectedNotification?.id === notification.id}
                  disabled={isPending}
                  onSelect={() => setSelectedId(notification.id)}
                  onMarkRead={() => markOneAsRead(notification.id)}
                />
              ))}
            </div>
          )}
        </Card>

        <NotificationDetail
          notification={selectedNotification}
          disabled={isPending}
          onMarkRead={selectedNotification ? () => markOneAsRead(selectedNotification.id) : undefined}
        />
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Bell;
  tone: 'brand' | 'warning' | 'error' | 'neutral';
}) {
  const toneClassName = {
    brand: 'bg-[#D5E5E5] text-[#F7CBCA]',
    warning: 'bg-[#E7F5DC]/26 text-[#8A4300]',
    error: 'bg-[#F1F7F7] text-[#B51F30]',
    neutral: 'bg-white text-black/62',
  }[tone];

  return (
    <article className="rounded-lg border border-[#F7CBCA]/10 bg-white/88 p-5 shadow-[0_18px_42px_rgba(93,107,107,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-black/56">{label}</p>
          <p className="mt-2 text-3xl font-black leading-none text-black">{value}</p>
        </div>
        <div className={cn('rounded-lg border border-black/8 p-3', toneClassName)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function NotificationListItem({
  notification,
  selected,
  disabled,
  onSelect,
  onMarkRead,
}: {
  notification: NotificationRecord;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onMarkRead: () => void;
}) {
  const category = getNotificationCategory(notification);
  const severity = getNotificationSeverity(notification);
  const Icon = categoryIcons[category];
  const SeverityIcon = severityIcons[severity];
  const isUnread = notification.status === 'unread';
  const actionableHref = getActionableNotificationHref(notification);

  return (
    <article
      className={cn(
        'rounded-lg border p-4 transition-colors',
        selected
          ? 'border-[#F7CBCA]/32 bg-[#D5E5E5]/48'
          : isUnread
            ? 'border-[#F7CBCA]/18 bg-[#F1F7F7]'
            : 'border-black/7 bg-white'
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-[#F7CBCA]/12 bg-[#D5E5E5]/56 p-2 text-[#F7CBCA]">
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-black leading-5 text-black">{notification.title}</h3>
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black', severityStyles[severity])}>
              <SeverityIcon className="h-3.5 w-3.5" />
              {severityLabel(severity)}
            </span>
            <StatusBadge status={isUnread ? 'pending' : 'success'} type="system" size="sm" />
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-black/58">{notification.message}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.1em] text-black/40">
            <span>{formatNotificationCategory(category)}</span>
            <span>{formatTimeAgo(notification.created_at)}</span>
            <span>{getNotificationRelatedLabel(notification)}</span>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button
            type="button"
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
            onClick={onSelect}
          >
            إقرأ التفاصيل
          </button>
          {isUnread ? (
            <button
              type="button"
              disabled={disabled}
              className={buttonStyles({ variant: 'ghost', size: 'sm' })}
              onClick={onMarkRead}
            >
              Mark as read
            </button>
          ) : null}
          {actionableHref ? (
            <Link href={actionableHref} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              Open
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : (
            <button type="button" disabled className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              Open
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function NotificationDetail({
  notification,
  disabled,
  onMarkRead,
}: {
  notification: NotificationRecord | null;
  disabled: boolean;
  onMarkRead?: () => void;
}) {
  if (!notification) {
    return (
      <Card>
        <EmptyState
          icon={Inbox}
          title="No notification selected"
          description="Choose a notification to read the full operational context."
        />
      </Card>
    );
  }

  const category = getNotificationCategory(notification);
  const severity = getNotificationSeverity(notification);
  const metadata = safeNotificationMetadata(notification);
  const SeverityIcon = severityIcons[severity];
  const actionableHref = getActionableNotificationHref(notification);

  return (
    <Card className="xl:sticky xl:top-28">
      <CardHeader
        title="Notification Details"
        description="Safe readable context only. Tokens, keys, and raw credentials are never displayed."
        action={
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black', severityStyles[severity])}>
            <SeverityIcon className="h-3.5 w-3.5" />
            {severityLabel(severity)}
          </span>
        }
      />

      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-black leading-snug text-black">{notification.title}</h3>
          <p className="mt-3 text-sm leading-6 text-black/62">{notification.message}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailLine label="Category" value={formatNotificationCategory(category)} />
          <DetailLine label="Type" value={formatNotificationType(notification.type)} />
          <DetailLine label="Created" value={formatDateTime(notification.created_at)} />
          <DetailLine label="Status" value={notification.status === 'unread' ? 'Unread' : notification.status === 'archived' ? 'Archived' : 'Read'} />
        </div>

        <div className="rounded-lg border border-black/8 bg-[#F1F7F7] p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-black/42">Related Item</p>
          <p className="mt-2 text-sm font-bold text-black">{getNotificationRelatedLabel(notification)}</p>
          {actionableHref ? (
            <Link href={actionableHref} className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-3' })}>
              Open related item
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : (
            <button type="button" disabled className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-3' })}>
              Open related item
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>

        {metadata.length > 0 ? (
          <div className="rounded-lg border border-black/8 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-black/42">Safe Metadata Summary</p>
            <dl className="mt-3 space-y-2">
              {metadata.map((entry) => (
                <div key={entry.key} className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <dt className="text-xs font-bold uppercase tracking-[0.08em] text-black/38">{entry.key}</dt>
                  <dd className="text-sm leading-6 text-black/62">{entry.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {notification.status === 'unread' && onMarkRead ? (
            <button
              type="button"
              disabled={disabled}
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
              onClick={onMarkRead}
            >
              <CheckCheck className="h-4 w-4" />
              Mark as read
            </button>
          ) : null}
          <Link href="/dashboard/settings#provider-setup-wizard" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
            <Settings className="h-4 w-4" />
            Provider Setup
          </Link>
        </div>
      </div>
    </Card>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/8 bg-[#F1F7F7] p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-black/42">{label}</p>
      <p className="mt-1 text-sm font-bold leading-5 text-black">{value}</p>
    </div>
  );
}
