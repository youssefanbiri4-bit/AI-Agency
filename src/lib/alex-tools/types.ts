import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type AlexToolCategory = 'read' | 'draft' | 'create' | 'blocked';
export type AlexToolRiskLevel = 'read_only' | 'draft_only' | 'requires_confirmation' | 'blocked';

export interface AlexToolContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  workspaceId: string;
  workspaceName: string;
}

export interface AlexToolResult {
  toolId: string;
  toolName: string;
  category: AlexToolCategory;
  riskLevel: AlexToolRiskLevel;
  sourceLabel: string;
  summary: string;
  items?: Array<Record<string, string | number | boolean | null>>;
  draft?: AlexDraftAction | null;
  blocked?: boolean;
  error?: string | null;
}

export interface AlexDraftAction {
  type:
    | 'task'
    | 'content_studio'
    | 'workflow_plan'
    | 'n8n_blueprint'
    | 'quality_review'
    | 'playbook'
    | 'follow_up_message';
  title: string;
  description: string;
  metadata: Record<string, string | number | boolean | null>;
  safetyNote: string;
}

export interface AlexToolDefinition {
  id: string;
  name: string;
  description: string;
  category: AlexToolCategory;
  riskLevel: AlexToolRiskLevel;
  allowed: boolean;
  handler?: (input: unknown, context: AlexToolContext) => Promise<AlexToolResult>;
}

export interface AlexToolRunSummary {
  toolsUsed: AlexToolResult[];
  draftAction: AlexDraftAction | null;
  blockedMessages: string[];
}
