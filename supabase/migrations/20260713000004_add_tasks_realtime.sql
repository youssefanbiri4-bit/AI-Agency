-- Migration: Add tasks table to supabase_realtime publication
-- Enables realtime task status updates for the useRealtimeTaskStatus hook

-- Up
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
