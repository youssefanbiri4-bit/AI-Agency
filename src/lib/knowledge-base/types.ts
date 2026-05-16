export type KnowledgeSourceType =
  | 'prompts'
  | 'agents'
  | 'playbooks'
  | 'blueprints'
  | 'reviews'
  | 'tasks'
  | 'content'
  | 'ai_studio'
  | 'reports'
  | 'system_health';

export interface KnowledgeEntry {
  id: string;
  workspace_id: string;
  user_id?: string | null;
  source_type: KnowledgeSourceType;
  source_id?: string | null;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  metadata: Record<string, string | number | boolean | null>;
  href?: string | null;
  updated_at: string;
}

export interface KnowledgeSearchFilters {
  sourceTypes?: KnowledgeSourceType[];
  maxResults?: number;
}

export interface KnowledgeSearchResult extends KnowledgeEntry {
  score: number;
  highlights: string[];
}

export const knowledgeSourceOptions: Array<{ value: KnowledgeSourceType; label: string }> = [
  { value: 'prompts', label: 'Prompts' },
  { value: 'agents', label: 'Agents' },
  { value: 'playbooks', label: 'Playbooks' },
  { value: 'blueprints', label: 'Blueprints' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'content', label: 'Content' },
  { value: 'ai_studio', label: 'AI Studio' },
  { value: 'reports', label: 'Reports' },
  { value: 'system_health', label: 'System Health' },
];
