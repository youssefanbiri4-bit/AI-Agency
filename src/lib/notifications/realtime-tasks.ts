'use client';

/**
 * Realtime Task Status Hook
 *
 * Subscribes to Supabase Realtime postgres_changes on the tasks table
 * scoped to a specific workspace. Fires a callback when task status changes,
 * enabling live UI updates without polling.
 *
 * Requires: tasks table added to supabase_realtime publication
 * (done in migration alongside notifications).
 */

import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-client';
import { logger } from '@/lib/logger';

const realtimeLog = logger.child('realtime-tasks');

export type TaskEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface TaskChangeEvent {
  event: TaskEventType;
  taskId: string;
  newStatus: string | null;
  oldStatus: string | null;
  workspaceId: string;
  /** The full new row data (may be null on DELETE) */
  newRow: Record<string, unknown> | null;
}

export interface UseRealtimeTaskStatusOptions {
  workspaceId: string;
  enabled?: boolean;
  /** Called when any task in the workspace changes */
  onTaskChange: (event: TaskChangeEvent) => void;
  /** Called when the connection status changes */
  onConnectionChange?: (status: 'connected' | 'disconnected' | 'error') => void;
}

/**
 * Hook: subscribes to postgres_changes on the tasks table.
 * Only fires for INSERT, UPDATE, DELETE events within the workspace.
 */
export function useRealtimeTaskStatus({
  workspaceId,
  enabled = true,
  onTaskChange,
  onConnectionChange,
}: UseRealtimeTaskStatusOptions) {
  const onTaskChangeRef = useRef(onTaskChange);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !workspaceId) return;

    const channelName = `tasks-db:${workspaceId}`;

    realtimeLog.info('subscribing to task changes', { channelName });

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          try {
            const eventType = payload.eventType as TaskEventType;
            const newRow = payload.new as Record<string, unknown> | null;
            const oldRow = payload.old as Record<string, unknown> | null;

            const event: TaskChangeEvent = {
              event: eventType,
              taskId: (newRow?.id ?? oldRow?.id) as string,
              newStatus: (newRow?.status as string) ?? null,
              oldStatus: (oldRow?.status as string) ?? null,
              workspaceId,
              newRow,
            };

            realtimeLog.debug('task change received', {
              event: eventType,
              taskId: event.taskId,
              oldStatus: event.oldStatus,
              newStatus: event.newStatus,
            });

            onTaskChangeRef.current(event);
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

    onTaskChangeRef.current = onTaskChange;
    onConnectionChangeRef.current = onConnectionChange;

    return () => {
      realtimeLog.info('unsubscribing', { channelName });
      supabase.removeChannel(channel);
    };
  }, [workspaceId, enabled, onTaskChange, onConnectionChange]);
}
