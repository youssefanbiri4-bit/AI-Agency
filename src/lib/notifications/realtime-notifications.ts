'use client';

/**
 * Realtime Notifications Hook
 *
 * Subscribes to Supabase Realtime postgres_changes on the notifications table
 * scoped to a specific workspace. When a new notification is inserted or
 * updated, the callback fires so the UI can update instantly without polling.
 *
 * Requires: notifications table added to supabase_realtime publication
 * (done in migration 20260705000000_add_notifications_realtime.sql).
 */

import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-client';
import type { NotificationRecord } from '@/types/database';
import { logger } from '@/lib/logger';

const realtimeLog = logger.child('realtime-notifications');

export interface RealtimeNotificationEvent {
  /** INSERT, UPDATE, or DELETE */
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  /** The new row (null on DELETE) */
  new: NotificationRecord | null;
  /** The old row (null on INSERT) */
  old: NotificationRecord | null;
  /** The workspace_id from the changed row */
  workspace_id: string;
}

export interface UseRealtimeNotificationsOptions {
  /** Current workspace ID — subscription is scoped to this workspace */
  workspaceId: string;
  /** Current user ID — only notifications for this user are relevant */
  userId: string;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Callback fired when a relevant notification change arrives */
  onNotification: (event: RealtimeNotificationEvent) => void;
  /** Callback fired when the connection status changes */
  onConnectionChange?: (status: 'connected' | 'disconnected' | 'error') => void;
}

/**
 * Primary hook: subscribes to postgres_changes on the notifications table.
 *
 * This uses the Supabase Realtime publication (ALTER PUBLICATION) which
 * automatically broadcasts INSERT/UPDATE/DELETE events to subscribed clients.
 * The filter scopes events to the current workspace.
 */
export function useRealtimeNotifications({
  workspaceId,
  userId,
  enabled = true,
  onNotification,
  onConnectionChange,
}: UseRealtimeNotificationsOptions) {
  const onNotificationRef = useRef(onNotification);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !workspaceId || !userId) return;

    const channelName = `notifications-db:${workspaceId}:${userId}`;

    realtimeLog.info('subscribing (postgres_changes)', { channelName });

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase generic typing is too narrow for wildcard events
        (payload: any) => {
          try {
            const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
            const newRow = (payload.new ?? null) as NotificationRecord | null;
            const oldRow = (payload.old ?? null) as NotificationRecord | null;

            // Only process notifications for this user
            if (newRow && newRow.user_id !== userId) return;

            const event: RealtimeNotificationEvent = {
              event: eventType,
              new: newRow,
              old: oldRow,
              workspace_id: workspaceId,
            };

            realtimeLog.debug('received', {
              event: eventType,
              notificationId: newRow?.id,
            });

            onNotificationRef.current(event);
          } catch (err) {
            realtimeLog.warn('postgres_changes parse error', {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      )
      .subscribe((status) => {
        realtimeLog.debug('subscribe status', { status });

        if (status === 'SUBSCRIBED') {
          onConnectionChangeRef.current?.('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          onConnectionChangeRef.current?.('error');
        } else if (status === 'CLOSED') {
          onConnectionChangeRef.current?.('disconnected');
        }
      });

    // Sync latest callbacks on every render to avoid stale closures
    onNotificationRef.current = onNotification;
    onConnectionChangeRef.current = onConnectionChange;

    return () => {
      realtimeLog.info('unsubscribing', { channelName });
      supabase.removeChannel(channel);
    };
  }, [workspaceId, userId, enabled, onNotification, onConnectionChange]);
}
