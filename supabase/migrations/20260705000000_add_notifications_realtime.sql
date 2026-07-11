-- Enable Supabase Realtime on notifications table for instant push updates.
--
-- Supabase Realtime works via the publication + REPLICA IDENTITY approach:
-- 1. REPLICA IDENTITY FULL ensures UPDATE/DELETE events carry the full row
-- 2. ALTER PUBLICATION adds the table to the realtime publication
-- 3. No custom trigger needed — Supabase Realtime automatically broadcasts
--    changes to subscribed clients.

-- 1. Ensure REPLICA IDENTITY FULL so Supabase captures full row data on changes
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 2. Add notifications to the supabase_realtime publication
--    (safe to re-run: ALTER PUBLICATION ... ADD TABLE is idempotent when the table is already present)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 3. Ensure the index covers the realtime query pattern (workspace + user + status)
CREATE INDEX IF NOT EXISTS notifications_workspace_user_status_idx
  ON public.notifications (workspace_id, user_id, status, created_at DESC);
