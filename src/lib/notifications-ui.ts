import type { JsonObject } from '@/types';
import type { NotificationRecord, NotificationSeverity, NotificationType } from '@/types/database';

export type NotificationCategory =
  | 'task'
  | 'review'
  | 'content'
  | 'creative_asset'
  | 'provider'
  | 'scheduler'
  | 'publishing'
  | 'system'
  | 'recovery'
  | 'calendar';

export const notificationCategories: NotificationCategory[] = [
  'task',
  'review',
  'content',
  'creative_asset',
  'provider',
  'scheduler',
  'publishing',
  'system',
  'recovery',
  'calendar',
];

export const notificationSeverities: NotificationSeverity[] = [
  'info',
  'success',
  'warning',
  'error',
  'critical',
];

function metadataString(metadata: JsonObject, key: string) {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getNotificationCategory(notification: NotificationRecord): NotificationCategory {
  const metadataCategory = metadataString(notification.metadata, 'category');

  if (metadataCategory && notificationCategories.includes(metadataCategory as NotificationCategory)) {
    return metadataCategory as NotificationCategory;
  }

  const type = notification.type;

  if (type.startsWith('task_') || type === 'campaign_task_created') return 'task';
  if (type.startsWith('review_')) return 'review';
  if (type.startsWith('content_')) return 'content';
  if (type.startsWith('creative_') || type.startsWith('reel_')) return 'creative_asset';
  if (type.includes('provider') || type.includes('connection') || type.includes('setup_required') || type === 'approval_pending') return 'provider';
  if (type.startsWith('scheduler_')) return 'scheduler';
  if (type.startsWith('publishing_')) return 'publishing';
  if (type.startsWith('recovery_')) return 'recovery';
  if (type.startsWith('calendar_')) return 'calendar';
  if (type === 'report_ready') return 'system';

  return 'system';
}

export function getNotificationSeverity(notification: NotificationRecord): NotificationSeverity {
  if (notification.severity) {
    return notification.severity;
  }

  const type = notification.type;
  if (type.includes('failed')) return 'error';
  if (type.includes('setup_required') || type.includes('approval_pending')) return 'warning';
  if (type.includes('completed') || type.includes('published') || type.includes('generated') || type.includes('approved')) return 'success';
  return 'info';
}

export function formatNotificationType(type: NotificationType) {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatNotificationCategory(category: NotificationCategory) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getNotificationRelatedLabel(notification: NotificationRecord) {
  if (notification.related_entity_type) {
    return formatNotificationCategory(notification.related_entity_type as NotificationCategory);
  }

  const category = getNotificationCategory(notification);
  return formatNotificationCategory(category);
}

export function getNotificationHref(notification: NotificationRecord) {
  if (notification.related_url?.startsWith('/dashboard')) {
    return notification.related_url;
  }

  const relatedId = notification.related_entity_id;
  const entityType = notification.related_entity_type;
  const taskId = relatedId ?? metadataString(notification.metadata, 'task_id') ?? metadataString(notification.metadata, 'taskId');
  const contentItemId =
    relatedId ?? metadataString(notification.metadata, 'content_item_id') ?? metadataString(notification.metadata, 'itemId');
  const creativeAssetId =
    relatedId ?? metadataString(notification.metadata, 'creative_asset_id') ?? metadataString(notification.metadata, 'assetId');

  if (entityType === 'task' && taskId) return `/dashboard/tasks/${taskId}`;
  if (entityType === 'review' && taskId) return `/dashboard/tasks/${taskId}`;
  if (entityType === 'content' && contentItemId) return `/dashboard/content-studio?item=${contentItemId}`;
  if (entityType === 'creative_asset' && creativeAssetId) return `/dashboard/creative-assets/${creativeAssetId}`;
  if (entityType === 'provider') return '/dashboard/settings#provider-setup-wizard';
  if (entityType === 'scheduler') return '/dashboard/calendar';
  if (entityType === 'publishing') return contentItemId ? `/dashboard/content-studio?item=${contentItemId}` : '/dashboard/reports';
  if (entityType === 'recovery') return '/dashboard/recovery';
  if (entityType === 'calendar') return '/dashboard/calendar';

  if (taskId && getNotificationCategory(notification) === 'task') return `/dashboard/tasks/${taskId}`;
  if (creativeAssetId && getNotificationCategory(notification) === 'creative_asset') return `/dashboard/creative-assets/${creativeAssetId}`;
  if (contentItemId && ['content', 'publishing'].includes(getNotificationCategory(notification))) return `/dashboard/content-studio?item=${contentItemId}`;

  if (
    notification.type === 'campaign_task_created' ||
    notification.type === 'meta_connection_connected' ||
    notification.type === 'ad_platform_setup_required' ||
    notification.type === 'provider_setup_required' ||
    notification.type === 'approval_pending'
  ) {
    return '/dashboard/settings#provider-setup-wizard';
  }

  if (notification.type === 'report_ready') return '/dashboard/reports';

  return '/dashboard/notifications';
}

export function getActionableNotificationHref(notification: NotificationRecord) {
  const href = getNotificationHref(notification);
  if (href === '/dashboard/notifications') return null;
  if (/^\/dashboard\/notifications\/[^/?#]+/.test(href)) return null;
  if (href === '/dashboard/provider-setup') return '/dashboard/settings#provider-setup-wizard';
  return href;
}

export function safeNotificationMetadata(notification: NotificationRecord) {
  const blocked = new Set([
    'api_key',
    'access_token',
    'refresh_token',
    'token',
    'secret',
    'password',
    'authorization',
    'credential',
    'credentials',
  ]);

  return Object.entries(notification.metadata)
    .filter(([key, value]) => {
      const normalized = key.toLowerCase();
      return !blocked.has(normalized) && !normalized.includes('token') && !normalized.includes('secret') && value !== null && typeof value !== 'object';
    })
    .slice(0, 8)
    .map(([key, value]) => ({
      key,
      value: String(value),
    }));
}
