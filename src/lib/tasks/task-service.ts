/**
 * Task Service - Centralized Task Lifecycle with RBAC
 */

import {
  getRBACContext,
  requireWorkspaceAccessWithRBAC,
  canAccessCatalogDepartment,
  resolveCatalogDepartmentId,
  resolvePrimaryRbacDepartment,
  getRbacDepartmentsForCatalog,
} from '@/lib/auth/rbac';
import { assertProductionGate } from '@/lib/production/gate';
import {
  createTask as dataCreateTask,
  getTaskById,
  listTasks,
  updateTaskExecutionState,
  updateTaskReviewStatus,
  createTaskEvent,
  CreateTaskDraftInput,
} from '@/lib/data/tasks';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { AgentType, Task, TaskStatus } from '@/types';
import type { Department } from '@/types/auth';
import { listAgents } from '@/lib/data/agents';
import { buildDepartmentListScope } from '@/lib/data/department-filter';
import { resolveDepartmentListScopeFromRBAC } from '@/lib/data/department-scope';
import type { DataResult } from '@/lib/data/types';
import { getN8nReadiness } from '@/lib/n8n';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

const taskServiceLog = logger.child('tasks:service');

export interface TaskWithAgentDept extends Task {
  agentDepartment?: string | null;
  agentCatalogDepartmentId?: string | null;
  agentRbacDepartments?: Department[];
}

export class TaskService {
  private supabase: SupabaseClient<Database> | undefined;

  constructor(supabase?: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  private async getClient(): Promise<SupabaseClient<Database>> {
    if (this.supabase) return this.supabase;
    return createSupabaseServerClient();
  }

  private async resolveAgentCatalogRef(
    agentType: AgentType,
    client: SupabaseClient<Database>
  ): Promise<string | null> {
    const agentsRes = await listAgents(client);
    const agent = (agentsRes.data || []).find((item) => item.id === agentType);
    if (!agent) return null;
    return resolveCatalogDepartmentId(agent.department) ?? agent.department ?? null;
  }

  async canCreateTask(agentDepartmentRef: string | null): Promise<{
    allowed: boolean;
    reason?: string;
    rbacDepartment?: Department | null;
    catalogDepartmentId?: string | null;
  }> {
    const rbacRes = await getRBACContext();
    if (!rbacRes.data) {
      return { allowed: false, reason: rbacRes.error || 'RBAC access denied' };
    }

    const roleCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (!roleCheck.ok) {
      return { allowed: false, reason: roleCheck.error || 'Insufficient role to create tasks' };
    }

    const { rbacRole, department: userDept } = rbacRes.data;
    const catalogDepartmentId = resolveCatalogDepartmentId(agentDepartmentRef);

    if (
      agentDepartmentRef &&
      !canAccessCatalogDepartment(rbacRole, userDept, agentDepartmentRef)
    ) {
      const allowedDepts = getRbacDepartmentsForCatalog(agentDepartmentRef).join(', ') || 'unknown';
      return {
        allowed: false,
        reason: `You can only create tasks in your department (${userDept ?? 'unassigned'}). Agent maps to: ${allowedDepts}.`,
        catalogDepartmentId,
      };
    }

    return {
      allowed: true,
      rbacDepartment: resolvePrimaryRbacDepartment(agentDepartmentRef),
      catalogDepartmentId,
    };
  }

  async createTask(
    input: CreateTaskDraftInput & { agentCatalogDepartment?: string | null }
  ): Promise<DataResult<Task | null>> {
    const can = await this.canCreateTask(input.agentCatalogDepartment ?? null);
    if (!can.allowed) {
      return { data: null, error: can.reason || 'Task creation not allowed', isConfigured: true };
    }

    const rbacRes = await getRBACContext();
    const { rbacRole, department: userDept } = rbacRes.data!;

    const client = await this.getClient();
    const result = await dataCreateTask(
      {
        ...input,
        agentDepartment: can.rbacDepartment ?? undefined,
      },
      client
    );

    if (result.data) {
      taskServiceLog.info('task created with RBAC', {
        taskId: result.data.id,
        userDept,
        agentCatalogDepartment: input.agentCatalogDepartment,
        catalogDepartmentId: can.catalogDepartmentId,
        rbacDepartment: can.rbacDepartment,
        role: rbacRole,
      });
    }

    return result;
  }

  async canExecuteTask(
    taskId: string,
    workspaceId: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    productionGate?: Awaited<ReturnType<typeof getN8nReadiness>>;
    taskStatus?: TaskStatus;
  }> {
    const rbacRes = await getRBACContext();
    if (!rbacRes.data) {
      return { allowed: false, reason: rbacRes.error || 'No RBAC context' };
    }

    const roleCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'operator' });
    if (!roleCheck.ok) {
      return {
        allowed: false,
        reason: roleCheck.error || 'Operator role or higher required to execute tasks',
      };
    }

    const client = await this.getClient();
    const taskRes = await getTaskById(taskId, workspaceId, client);
    if (!taskRes.data) {
      return { allowed: false, reason: 'Task not found or not in workspace' };
    }

    const task = taskRes.data;
    const { rbacRole, department: userDept } = rbacRes.data;
    const catalogRef =
      (await this.resolveAgentCatalogRef(task.agent_type as AgentType, client));

    if (
      catalogRef &&
      !canAccessCatalogDepartment(rbacRole, userDept, catalogRef)
    ) {
      return {
        allowed: false,
        reason: `Task department is restricted for your role/department (${userDept ?? 'unassigned'}).`,
        taskStatus: task.status,
      };
    }

    const n8nReadiness = await getN8nReadiness();
    if (!n8nReadiness.canExecute) {
      return {
        allowed: false,
        reason: n8nReadiness.message || 'n8n is not ready for execution',
        productionGate: n8nReadiness,
      };
    }

    if (!['pending', 'failed'].includes(task.status)) {
      return { allowed: false, reason: `Cannot execute task in status: ${task.status}`, taskStatus: task.status };
    }

    return { allowed: true, productionGate: n8nReadiness, taskStatus: task.status };
  }

  async executeTask(
    taskId: string,
    workspaceId: string,
    options?: { n8nExecutionId?: string }
  ): Promise<DataResult<{ success: boolean } | null>> {
    await assertProductionGate(workspaceId);

    const can = await this.canExecuteTask(taskId, workspaceId);
    if (!can.allowed) {
      return { data: null, error: can.reason || 'Execution not allowed', isConfigured: true };
    }

    const rbacRes = await getRBACContext();
    const userId = rbacRes.data?.user.id;
    const client = await this.getClient();
    const expectedCurrentStatus: TaskStatus =
      can.taskStatus === 'failed' ? 'failed' : 'pending';

    const updateRes = await updateTaskExecutionState(
      {
        taskId,
        workspaceId,
        status: 'processing',
        n8nExecutionId: options?.n8nExecutionId,
        expectedCurrentStatus,
      },
      client
    );

    if (updateRes.error) {
      return { data: null, error: updateRes.error, isConfigured: updateRes.isConfigured };
    }

    await createTaskEvent(
      {
        workspaceId,
        taskId,
        actorId: userId,
        eventType: 'task_sent_to_n8n',
        message: 'Task sent to n8n for execution',
      },
      client
    );

    taskServiceLog.info('task execution started', { taskId, role: rbacRes.data?.rbacRole });

    return { data: { success: true }, error: null, isConfigured: true };
  }

  async canReviewTask(taskId: string, workspaceId: string): Promise<{ allowed: boolean; reason?: string }> {
    const roleCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'operator' });
    if (!roleCheck.ok) {
      return { allowed: false, reason: roleCheck.error || 'Operator or higher required to review tasks' };
    }

    const client = await this.getClient();
    const taskRes = await getTaskById(taskId, workspaceId, client);
    if (!taskRes.data) {
      return { allowed: false, reason: 'Task not found' };
    }

    if (taskRes.data.status !== 'needs_review') {
      return { allowed: false, reason: 'Only tasks in needs_review status can be reviewed' };
    }

    return { allowed: true };
  }

  async approveTask(
    taskId: string,
    workspaceId: string,
    reviewerId: string,
    feedback?: string
  ): Promise<DataResult<{ success: boolean; status: string } | null>> {
    const can = await this.canReviewTask(taskId, workspaceId);
    if (!can.allowed) {
      return { data: null, error: can.reason ?? null, isConfigured: true };
    }

    const client = await this.getClient();
    const updateRes = await updateTaskReviewStatus(
      { taskId, workspaceId, status: 'completed', completedAt: new Date().toISOString() },
      client
    );

    if (updateRes.error) {
      return { data: null, error: updateRes.error, isConfigured: updateRes.isConfigured };
    }

    await createTaskEvent(
      {
        workspaceId,
        taskId,
        actorId: reviewerId,
        eventType: 'task_approved',
        message: feedback || 'Task approved',
      },
      client
    );

    return { data: { success: true, status: 'completed' }, error: null, isConfigured: true };
  }

  async requestChangesTask(
    taskId: string,
    workspaceId: string,
    reviewerId: string,
    feedback: string
  ): Promise<DataResult<{ success: boolean; status: string } | null>> {
    const can = await this.canReviewTask(taskId, workspaceId);
    if (!can.allowed) {
      return { data: null, error: can.reason ?? null, isConfigured: true };
    }

    if (!feedback?.trim()) {
      return { data: null, error: 'Feedback required when requesting changes', isConfigured: true };
    }

    const client = await this.getClient();
    const updateRes = await updateTaskReviewStatus(
      { taskId, workspaceId, status: 'pending', completedAt: null },
      client
    );

    if (updateRes.error) {
      return { data: null, error: updateRes.error, isConfigured: updateRes.isConfigured };
    }

    await createTaskEvent(
      {
        workspaceId,
        taskId,
        actorId: reviewerId,
        eventType: 'changes_requested',
        message: feedback,
      },
      client
    );

    return { data: { success: true, status: 'pending' }, error: null, isConfigured: true };
  }

  private enrichTasksWithDepartments(
    tasks: Task[],
    agents: Awaited<ReturnType<typeof listAgents>>['data']
  ): TaskWithAgentDept[] {
    const agentDeptMap = new Map(
      (agents || []).map((agent) => [agent.id, agent.department])
    );
    const agentCatalogMap = new Map(
      (agents || []).map((agent) => [
        agent.id,
        resolveCatalogDepartmentId(agent.department),
      ])
    );

    return tasks.map((task) => {
      const catalogId = agentCatalogMap.get(task.agent_type as AgentType) ?? null;
      return {
        ...task,
        agentDepartment: agentDeptMap.get(task.agent_type as AgentType) || null,
        agentCatalogDepartmentId: catalogId,
        agentRbacDepartments: catalogId ? getRbacDepartmentsForCatalog(catalogId) : [],
      };
    });
  }

  async listMyTasks(
    options: { status?: TaskStatus; limit?: number } = {}
  ): Promise<DataResult<Task[]>> {
    const rbacRes = await getRBACContext();
    if (!rbacRes.data) {
      return { data: [], error: rbacRes.error, isConfigured: false };
    }

    const { workspace, user } = rbacRes.data;
    const client = await this.getClient();
    const departmentScope = await resolveDepartmentListScopeFromRBAC();

    return listTasks(
      {
        workspaceId: workspace.id,
        userId: user.id,
        status: options.status,
        limit: options.limit ?? 8,
        departmentScope,
      },
      client
    );
  }

  async listTasksForCurrentUser(
    options: { status?: string; limit?: number; department?: Department | 'all' } = {}
  ): Promise<DataResult<TaskWithAgentDept[]>> {
    const rbacRes = await getRBACContext();
    if (!rbacRes.data) {
      return { data: [], error: rbacRes.error, isConfigured: false };
    }

    const { workspace, rbacRole, department: userDept } = rbacRes.data;
    const client = await this.getClient();
    const baseScope = await resolveDepartmentListScopeFromRBAC();
    const departmentScope =
      options.department && options.department !== 'all'
        ? buildDepartmentListScope({
            role: rbacRole,
            assignedDepartment: userDept,
            effectiveDepartment: options.department,
          })
        : baseScope;

    const listRes = await listTasks(
      {
        workspaceId: workspace.id,
        limit: options.limit ?? 100,
        status: options.status as TaskStatus | undefined,
        departmentScope,
      },
      client
    );

    if (listRes.error || !listRes.data) {
      return listRes as DataResult<TaskWithAgentDept[]>;
    }

    const agentsRes = await listAgents(client);
    const tasks = this.enrichTasksWithDepartments(listRes.data, agentsRes.data);

    taskServiceLog.info('listed tasks for user', {
      count: tasks.length,
      filteredByDept: Boolean(departmentScope),
      userDept,
      filterDepartment: options.department ?? null,
      departmentScope,
    });

    return { data: tasks, error: null, isConfigured: true };
  }

  async getTaskWithRBAC(
    taskId: string,
    workspaceId?: string
  ): Promise<DataResult<TaskWithAgentDept | null>> {
    const rbacRes = await getRBACContext();
    if (!rbacRes.data) return { data: null, error: 'No access', isConfigured: false };

    const { workspace, rbacRole, department: userDept } = rbacRes.data;
    const wsId = workspaceId || workspace.id;
    const client = await this.getClient();

    const taskRes = await getTaskById(taskId, wsId, client);
    if (!taskRes.data) return taskRes as DataResult<TaskWithAgentDept | null>;

    const agentsRes = await listAgents(client);
    const [task] = this.enrichTasksWithDepartments([taskRes.data], agentsRes.data);
    const catalogRef =
      task.agentCatalogDepartmentId ??
      resolveCatalogDepartmentId(task.agentDepartment) ??
      task.agentDepartment;

    const isAdmin = rbacRole === 'owner' || rbacRole === 'admin';
    if (
      catalogRef &&
      !isAdmin &&
      !canAccessCatalogDepartment(rbacRole, userDept, catalogRef)
    ) {
      return { data: null, error: 'Task not found or department access denied', isConfigured: true };
    }

    return { data: task, error: null, isConfigured: true };
  }
}

export const taskService = new TaskService();