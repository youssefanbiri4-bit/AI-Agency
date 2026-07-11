export interface DashboardTaskPreview {
  id: string;
  title: string;
  status: string;
  href: string;
  updatedAt: string;
}

export interface DashboardActivityItem {
  id: string;
  title: string;
  kind: 'task' | 'content';
  status: string;
  href: string;
  at: string;
}

export interface PersonalizedDeptStats {
  yourTasks: number;
  readyInDept: number;
  needsReview: number;
}

export type DashboardViewMode = 'personalized' | 'command_center';