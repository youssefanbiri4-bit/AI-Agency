// Shared JSON-safe values for task inputs, results, and API payloads.
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

// Task related types
export interface Task {
  id: string;
  user_id: string;
  agent_type: AgentType;
  title: string;
  description: string;
  input_data: JsonObject;
  status: TaskStatus;
  priority: 'Low' | 'Normal' | 'High';
  result: JsonObject | null;
  n8n_execution_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type AgentType = 
  | 'market_research'
  | 'competitor_analysis'
  | 'audience_persona'
  | 'product_idea'
  | 'seo_keyword'
  | 'strategy_planner'
  | 'social_media_content'
  | 'copywriting'
  | 'ads_script'
  | 'email_marketing'
  | 'blog_seo_article'
  | 'visual_brief'
  | 'lead_finder'
  | 'lead_qualifier'
  | 'outreach_message'
  | 'crm_update'
  | 'customer_support'
  | 'analytics_report'
  | 'offer_builder'
  | 'content_creator'
  | 'outreach'
  | 'report';

export type TaskStatus =
  | 'draft'
  | 'pending'
  | 'processing'
  | 'needs_review'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type AgentStatus = 'Not Connected';
export type DepartmentName = 'Research & Strategy' | 'Content & Growth' | 'Sales & Operations';

export interface TaskReview {
  id: string;
  workspace_id: string;
  task_id: string;
  reviewer_id: string;
  rating: number; // 1-5
  feedback: string;
  created_at: string;
  updated_at: string;
}

// Department configuration
export interface Department {
  id: 'research_strategy' | 'content_growth' | 'sales_operations';
  name: DepartmentName;
  description: string;
  color: string;
  agentCount: number;
}

// Agent configuration
export interface Agent {
  id: AgentType;
  name: string;
  role: string;
  department: DepartmentName;
  description: string;
  capabilities: string[];
  exampleTasks: string[];
  status: AgentStatus;
  icon: string;
  color: string;
  n8nWebhook?: string;
}

export interface AgentConfig {
  id: AgentType;
  name: string;
  role: string;
  department: DepartmentName;
  description: string;
  icon: string;
  color: string;
  inputFields: FormField[];
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'select' | 'checkbox';
  placeholder?: string;
  required: boolean;
  options?: { value: string; label: string }[];
}

// User related types
export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
