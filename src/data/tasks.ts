import type { Task } from '@/types';

export type ActivityTone = 'success' | 'warning' | 'info';

export interface DashboardActivity {
  action: string;
  detail: string;
  time: string;
  type: ActivityTone;
}

export interface AgentRecentTask {
  id: string;
  title: string;
  status: Task['status'];
  createdAt: string;
  duration: string | null;
}

export interface AgentActivityLog {
  action: string;
  detail: string;
  timestamp: string;
  type: ActivityTone;
}

// No seeded workspace records are bundled with the product. Supabase will
// become the source of truth when persistence is connected.
export const taskRecords: Task[] = [];
export const recentActivity: DashboardActivity[] = [];
export const agentRecentTasks: AgentRecentTask[] = [];
export const agentActivityLogs: AgentActivityLog[] = [];
