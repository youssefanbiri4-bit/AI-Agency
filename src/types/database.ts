import type { AgentType, DepartmentName, JsonObject, TaskStatus } from './index';

export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type TaskPriority = 'Low' | 'Normal' | 'High';
export type SupabaseConnectionStatus = 'not_configured' | 'configured';
export type N8nConnectionStatus = 'not_connected' | 'prepared' | 'connected';
export type AdConnectionProvider = 'meta';
export type AdConnectionStatus = 'connected' | 'expired' | 'revoked' | 'error';

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
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role?: WorkspaceRole;
          created_at?: string;
        };
        Update: {
          role?: WorkspaceRole;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          id: 'research_strategy' | 'content_growth' | 'sales_operations';
          name: DepartmentName;
          description: string;
          color: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: 'research_strategy' | 'content_growth' | 'sales_operations';
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
          department_id: 'research_strategy' | 'content_growth' | 'sales_operations';
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
          department_id: 'research_strategy' | 'content_growth' | 'sales_operations';
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
          department_id?: 'research_strategy' | 'content_growth' | 'sales_operations';
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
      user_preferences: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          preferences: JsonObject;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string;
          preferences?: JsonObject;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          preferences?: JsonObject;
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
export type UserPreferenceRecord = Database['public']['Tables']['user_preferences']['Row'];
export type IntegrationSettingsRecord =
  Database['public']['Tables']['integration_settings']['Row'];
export type AdConnectionRecord = Database['public']['Tables']['ad_connections']['Row'];
