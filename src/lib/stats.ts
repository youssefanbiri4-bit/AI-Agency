import type { Agent, AgentStatus, Department, DepartmentName, Task, TaskStatus } from '@/types';

export type StatusCounts<T extends string> = Record<T | 'all', number>;

export function getTaskStats(tasks: Task[]) {
  return {
    total: tasks.length,
    draft: tasks.filter((task) => task.status === 'draft').length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    processing: tasks.filter((task) => task.status === 'processing').length,
    needsReview: tasks.filter((task) => task.status === 'needs_review').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
    cancelled: tasks.filter((task) => task.status === 'cancelled').length,
  };
}

export function getAgentStats(agents: Agent[]) {
  return {
    total: agents.length,
    notConnected: agents.filter((agent) => agent.status === 'Not Connected').length,
  };
}

export function getAgentStatusCounts(agents: Agent[]): StatusCounts<AgentStatus> {
  return agents.reduce<StatusCounts<AgentStatus>>(
    (counts, agent) => {
      counts[agent.status] += 1;
      counts.all += 1;
      return counts;
    },
    { all: 0, 'Not Connected': 0 }
  );
}

export function getTaskStatusCounts(tasks: Task[]): StatusCounts<TaskStatus> {
  return tasks.reduce<StatusCounts<TaskStatus>>(
    (counts, task) => {
      counts[task.status] += 1;
      counts.all += 1;
      return counts;
    },
    {
      all: 0,
      draft: 0,
      pending: 0,
      processing: 0,
      needs_review: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    }
  );
}

export function getDepartmentAgentCounts(departments: Department[], agents: Agent[]) {
  return departments.map((department) => ({
    ...department,
    count: agents.filter((agent) => agent.department === department.name).length,
  }));
}

export function getDepartmentAgents(agents: Agent[], department: DepartmentName) {
  return agents.filter((agent) => agent.department === department);
}

export function getDepartmentMetrics(departments: Department[], agents: Agent[], tasks: Task[]) {
  return departments.map((department) => {
    const departmentAgents = getDepartmentAgents(agents, department.name);
    const agentIds = new Set(departmentAgents.map((agent) => agent.id));
    const taskRecords = tasks.filter((task) => agentIds.has(task.agent_type)).length;
    const activeTasks = tasks.filter(
      (task) =>
        agentIds.has(task.agent_type) &&
        (task.status === 'pending' || task.status === 'processing')
    ).length;

    return {
      ...department,
      agentsCount: departmentAgents.length,
      taskRecords,
      activeTasks,
    };
  });
}
