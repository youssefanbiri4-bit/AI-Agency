import type { AgentType, DepartmentName, JsonObject, JsonValue, TaskStatus } from './index';

export type WorkspaceRole = 'owner' | 'admin' | 'operator' | 'editor' | 'viewer';
export type BillingPlan = 'free' | 'starter' | 'pro' | 'agency' | 'enterprise';

export type BillingPeriod = 'monthly' | 'yearly';

export interface PlanFeature {
  key: string;
  label: string;
  included: boolean;
  limit?: string | number;
}

export interface SeatPricing {
  /** Price per seat per month in USD */
  perSeatMonth: number;
  /** Minimum seats required */
  minSeats: number;
  /** Maximum seats allowed (null = unlimited) */
  maxSeats: number | null;
  /** Included seats in the base price */
  includedSeats: number;
}

export interface UsagePricing {
  /** Included usage units per month */
  includedUnits: number;
  /** Price per additional unit */
  overagePerUnit: number;
  /** Unit label */
  unitLabel: string;
}

export interface PlanDefinition {
  id: BillingPlan;
  name: string;
  description: string;
  /** Monthly price in USD (0 for free) */
  monthlyPrice: number;
  /** Yearly price in USD (0 for free) */
  yearlyPrice: number;
  /** Features included in this plan */
  features: PlanFeature[];
  /** Seat-based pricing (null if not seat-based) */
  seatPricing: SeatPricing | null;
  /** Usage-based pricing per quota type */
  usagePricing: Partial<Record<string, UsagePricing>>;
  /** Whether the plan has hard limits vs soft warnings */
  hardLimits: boolean;
  /** Whether this plan is publicly visible for upgrade */
  isUpgradeTarget: boolean;
  /** Sort order in UI */
  sortOrder: number;
  /** Badge color for UI */
  color: string;
}

export type TaskPriority = 'Low' | 'Normal' | 'High';
export type SupabaseConnectionStatus = 'not_configured' | 'configured';
export type N8nConnectionStatus = 'not_connected' | 'prepared' | 'connected';
export type AdConnectionProvider = 'meta' | 'google_ads' | 'pinterest';
export type AdConnectionStatus = 'connected' | 'expired' | 'revoked' | 'error';
export type ContentStudioPublishAttemptProvider = 'meta' | 'google_ads' | 'pinterest' | 'linkedin';
export type ContentStudioPublishAttemptActionType =
  | 'publish_post'
  | 'publish_reel'
  | 'create_campaign_draft'
  | 'create_paused_meta_ad_draft'
  | 'publish_pin'
  | 'manual_handoff';
export type ContentStudioPublishAttemptStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'setup_required'
  | 'approval_pending'
  | 'billing_required'
  | 'quota_limit'
  | 'token_missing'
  | 'manual_only'
  | 'unsupported'
  | 'error';
export type ReelStatus = 'draft' | 'ready' | 'scheduled' | 'publishing' | 'published' | 'failed';
export type CreativeAssetType =
  | 'image'
  | 'video'
  | 'reel_cover'
  | 'reel_video'
  | 'ad_creative'
  | 'thumbnail'
  | 'campaign_visual'
  | 'carousel_slide'
  | 'story_visual';
export type CreativeAssetPlatform =
  | 'instagram'
  | 'facebook'
  | 'google_ads'
  | 'pinterest'
  | 'general';
export type CreativeAssetStatus =
  | 'draft'
  | 'prompt_ready'
  | 'generating'
  | 'generated'
  | 'failed'
  | 'selected'
  | 'archived';
export type CreativeAssetSource = 'prompt_only' | 'openai' | 'upload';
export type CreativeAssetAspectRatio = '1:1' | '4:5' | '9:16' | '16:9';
export type CreativeAssetOutputStyle =
  | 'premium_saas'
  | 'realistic'
  | 'minimal'
  | 'bold_ad'
  | 'clean_corporate'
  | 'luxury';
export type ContentStudioPlatform =
  | 'facebook'
  | 'instagram'
  | 'google_ads'
  | 'pinterest'
  | 'linkedin';
export type ContentStudioType =
  | 'facebook_post'
  | 'instagram_post'
  | 'facebook_reel'
  | 'instagram_reel'
  | 'facebook_feed_ad'
  | 'instagram_feed_ad'
  | 'facebook_reel_ad'
  | 'instagram_reel_ad'
  | 'facebook_story_ad'
  | 'instagram_story_ad'
  | 'facebook_carousel_ad'
  | 'instagram_carousel_ad'
  | 'google_ads_campaign_draft'
  | 'pinterest_pin'
  | 'linkedin_post_planner';
export type ContentStudioStatus =
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'approval_pending'
  | 'setup_required';
export type NotificationType =
  | 'task_created'
  | 'task_needs_review'
  | 'task_completed'
  | 'task_failed'
  | 'review_approved'
  | 'review_changes_requested'
  | 'report_ready'
  | 'campaign_task_created'
  | 'meta_connection_connected'
  | 'ad_platform_setup_required'
  | 'provider_setup_required'
  | 'approval_pending'
  | 'content_item_created'
  | 'content_item_updated'
  | 'content_item_scheduled'
  | 'content_item_published'
  | 'content_item_failed'
  | 'publishing_failed'
  | 'publishing_setup_required'
  | 'scheduler_completed'
  | 'scheduler_failed'
  | 'calendar_plan_created'
  | 'recovery_issue_detected'
  | 'reel_draft_created'
  | 'reel_marked_ready'
  | 'reel_published'
  | 'reel_failed'
  | 'reel_ai_script_task_created'
  | 'reel_ai_caption_task_created'
  | 'creative_asset_created'
  | 'creative_prompt_ready'
  | 'creative_image_generated'
  | 'creative_image_failed'
  | 'quota_warning'
  | 'quota_critical'
  | 'churn_warning'
  | 'win_back';
export type NotificationStatus = 'unread' | 'read' | 'archived';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error' | 'critical';
export type ProjectStatus =
  | 'planning'
  | 'active'
  | 'paused'
  | 'needs_review'
  | 'ready_to_deploy'
  | 'deployed'
  | 'maintenance'
  | 'archived';
export type ProjectType =
  | 'software'
  | 'SaaS'
  | 'website'
  | 'automation'
  | 'marketing_campaign'
  | 'AI_tool'
  | 'internal_system'
  | 'documentation';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type PromptCategory =
  | 'development'
  | 'deployment'
  | 'bug_fix'
  | 'ui_ux'
  | 'supabase'
  | 'vercel'
  | 'n8n'
  | 'provider_setup'
  | 'ads_publishing'
  | 'reports'
  | 'documentation'
  | 'project_planning'
  | 'creative_assets'
  | 'content_studio'
  | 'agents'
  | 'general';
export type PromptTargetTool =
  | 'codex'
  | 'opencode'
  | 'kilo_code'
  | 'n8n_ai'
  | 'chatgpt'
  | 'supabase_sql_editor'
  | 'vercel_cli'
  | 'general_ai_tool';
export type ReleaseStatus =
  | 'draft'
  | 'ready_for_test'
  | 'testing'
  | 'ready_to_deploy'
  | 'deployed'
  | 'failed'
  | 'rolled_back'
  | 'archived';
export type ReleaseType =
  | 'feature'
  | 'bug_fix'
  | 'ui_update'
  | 'provider_update'
  | 'database_migration'
  | 'deployment'
  | 'documentation'
  | 'stabilization'
  | 'security'
  | 'internal_tooling';
export type AgentTemplateUsageActionType =
  | 'view_template'
  | 'use_with_alex'
  | 'create_task'
  | 'send_to_content_studio'
  | 'export_n8n_plan'
  | 'copy_prompt'
  | 'copy_workflow_plan'
  | 'create_workflow_draft'
  | 'download_workflow_plan'
  | 'create_tasks_from_workflow'
  | 'add_template_to_workflow'
  | 'review_workflow'
  | 'copy_workflow_review'
  | 'download_workflow_review'
  | 'approval_confirmed_for_pending_tasks'
  | 'blocked_unsafe_workflow_action'
  | 'save_workflow_playbook'
  | 'update_workflow_playbook'
  | 'open_workflow_playbook'
  | 'duplicate_workflow_playbook'
  | 'favorite_workflow_playbook'
  | 'delete_workflow_playbook'
  | 'export_workflow_playbook';
export type AgentTemplateUsageSourcePage = 'agent_library' | 'alex' | 'content_studio';
export type AgentWorkflowPlaybookStatus = 'draft' | 'ready' | 'archived';
export type AgentBuilderSafetyLevel = 'safe' | 'requires_review' | 'readonly';
export type AgentBuilderExecutionMode = 'autonomous' | 'supervised' | 'manual' | 'draft_only';
export type AgentBuilderVisibility = 'workspace' | 'marketplace';

// ===== Missing Table Types (defined in DB but not in existing types) =====

export type BackupRecordStatus = 'created' | 'previewed' | 'failed' | 'archived';

export type SafePatchPlanChangeType =
  | 'bug_fix'
  | 'ui_update'
  | 'feature'
  | 'refactor'
  | 'security'
  | 'database_migration'
  | 'provider_update'
  | 'docs'
  | 'deployment'
  | 'stabilization';

export type SafePatchPlanPriority = 'low' | 'medium' | 'high' | 'urgent';

export type SafePatchPlanRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SafePatchPlanStatus =
  | 'draft'
  | 'needs_review'
  | 'approved_to_prompt'
  | 'copied_to_codex'
  | 'implemented_externally'
  | 'rejected'
  | 'archived';

export type PullRequestReviewRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type PullRequestReviewRecommendation =
  | 'safe_to_merge_after_tests'
  | 'request_changes'
  | 'needs_manual_review'
  | 'do_not_merge_yet';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      usage_costs: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          operation_type: string;
          model: string | null;
          input_tokens: number;
          output_tokens: number;
          image_count: number;
          n8n_executions: number;
          estimated_cost_usd: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          operation_type: string;
          model?: string | null;
          input_tokens?: number;
          output_tokens?: number;
          image_count?: number;
          n8n_executions?: number;
          estimated_cost_usd?: number;
          created_at?: string;
        };
        Update: {
          operation_type?: string;
          model?: string | null;
          estimated_cost_usd?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'usage_costs_workspace_id_fkey';
            columns: ['workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      backup_jobs: {
        Row: {
          id: string;
          workspace_id: string | null;
          job_type: string;
          status: string;
          destination: string | null;
          destination_path: string | null;
          size_bytes: number;
          started_at: string;
          finished_at: string | null;
          rpo_target_minutes: number | null;
          rto_target_minutes: number | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          job_type: string;
          status?: string;
          destination?: string | null;
          destination_path?: string | null;
          size_bytes?: number;
          started_at?: string;
          finished_at?: string | null;
          rpo_target_minutes?: number | null;
          rto_target_minutes?: number | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          status?: string;
          destination?: string | null;
          destination_path?: string | null;
          size_bytes?: number;
          finished_at?: string | null;
          error_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'backup_jobs_workspace_id_fkey';
            columns: ['workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      marketing_events: {
        Row: {
          id: string;
          event_type: string;
          experiment: string | null;
          variant: string | null;
          workspace_id: string | null;
          anonymous_id: string | null;
          metadata: JsonObject;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          experiment?: string | null;
          variant?: string | null;
          workspace_id?: string | null;
          anonymous_id?: string | null;
          metadata?: JsonObject;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          experiment?: string | null;
          variant?: string | null;
          workspace_id?: string | null;
          anonymous_id?: string | null;
          metadata?: JsonObject;
        };
        Relationships: [
          {
            foreignKeyName: 'marketing_events_workspace_id_fkey';
            columns: ['workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      referrals: {
        Row: {
          id: string;
          code: string;
          referrer_user_id: string;
          referrer_workspace_id: string;
          referred_email: string | null;
          referred_user_id: string | null;
          status: string;
          reward_granted: boolean;
          created_at: string;
          completed_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          referrer_user_id: string;
          referrer_workspace_id: string;
          referred_email?: string | null;
          referred_user_id?: string | null;
          status?: string;
          reward_granted?: boolean;
          created_at?: string;
          completed_at?: string | null;
          expires_at?: string | null;
        };
        Update: {
          code?: string;
          referred_email?: string | null;
          referred_user_id?: string | null;
          status?: string;
          reward_granted?: boolean;
          completed_at?: string | null;
          expires_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'referrals_referrer_user_id_fkey';
            columns: ['referrer_user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'referrals_referrer_workspace_id_fkey';
            columns: ['referrer_workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      referral_rewards: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string;
          points: number;
          reason: string;
          referral_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id: string;
          points?: number;
          reason: string;
          referral_id?: string | null;
          created_at?: string;
        };
        Update: {
          points?: number;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'referral_rewards_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'referral_rewards_workspace_id_fkey';
            columns: ['workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'referral_rewards_referral_id_fkey';
            columns: ['referral_id'];
            referencedRelation: 'referrals';
            referencedColumns: ['id'];
          },
        ];
      };
      system_health_snapshots: {
        Row: {
          id: string;
          workspace_id: string | null;
          status: string;
          score: number;
          metrics: JsonObject;
          details: JsonObject;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          status: string;
          score: number;
          metrics?: JsonObject;
          details?: JsonObject;
          created_at?: string;
        };
        Update: {
          status?: string;
          score?: number;
          metrics?: JsonObject;
          details?: JsonObject;
        };
        Relationships: [
          {
            foreignKeyName: 'system_health_snapshots_workspace_id_fkey';
            columns: ['workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_alert_channels: {
        Row: {
          id: string;
          workspace_id: string;
          channel_type: string;
          target: string;
          label: string | null;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          channel_type: string;
          target: string;
          label?: string | null;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          channel_type?: string;
          target?: string;
          label?: string | null;
          enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_alert_channels_workspace_id_fkey';
            columns: ['workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string | null;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          department: string | null;
          permissions: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role?: WorkspaceRole;
          department?: string | null;
          permissions?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          role?: WorkspaceRole;
          department?: string | null;
          permissions?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          id: 'research_strategy' | 'content_growth' | 'sales_operations' | 'development_engineering';
          name: DepartmentName;
          description: string;
          color: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: 'research_strategy' | 'content_growth' | 'sales_operations' | 'development_engineering';
          name: DepartmentName;
          description: string;
          color: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: DepartmentName;
          description?: string;
          color?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      agents: {
        Row: {
          id: AgentType;
          department_id: 'research_strategy' | 'content_growth' | 'sales_operations' | 'development_engineering';
          name: string;
          role: string;
          description: string;
          capabilities: string[];
          example_tasks: string[];
          icon: string;
          color: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: AgentType;
          department_id: 'research_strategy' | 'content_growth' | 'sales_operations' | 'development_engineering';
          name: string;
          role: string;
          description: string;
          capabilities?: string[];
          example_tasks?: string[];
          icon: string;
          color: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          department_id?: 'research_strategy' | 'content_growth' | 'sales_operations' | 'development_engineering';
          name?: string;
          role?: string;
          description?: string;
          capabilities?: string[];
          example_tasks?: string[];
          icon?: string;
          color?: string;
          sort_order?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          agent_type: AgentType;
          title: string;
          description: string;
          input_data: JsonObject;
          status: TaskStatus;
          priority: TaskPriority;
          result: JsonObject | null;
          n8n_execution_id: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string;
          agent_type: AgentType;
          title: string;
          description: string;
          input_data?: JsonObject;
          status?: TaskStatus;
          priority?: TaskPriority;
          result?: JsonObject | null;
          n8n_execution_id?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          title?: string;
          description?: string;
          agent_type?: AgentType;
          input_data?: JsonObject;
          status?: TaskStatus;
          priority?: TaskPriority;
          result?: JsonObject | null;
          n8n_execution_id?: string | null;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      task_reviews: {
        Row: {
          id: string;
          workspace_id: string;
          task_id: string;
          reviewer_id: string;
          rating: number;
          feedback: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string;
          task_id: string;
          reviewer_id?: string;
          rating: number;
          feedback?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          rating?: number;
          feedback?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_events: {
        Row: {
          id: string;
          workspace_id: string;
          task_id: string | null;
          actor_id: string | null;
          event_type: string;
          message: string;
          metadata: JsonObject;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string;
          task_id?: string | null;
          actor_id?: string | null;
          event_type: string;
          message: string;
          metadata?: JsonObject;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          message?: string;
          metadata?: JsonObject;
        };
        Relationships: [];
      };
      n8n_callback_events: {
        Row: {
          id: string;
          callback_key: string;
          source_route: string;
          task_id: string;
          workspace_id: string;
          callback_status: string | null;
          execution_identifier: string | null;
          payload_hash: string;
          outcome: 'accepted' | 'processed' | 'duplicate' | 'stale_ignored' | 'failed';
          metadata: JsonObject;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          callback_key: string;
          source_route: string;
          task_id: string;
          workspace_id: string;
          callback_status?: string | null;
          execution_identifier?: string | null;
          payload_hash: string;
          outcome?: 'accepted' | 'processed' | 'duplicate' | 'stale_ignored' | 'failed';
          metadata?: JsonObject;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          outcome?: 'accepted' | 'processed' | 'duplicate' | 'stale_ignored' | 'failed';
          metadata?: JsonObject;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      agent_template_usage_events: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          template_id: string;
          template_name: string;
          template_category: string;
          action_type: AgentTemplateUsageActionType;
          source_page: AgentTemplateUsageSourcePage;
          metadata: JsonObject;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          template_id: string;
          template_name: string;
          template_category: string;
          action_type: AgentTemplateUsageActionType;
          source_page: AgentTemplateUsageSourcePage;
          metadata?: JsonObject;
          created_at?: string;
        };
        Update: {
          template_name?: string;
          template_category?: string;
          action_type?: AgentTemplateUsageActionType;
          source_page?: AgentTemplateUsageSourcePage;
          metadata?: JsonObject;
        };
        Relationships: [];
      };
      usage_events: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          event_type: string;
          quota_type: string;
          amount: number;
          metadata: JsonObject;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          event_type: string;
          quota_type: string;
          amount?: number;
          metadata?: JsonObject;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          quota_type?: string;
          amount?: number;
          metadata?: JsonObject;
        };
        Relationships: [];
      };
      agent_workflow_playbooks: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          name: string;
          description: string | null;
          goal: string | null;
          steps: JsonValue;
          notes: string | null;
          status: AgentWorkflowPlaybookStatus;
          is_favorite: boolean;
          last_opened_at: string | null;
          last_used_at: string | null;
          usage_count: number;
          readiness_summary: JsonObject;
          diagram: JsonObject;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          name: string;
          description?: string | null;
          goal?: string | null;
          steps?: JsonValue;
          notes?: string | null;
          status?: AgentWorkflowPlaybookStatus;
          is_favorite?: boolean;
          last_opened_at?: string | null;
          last_used_at?: string | null;
          usage_count?: number;
          readiness_summary?: JsonObject;
          diagram?: JsonObject;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          goal?: string | null;
          steps?: JsonValue;
          notes?: string | null;
          status?: AgentWorkflowPlaybookStatus;
          is_favorite?: boolean;
          last_opened_at?: string | null;
          last_used_at?: string | null;
          usage_count?: number;
          readiness_summary?: JsonObject;
          diagram?: JsonObject;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_builder_agents: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string | null;
          name: string;
          role: string;
          description: string | null;
          category: string;
          icon: string;
          accent_color: string;
          instructions: string;
          inputs: string[];
          outputs: string[];
          safety_level: AgentBuilderSafetyLevel;
          execution_mode: AgentBuilderExecutionMode;
          review_checklist: string[];
          tags: string[];
          prompt_library_id: string | null;
          is_template: boolean;
          visibility: AgentBuilderVisibility;
          share_slug: string | null;
          usage_count: number;
          last_used_at: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by?: string | null;
          name: string;
          role?: string;
          description?: string | null;
          category?: string;
          icon?: string;
          accent_color?: string;
          instructions: string;
          inputs?: string[];
          outputs?: string[];
          safety_level?: AgentBuilderSafetyLevel;
          execution_mode?: AgentBuilderExecutionMode;
          review_checklist?: string[];
          tags?: string[];
          prompt_library_id?: string | null;
          is_template?: boolean;
          visibility?: AgentBuilderVisibility;
          share_slug?: string | null;
          usage_count?: number;
          last_used_at?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          role?: string;
          description?: string | null;
          category?: string;
          icon?: string;
          accent_color?: string;
          instructions?: string;
          inputs?: string[];
          outputs?: string[];
          safety_level?: AgentBuilderSafetyLevel;
          execution_mode?: AgentBuilderExecutionMode;
          review_checklist?: string[];
          tags?: string[];
          prompt_library_id?: string | null;
          is_template?: boolean;
          visibility?: AgentBuilderVisibility;
          share_slug?: string | null;
          usage_count?: number;
          last_used_at?: string | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes: string[];
          rate_limit: number;
          status: string;
          expires_at: string | null;
          last_used_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes?: string[];
          rate_limit?: number;
          status?: string;
          expires_at?: string | null;
          last_used_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          scopes?: string[];
          rate_limit?: number;
          status?: string;
          expires_at?: string | null;
          last_used_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string | null;
          subject: string;
          description: string;
          status: string;
          priority: string;
          category: string;
          assigned_to: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by?: string | null;
          subject: string;
          description: string;
          status?: string;
          priority?: string;
          category?: string;
          assigned_to?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          created_by?: string | null;
          subject?: string;
          description?: string;
          status?: string;
          priority?: string;
          category?: string;
          assigned_to?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_feedback: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string | null;
          author_email: string | null;
          rating: number | null;
          category: string;
          message: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by?: string | null;
          author_email?: string | null;
          rating?: number | null;
          category?: string;
          message: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          created_by?: string | null;
          author_email?: string | null;
          rating?: number | null;
          category?: string;
          message?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      nps_responses: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          score: number;
          comment: string | null;
          period: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          score: number;
          comment?: string | null;
          period?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string | null;
          score?: number;
          comment?: string | null;
          period?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      churn_alerts: {
        Row: {
          id: string;
          workspace_id: string;
          signal_type: string;
          severity: string;
          title: string;
          message: string;
          acknowledged: boolean;
          acknowledged_by: string | null;
          acknowledged_at: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          signal_type: string;
          severity?: string;
          title: string;
          message: string;
          acknowledged?: boolean;
          acknowledged_by?: string | null;
          acknowledged_at?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          signal_type?: string;
          severity?: string;
          title?: string;
          message?: string;
          acknowledged?: boolean;
          acknowledged_by?: string | null;
          acknowledged_at?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string | null;
          name: string;
          slug: string | null;
          description: string | null;
          project_type: ProjectType;
          status: ProjectStatus;
          priority: ProjectPriority;
          tech_stack: string | null;
          github_url: string | null;
          production_url: string | null;
          staging_url: string | null;
          local_path_note: string | null;
          documentation_url: string | null;
          notes: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by?: string | null;
          name: string;
          slug?: string | null;
          description?: string | null;
          project_type?: ProjectType;
          status?: ProjectStatus;
          priority?: ProjectPriority;
          tech_stack?: string | null;
          github_url?: string | null;
          production_url?: string | null;
          staging_url?: string | null;
          local_path_note?: string | null;
          documentation_url?: string | null;
          notes?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string | null;
          description?: string | null;
          project_type?: ProjectType;
          status?: ProjectStatus;
          priority?: ProjectPriority;
          tech_stack?: string | null;
          github_url?: string | null;
          production_url?: string | null;
          staging_url?: string | null;
          local_path_note?: string | null;
          documentation_url?: string | null;
          notes?: string | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      prompt_library: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string | null;
          title: string;
          description: string | null;
          category: PromptCategory;
          subcategory: string | null;
          target_tool: PromptTargetTool | null;
          prompt_text: string;
          tags: string[];
          is_favorite: boolean;
          usage_count: number;
          last_used_at: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by?: string | null;
          title: string;
          description?: string | null;
          category?: PromptCategory;
          subcategory?: string | null;
          target_tool?: PromptTargetTool | null;
          prompt_text: string;
          tags?: string[];
          is_favorite?: boolean;
          usage_count?: number;
          last_used_at?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          category?: PromptCategory;
          subcategory?: string | null;
          target_tool?: PromptTargetTool | null;
          prompt_text?: string;
          tags?: string[];
          is_favorite?: boolean;
          usage_count?: number;
          last_used_at?: string | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      releases: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          created_by: string | null;
          title: string;
          version: string | null;
          phase_name: string | null;
          status: ReleaseStatus;
          release_type: ReleaseType;
          summary: string | null;
          files_changed: string | null;
          features_added: string | null;
          fixes: string | null;
          known_issues: string | null;
          testing_checklist: string | null;
          rollback_notes: string | null;
          deploy_url: string | null;
          main_production_url: string | null;
          build_status: string | null;
          lint_status: string | null;
          typecheck_status: string | null;
          deploy_status: string | null;
          deployed_at: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id?: string | null;
          created_by?: string | null;
          title: string;
          version?: string | null;
          phase_name?: string | null;
          status?: ReleaseStatus;
          release_type?: ReleaseType;
          summary?: string | null;
          files_changed?: string | null;
          features_added?: string | null;
          fixes?: string | null;
          known_issues?: string | null;
          testing_checklist?: string | null;
          rollback_notes?: string | null;
          deploy_url?: string | null;
          main_production_url?: string | null;
          build_status?: string | null;
          lint_status?: string | null;
          typecheck_status?: string | null;
          deploy_status?: string | null;
          deployed_at?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          project_id?: string | null;
          title?: string;
          version?: string | null;
          phase_name?: string | null;
          status?: ReleaseStatus;
          release_type?: ReleaseType;
          summary?: string | null;
          files_changed?: string | null;
          features_added?: string | null;
          fixes?: string | null;
          known_issues?: string | null;
          testing_checklist?: string | null;
          rollback_notes?: string | null;
          deploy_url?: string | null;
          main_production_url?: string | null;
          build_status?: string | null;
          lint_status?: string | null;
          typecheck_status?: string | null;
          deploy_status?: string | null;
          deployed_at?: string | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          key: string;
          value: JsonObject;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key: string;
          value?: JsonObject;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      integration_settings: {
        Row: {
          workspace_id: string;
          supabase_status: SupabaseConnectionStatus;
          n8n_status: N8nConnectionStatus;
          settings: JsonObject;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          supabase_status?: SupabaseConnectionStatus;
          n8n_status?: N8nConnectionStatus;
          settings?: JsonObject;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          supabase_status?: SupabaseConnectionStatus;
          n8n_status?: N8nConnectionStatus;
          settings?: JsonObject;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      security_audit_logs: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          event_type: string;
          severity: 'info' | 'warning' | 'critical';
          entity_type: string | null;
          entity_id: string | null;
          message: string | null;
          metadata: JsonObject;
          ip_hash: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          event_type: string;
          severity?: 'info' | 'warning' | 'critical';
          entity_type?: string | null;
          entity_id?: string | null;
          message?: string | null;
          metadata?: JsonObject;
          ip_hash?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          severity?: 'info' | 'warning' | 'critical';
          entity_type?: string | null;
          entity_id?: string | null;
          message?: string | null;
          metadata?: JsonObject;
          ip_hash?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          workspace_id: string;
          plan: BillingPlan;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          plan?: BillingPlan;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan?: BillingPlan;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      usage_limits: {
        Row: {
          id: string;
          workspace_id: string;
          plan: BillingPlan;
          max_projects: number | null;
          max_prompts: number | null;
          max_content_items: number | null;
          max_creative_assets: number | null;
          max_ai_generations_per_month: number | null;
          max_backups_per_month: number | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          plan?: BillingPlan;
          max_projects?: number | null;
          max_prompts?: number | null;
          max_content_items?: number | null;
          max_creative_assets?: number | null;
          max_ai_generations_per_month?: number | null;
          max_backups_per_month?: number | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan?: BillingPlan;
          max_projects?: number | null;
          max_prompts?: number | null;
          max_content_items?: number | null;
          max_creative_assets?: number | null;
          max_ai_generations_per_month?: number | null;
          max_backups_per_month?: number | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      usage_counters: {
        Row: {
          id: string;
          workspace_id: string;
          quota_type: string;
          count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          quota_type: string;
          count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      ad_connections: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          provider: AdConnectionProvider;
          status: AdConnectionStatus;
          access_token: string;
          refresh_token: string | null;
          token_expires_at: string | null;
          ad_account_id: string | null;
          ad_account_name: string | null;
          scopes: string[];
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          provider: AdConnectionProvider;
          status: AdConnectionStatus;
          access_token: string;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          ad_account_id?: string | null;
          ad_account_name?: string | null;
          scopes?: string[];
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: AdConnectionStatus;
          access_token?: string;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          ad_account_id?: string | null;
          ad_account_name?: string | null;
          scopes?: string[];
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          type: NotificationType;
          severity: NotificationSeverity;
          title: string;
          message: string;
          status: NotificationStatus;
          related_entity_type: string | null;
          related_entity_id: string | null;
          related_url: string | null;
          metadata: JsonObject;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          type: NotificationType;
          severity?: NotificationSeverity;
          title: string;
          message: string;
          status?: NotificationStatus;
          related_entity_type?: string | null;
          related_entity_id?: string | null;
          related_url?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          type?: NotificationType;
          severity?: NotificationSeverity;
          title?: string;
          message?: string;
          status?: NotificationStatus;
          related_entity_type?: string | null;
          related_entity_id?: string | null;
          related_url?: string | null;
          metadata?: JsonObject;
          read_at?: string | null;
        };
        Relationships: [];
      };
      reels: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          platform: 'instagram';
          type: 'reel';
          status: ReelStatus;
          title: string;
          offer: string | null;
          goal: string | null;
          target_audience: string | null;
          market: string | null;
          tone: string | null;
          cta: string | null;
          hook: string | null;
          main_message: string | null;
          script: string | null;
          storyboard: string | null;
          caption: string | null;
          hashtags: string[];
          duration_seconds: number | null;
          creative_type: string | null;
          video_url: string | null;
          cover_url: string | null;
          subtitles: string | null;
          music_note: string | null;
          scheduled_for: string | null;
          published_at: string | null;
          published_media_id: string | null;
          published_permalink: string | null;
          error_message: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string;
          platform?: 'instagram';
          type?: 'reel';
          status?: ReelStatus;
          title: string;
          offer?: string | null;
          goal?: string | null;
          target_audience?: string | null;
          market?: string | null;
          tone?: string | null;
          cta?: string | null;
          hook?: string | null;
          main_message?: string | null;
          script?: string | null;
          storyboard?: string | null;
          caption?: string | null;
          hashtags?: string[];
          duration_seconds?: number | null;
          creative_type?: string | null;
          video_url?: string | null;
          cover_url?: string | null;
          subtitles?: string | null;
          music_note?: string | null;
          scheduled_for?: string | null;
          published_at?: string | null;
          published_media_id?: string | null;
          published_permalink?: string | null;
          error_message?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          platform?: 'instagram';
          type?: 'reel';
          status?: ReelStatus;
          title?: string;
          offer?: string | null;
          goal?: string | null;
          target_audience?: string | null;
          market?: string | null;
          tone?: string | null;
          cta?: string | null;
          hook?: string | null;
          main_message?: string | null;
          script?: string | null;
          storyboard?: string | null;
          caption?: string | null;
          hashtags?: string[];
          duration_seconds?: number | null;
          creative_type?: string | null;
          video_url?: string | null;
          cover_url?: string | null;
          subtitles?: string | null;
          music_note?: string | null;
          scheduled_for?: string | null;
          published_at?: string | null;
          published_media_id?: string | null;
          published_permalink?: string | null;
          error_message?: string | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      creative_assets: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          title: string;
          asset_type: CreativeAssetType;
          platform: CreativeAssetPlatform;
          status: CreativeAssetStatus;
          source: CreativeAssetSource;
          goal: string | null;
          offer: string | null;
          target_audience: string | null;
          market: string | null;
          tone: string | null;
          style: string | null;
          visual_direction: string | null;
          text_overlay: string | null;
          brand_colors: string | null;
          notes: string | null;
          prompt: string | null;
          negative_prompt: string | null;
          aspect_ratio: CreativeAssetAspectRatio | null;
          output_style: CreativeAssetOutputStyle | null;
          image_url: string | null;
          storage_path: string | null;
          linked_reel_id: string | null;
          linked_task_id: string | null;
          linked_campaign_task_id: string | null;
          model: string | null;
          size: string | null;
          quality: string | null;
          estimated_cost_usd: number | null;
          error_message: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          title: string;
          asset_type: CreativeAssetType;
          platform?: CreativeAssetPlatform;
          status?: CreativeAssetStatus;
          source?: CreativeAssetSource;
          goal?: string | null;
          offer?: string | null;
          target_audience?: string | null;
          market?: string | null;
          tone?: string | null;
          style?: string | null;
          visual_direction?: string | null;
          text_overlay?: string | null;
          brand_colors?: string | null;
          notes?: string | null;
          prompt?: string | null;
          negative_prompt?: string | null;
          aspect_ratio?: CreativeAssetAspectRatio | null;
          output_style?: CreativeAssetOutputStyle | null;
          image_url?: string | null;
          storage_path?: string | null;
          linked_reel_id?: string | null;
          linked_task_id?: string | null;
          linked_campaign_task_id?: string | null;
          model?: string | null;
          size?: string | null;
          quality?: string | null;
          estimated_cost_usd?: number | null;
          error_message?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          asset_type?: CreativeAssetType;
          platform?: CreativeAssetPlatform;
          status?: CreativeAssetStatus;
          source?: CreativeAssetSource;
          goal?: string | null;
          offer?: string | null;
          target_audience?: string | null;
          market?: string | null;
          tone?: string | null;
          style?: string | null;
          visual_direction?: string | null;
          text_overlay?: string | null;
          brand_colors?: string | null;
          notes?: string | null;
          prompt?: string | null;
          negative_prompt?: string | null;
          aspect_ratio?: CreativeAssetAspectRatio | null;
          output_style?: CreativeAssetOutputStyle | null;
          image_url?: string | null;
          storage_path?: string | null;
          linked_reel_id?: string | null;
          linked_task_id?: string | null;
          linked_campaign_task_id?: string | null;
          model?: string | null;
          size?: string | null;
          quality?: string | null;
          estimated_cost_usd?: number | null;
          error_message?: string | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_studio_items: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string;
          title: string;
          platform: ContentStudioPlatform;
          content_type: ContentStudioType;
          status: ContentStudioStatus;
          objective: string | null;
          prompt: string | null;
          script: string | null;
          caption: string | null;
          ad_copy: string | null;
          creative_brief: string | null;
          schedule_at: string | null;
          published_at: string | null;
          provider_external_id: string | null;
          provider_response_summary: JsonObject;
          last_provider_action_at: string | null;
          provider_status: string | null;
          provider_error: string | null;
          scheduled_execution_status: string | null;
          scheduled_execution_started_at: string | null;
          scheduled_execution_finished_at: string | null;
          scheduled_execution_error: string | null;
          scheduled_execution_attempts: number;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by?: string;
          title: string;
          platform: ContentStudioPlatform;
          content_type: ContentStudioType;
          status?: ContentStudioStatus;
          objective?: string | null;
          prompt?: string | null;
          script?: string | null;
          caption?: string | null;
          ad_copy?: string | null;
          creative_brief?: string | null;
          schedule_at?: string | null;
          published_at?: string | null;
          provider_external_id?: string | null;
          provider_response_summary?: JsonObject;
          last_provider_action_at?: string | null;
          provider_status?: string | null;
          provider_error?: string | null;
          scheduled_execution_status?: string | null;
          scheduled_execution_started_at?: string | null;
          scheduled_execution_finished_at?: string | null;
          scheduled_execution_error?: string | null;
          scheduled_execution_attempts?: number;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          platform?: ContentStudioPlatform;
          content_type?: ContentStudioType;
          status?: ContentStudioStatus;
          objective?: string | null;
          prompt?: string | null;
          script?: string | null;
          caption?: string | null;
          ad_copy?: string | null;
          creative_brief?: string | null;
          schedule_at?: string | null;
          published_at?: string | null;
          provider_external_id?: string | null;
          provider_response_summary?: JsonObject;
          last_provider_action_at?: string | null;
          provider_status?: string | null;
          provider_error?: string | null;
          scheduled_execution_status?: string | null;
          scheduled_execution_started_at?: string | null;
          scheduled_execution_finished_at?: string | null;
          scheduled_execution_error?: string | null;
          scheduled_execution_attempts?: number;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_studio_item_assets: {
        Row: {
          id: string;
          content_item_id: string;
          creative_asset_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_item_id: string;
          creative_asset_id: string;
          created_at?: string;
        };
        Update: {
          content_item_id?: string;
          creative_asset_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      content_studio_publish_attempts: {
        Row: {
          id: string;
          workspace_id: string;
          content_item_id: string | null;
          provider: ContentStudioPublishAttemptProvider;
          action_type: ContentStudioPublishAttemptActionType;
          status: ContentStudioPublishAttemptStatus;
          request_summary: JsonObject;
          provider_response_summary: JsonObject;
          error_message: string | null;
          provider_external_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          content_item_id?: string | null;
          provider: ContentStudioPublishAttemptProvider;
          action_type: ContentStudioPublishAttemptActionType;
          status: ContentStudioPublishAttemptStatus;
          request_summary?: JsonObject;
          provider_response_summary?: JsonObject;
          error_message?: string | null;
          provider_external_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          content_item_id?: string | null;
          provider?: ContentStudioPublishAttemptProvider;
          action_type?: ContentStudioPublishAttemptActionType;
          status?: ContentStudioPublishAttemptStatus;
          request_summary?: JsonObject;
          provider_response_summary?: JsonObject;
          error_message?: string | null;
          provider_external_id?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_reports: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string | null;
          title: string;
          template: string;
          period_label: string | null;
          filename: string;
          storage_path: string;
          file_size_bytes: number | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by?: string | null;
          title: string;
          template?: string;
          period_label?: string | null;
          filename: string;
          storage_path: string;
          file_size_bytes?: number | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          template?: string;
          period_label?: string | null;
          filename?: string;
          storage_path?: string;
          file_size_bytes?: number | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      report_share_links: {
        Row: {
          id: string;
          report_id: string;
          workspace_id: string;
          created_by: string | null;
          token: string;
          expires_at: string;
          password_hash: string | null;
          access_count: number;
          max_access_count: number | null;
          is_revoked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          workspace_id: string;
          created_by?: string | null;
          token: string;
          expires_at: string;
          password_hash?: string | null;
          access_count?: number;
          max_access_count?: number | null;
          is_revoked?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          password_hash?: string | null;
          access_count?: number;
          max_access_count?: number | null;
          is_revoked?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      // ===== Missing Table Definitions (DB tables without TypeScript types) =====
      backup_records: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string | null;
          backup_type: string;
          categories: string[];
          record_counts: JsonObject;
          file_name: string | null;
          file_size_bytes: number | null;
          status: BackupRecordStatus;
          warnings: string | null;
          metadata: JsonObject;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by?: string | null;
          backup_type?: string;
          categories?: string[];
          record_counts?: JsonObject;
          file_name?: string | null;
          file_size_bytes?: number | null;
          status?: BackupRecordStatus;
          warnings?: string | null;
          metadata?: JsonObject;
          created_at?: string;
        };
        Update: {
          backup_type?: string;
          categories?: string[];
          record_counts?: JsonObject;
          file_name?: string | null;
          file_size_bytes?: number | null;
          status?: BackupRecordStatus;
          warnings?: string | null;
          metadata?: JsonObject;
        };
        Relationships: [];
      };
      github_issue_task_links: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          task_id: string;
          github_owner: string;
          github_repo: string;
          github_issue_number: number;
          github_issue_url: string;
          github_issue_title: string | null;
          github_issue_state: string | null;
          github_labels: string[];
          metadata: JsonObject;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          task_id: string;
          github_owner: string;
          github_repo: string;
          github_issue_number: number;
          github_issue_url: string;
          github_issue_title?: string | null;
          github_issue_state?: string | null;
          github_labels?: string[];
          metadata?: JsonObject;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          github_issue_title?: string | null;
          github_issue_state?: string | null;
          github_labels?: string[];
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      provider_readiness_cache: {
        Row: {
          id: string;
          workspace_id: string;
          provider: string;
          readiness_state: string;
          message: string | null;
          missing: string[] | null;
          last_checked_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          provider: string;
          readiness_state: string;
          message?: string | null;
          missing?: string[] | null;
          last_checked_at?: string;
          expires_at: string;
        };
        Update: {
          readiness_state?: string;
          message?: string | null;
          missing?: string[] | null;
          last_checked_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      pull_request_reviews: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          created_by: string | null;
          github_owner: string;
          github_repo: string;
          pr_number: number;
          pr_url: string;
          pr_title: string | null;
          pr_state: string | null;
          source_branch: string | null;
          target_branch: string | null;
          risk_level: PullRequestReviewRiskLevel;
          recommendation: PullRequestReviewRecommendation;
          review_summary: string | null;
          files_changed: string | null;
          potential_issues: string | null;
          security_notes: string | null;
          testing_checklist: string | null;
          release_notes_draft: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          created_by?: string | null;
          github_owner: string;
          github_repo: string;
          pr_number: number;
          pr_url: string;
          pr_title?: string | null;
          pr_state?: string | null;
          source_branch?: string | null;
          target_branch?: string | null;
          risk_level?: PullRequestReviewRiskLevel;
          recommendation?: PullRequestReviewRecommendation;
          review_summary?: string | null;
          files_changed?: string | null;
          potential_issues?: string | null;
          security_notes?: string | null;
          testing_checklist?: string | null;
          release_notes_draft?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          risk_level?: PullRequestReviewRiskLevel;
          recommendation?: PullRequestReviewRecommendation;
          review_summary?: string | null;
          files_changed?: string | null;
          potential_issues?: string | null;
          security_notes?: string | null;
          testing_checklist?: string | null;
          release_notes_draft?: string | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      safe_patch_plans: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          created_by: string | null;
          title: string;
          change_request: string;
          change_type: SafePatchPlanChangeType;
          priority: SafePatchPlanPriority;
          risk_level: SafePatchPlanRiskLevel;
          status: SafePatchPlanStatus;
          affected_files: string | null;
          implementation_plan: string | null;
          safety_constraints: string | null;
          test_checklist: string | null;
          rollback_plan: string | null;
          suggested_prompt: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id?: string | null;
          created_by?: string | null;
          title: string;
          change_request: string;
          change_type?: SafePatchPlanChangeType;
          priority?: SafePatchPlanPriority;
          risk_level?: SafePatchPlanRiskLevel;
          status?: SafePatchPlanStatus;
          affected_files?: string | null;
          implementation_plan?: string | null;
          safety_constraints?: string | null;
          test_checklist?: string | null;
          rollback_plan?: string | null;
          suggested_prompt?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          change_request?: string;
          change_type?: SafePatchPlanChangeType;
          priority?: SafePatchPlanPriority;
          risk_level?: SafePatchPlanRiskLevel;
          status?: SafePatchPlanStatus;
          affected_files?: string | null;
          implementation_plan?: string | null;
          safety_constraints?: string | null;
          test_checklist?: string | null;
          rollback_plan?: string | null;
          suggested_prompt?: string | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_memory: {
        Row: {
          id: string;
          workspace_id: string;
          agent_type: string;
          memory_type: 'episodic' | 'semantic' | 'procedural' | 'working';
          category: string;
          content: string;
          embedding: number[] | null;
          importance: number;
          confidence: number;
          source: string | null;
          tags: string[];
          metadata: JsonObject;
          last_accessed_at: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          agent_type: string;
          memory_type: 'episodic' | 'semantic' | 'procedural' | 'working';
          category?: string;
          content: string;
          embedding?: number[] | null;
          importance?: number;
          confidence?: number;
          source?: string | null;
          tags?: string[];
          metadata?: JsonObject;
          last_accessed_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          workspace_id?: string;
          agent_type?: string;
          memory_type?: 'episodic' | 'semantic' | 'procedural' | 'working';
          category?: string;
          content?: string;
          embedding?: number[] | null;
          importance?: number;
          confidence?: number;
          source?: string | null;
          tags?: string[];
          metadata?: JsonObject;
          last_accessed_at?: string | null;
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      human_review_requests: {
        Row: {
          id: string;
          workspace_id: string;
          run_id: string;
          step_id: string;
          agent_type: string;
          reason: string;
          context: JsonObject;
          requested_action: string | null;
          status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
          reviewer_id: string | null;
          decision_note: string | null;
          decided_at: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          run_id: string;
          step_id: string;
          agent_type: string;
          reason: string;
          context?: JsonObject;
          requested_action?: string | null;
          status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
          reviewer_id?: string | null;
          decision_note?: string | null;
          decided_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          workspace_id?: string;
          run_id?: string;
          step_id?: string;
          agent_type?: string;
          reason?: string;
          context?: JsonObject;
          requested_action?: string | null;
          status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
          reviewer_id?: string | null;
          decision_note?: string | null;
          decided_at?: string | null;
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      consent_records: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          purpose: string;
          legal_basis: string;
          granted: boolean;
          version: string;
          withdrawn_at: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          purpose: string;
          legal_basis?: string;
          granted: boolean;
          version?: string;
          withdrawn_at?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          purpose?: string;
          legal_basis?: string;
          granted?: boolean;
          version?: string;
          withdrawn_at?: string | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      data_subject_requests: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          request_type: 'access' | 'erasure' | 'rectification' | 'portability';
          status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'expired';
          requested_at: string;
          completed_at: string | null;
          verified: boolean;
          export_path: string | null;
          notes: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          request_type: 'access' | 'erasure' | 'rectification' | 'portability';
          status?: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'expired';
          requested_at?: string;
          completed_at?: string | null;
          verified?: boolean;
          export_path?: string | null;
          notes?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          request_type?: 'access' | 'erasure' | 'rectification' | 'portability';
          status?: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'expired';
          completed_at?: string | null;
          verified?: boolean;
          export_path?: string | null;
          notes?: string | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
      sso_configs: {
        Row: {
          id: string;
          workspace_id: string;
          provider: 'google_workspace' | 'microsoft_entra';
          enabled: boolean;
          client_id: string | null;
          client_secret_encrypted: string | null;
          tenant_id: string | null;
          domain: string | null;
          issuer_url: string | null;
          allow_sign_up: boolean;
          allowed_domains: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          provider: 'google_workspace' | 'microsoft_entra';
          enabled?: boolean;
          client_id?: string | null;
          client_secret_encrypted?: string | null;
          tenant_id?: string | null;
          domain?: string | null;
          issuer_url?: string | null;
          allow_sign_up?: boolean;
          allowed_domains?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider?: 'google_workspace' | 'microsoft_entra';
          enabled?: boolean;
          client_id?: string | null;
          client_secret_encrypted?: string | null;
          tenant_id?: string | null;
          domain?: string | null;
          issuer_url?: string | null;
          allow_sign_up?: boolean;
          allowed_domains?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      security_policies: {
        Row: {
          id: string;
          workspace_id: string;
          policy_key: string;
          enabled: boolean;
          config: JsonObject;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          policy_key: string;
          enabled?: boolean;
          config?: JsonObject;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          policy_key?: string;
          enabled?: boolean;
          config?: JsonObject;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      compliance_evidence: {
        Row: {
          id: string;
          workspace_id: string;
          framework: string;
          control_id: string;
          control_name: string;
          status: 'not_started' | 'implemented' | 'evidence_collected' | 'attested' | 'failed';
          evidence: string | null;
          attested_by: string | null;
          attested_at: string | null;
          metadata: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          framework?: string;
          control_id: string;
          control_name: string;
          status?: 'not_started' | 'implemented' | 'evidence_collected' | 'attested' | 'failed';
          evidence?: string | null;
          attested_by?: string | null;
          attested_at?: string | null;
          metadata?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          framework?: string;
          control_id?: string;
          control_name?: string;
          status?: 'not_started' | 'implemented' | 'evidence_collected' | 'attested' | 'failed';
          evidence?: string | null;
          attested_by?: string | null;
          attested_at?: string | null;
          metadata?: JsonObject;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_workspace_member: {
        Args: { check_workspace_id: string };
        Returns: boolean;
      };
      is_workspace_admin: {
        Args: { check_workspace_id: string };
        Returns: boolean;
      };
      increment_usage_counter: {
        Args: { p_workspace_id: string; p_quota_type: string };
        Returns: undefined;
      };
      increment_usage_counter_metadata: {
        Args: { p_workspace_id: string; p_quota_type: string; p_amount?: number };
        Returns: undefined;
      };
      list_rls_enabled_tables: {
        Args: Record<PropertyKey, never>;
        Returns: { tablename: string; rowsecurity: boolean }[];
      };
      sum_workspace_cost: {
        Args: {
          p_workspace_id: string;
          p_since?: string;
          p_until?: string;
        };
        Returns: {
          total_cost: number;
          openai_cost: number;
          n8n_cost: number;
          total_tokens: number;
          operations: number;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type ProfileRecord = Database['public']['Tables']['profiles']['Row'];
export type WorkspaceRecord = Database['public']['Tables']['workspaces']['Row'];
export type WorkspaceMemberRecord = Database['public']['Tables']['workspace_members']['Row'];
export type DepartmentRecord = Database['public']['Tables']['departments']['Row'];
export type AgentRecord = Database['public']['Tables']['agents']['Row'];
export type TaskRecord = Database['public']['Tables']['tasks']['Row'];
export type TaskReviewRecord = Database['public']['Tables']['task_reviews']['Row'];
export type TaskEventRecord = Database['public']['Tables']['task_events']['Row'];
export type N8nCallbackEventRecord =
  Database['public']['Tables']['n8n_callback_events']['Row'];
export type AgentTemplateUsageEventRecord =
  Database['public']['Tables']['agent_template_usage_events']['Row'];
export type AgentWorkflowPlaybookRecord =
  Database['public']['Tables']['agent_workflow_playbooks']['Row'];
export type AgentBuilderAgentRecord =
  Database['public']['Tables']['agent_builder_agents']['Row'];
export type UserPreferenceRecord = Database['public']['Tables']['user_preferences']['Row'];
export type IntegrationSettingsRecord =
  Database['public']['Tables']['integration_settings']['Row'];
export type UsageLimitRecord = Database['public']['Tables']['usage_limits']['Row'];
export type SubscriptionRecord = Database['public']['Tables']['subscriptions']['Row'];
export type AdConnectionRecord = Database['public']['Tables']['ad_connections']['Row'];
export type NotificationRecord = Database['public']['Tables']['notifications']['Row'];
export type ProjectRecord = Database['public']['Tables']['projects']['Row'];
export type PromptLibraryRecord = Database['public']['Tables']['prompt_library']['Row'];
export type ReleaseRecord = Database['public']['Tables']['releases']['Row'];
export type ReelRecord = Database['public']['Tables']['reels']['Row'];
export type CreativeAssetRecord = Database['public']['Tables']['creative_assets']['Row'];
export type ContentStudioItemRecord =
  Database['public']['Tables']['content_studio_items']['Row'];
export type ContentStudioItemAssetRecord =
  Database['public']['Tables']['content_studio_item_assets']['Row'];
export type ContentStudioPublishAttemptRecord =
  Database['public']['Tables']['content_studio_publish_attempts']['Row'];

export type BackupRecord = Database['public']['Tables']['backup_records']['Row'];
export type GitHubIssueTaskLinkRecord =
  Database['public']['Tables']['github_issue_task_links']['Row'];
export type ProviderReadinessCacheRecord =
  Database['public']['Tables']['provider_readiness_cache']['Row'];
export type PullRequestReviewRecord =
  Database['public']['Tables']['pull_request_reviews']['Row'];
export type SafePatchPlanRecord = Database['public']['Tables']['safe_patch_plans']['Row'];
export type ApiKeyRecord = Database['public']['Tables']['api_keys']['Row'];

export type SupportTicketRecord = Database['public']['Tables']['support_tickets']['Row'];
export type CustomerFeedbackRecord = Database['public']['Tables']['customer_feedback']['Row'];
export type NpsResponseRecord = Database['public']['Tables']['nps_responses']['Row'];
export type ChurnAlertRecord = Database['public']['Tables']['churn_alerts']['Row'];

export type ConsentRecord = Database['public']['Tables']['consent_records']['Row'];
export type DataSubjectRequestRecord =
  Database['public']['Tables']['data_subject_requests']['Row'];
export type SsoConfigRecord = Database['public']['Tables']['sso_configs']['Row'];
export type SecurityPolicyRecord = Database['public']['Tables']['security_policies']['Row'];
export type ComplianceEvidenceRecord =
  Database['public']['Tables']['compliance_evidence']['Row'];

export type ApiKeyScope =
  | 'agents:read'
  | 'agents:write'
  | 'prompts:read'
  | 'prompts:write'
  | 'team:read'
  | 'usage:read'
  | 'api:keys:manage';
