-- Migration: Create workspace_alert_channels table
-- Stores per-workspace external alert channel configuration
-- (Slack webhooks, email addresses, etc.)

-- Up
CREATE TABLE IF NOT EXISTS workspace_alert_channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_type    TEXT NOT NULL CHECK (channel_type IN ('slack', 'email')),
  -- For slack: the webhook URL; for email: comma-separated recipient list
  target          TEXT NOT NULL,
  -- Human label for UI display
  label           TEXT,
  -- Whether this channel is active
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each workspace can have at most one config per channel type
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_alert_channels_type
  ON workspace_alert_channels (workspace_id, channel_type);

-- Enable RLS
ALTER TABLE workspace_alert_channels ENABLE ROW LEVEL SECURITY;

-- Only workspace admins/owners can manage alert channels
CREATE POLICY alert_channels_admin_all ON workspace_alert_channels
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Members can read alert channel config (to know if alerts are set up)
CREATE POLICY alert_channels_member_read ON workspace_alert_channels
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Enable realtime for live UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_alert_channels;
