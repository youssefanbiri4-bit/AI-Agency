import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock supabase server client FIRST to avoid cookies() error
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
  getSupabaseAdmin: vi.fn().mockReturnValue({ client: null, error: 'not configured' }),
  getActiveWorkspaceIdFromCookie: vi.fn().mockResolvedValue('ws-1'),
}));

const mockCheckQuota = vi.fn().mockResolvedValue({ allowed: true, current: 0, limit: 100, percentUsed: 0 });
const mockIncrementUsage = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/usage/quotas', () => ({
  checkQuota: (...args: unknown[]) => mockCheckQuota(...args),
  incrementUsage: (...args: unknown[]) => mockIncrementUsage(...args),
}));

const mockAssertProductionGate = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/production/gate', () => ({
  assertProductionGate: (...args: unknown[]) => mockAssertProductionGate(...args),
  checkProductionGate: vi.fn().mockResolvedValue({ passed: true, status: 'green', issues: [], checks: [], lightweight: { envOk: true, n8nOk: true, supabaseOk: true }, domainOk: true, checkedAt: new Date().toISOString() }),
}));

vi.mock('@/lib/auth/rbac', () => ({
  requireWorkspaceAccessWithRBAC: vi.fn().mockResolvedValue({
    ok: true,
    context: {
      workspace: { id: 'ws-1', name: 'Test Workspace', owner_id: 'user-1' },
      user: { id: 'user-1' },
      rbacRole: 'owner',
      department: null,
      isAdminOrHigher: true,
      isOperatorOrHigher: true,
    },
  }),
}));

const mockDataCreateTask = vi.fn().mockResolvedValue({
  data: { id: 'task-1', status: 'pending', workspace_id: 'ws-1', user_id: 'user-1' },
  error: null,
  isConfigured: true,
});
vi.mock('@/lib/data/tasks', () => ({
  createTask: (...args: unknown[]) => mockDataCreateTask(...args),
  getTaskById: vi.fn().mockResolvedValue({ data: { id: 'task-1', status: 'pending' }, error: null }),
  listTasks: vi.fn().mockResolvedValue({ data: [], error: null, isConfigured: true }),
  updateTaskExecutionState: vi.fn().mockResolvedValue({ data: { id: 'task-1' }, error: null }),
  createTaskEvent: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateTaskReviewStatus: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

vi.mock('@/lib/data/agents', () => ({
  listAgents: vi.fn().mockResolvedValue({ data: [], error: null, isConfigured: true }),
}));

const mockExecuteTask = vi.fn().mockResolvedValue({ data: { success: true }, error: null, isConfigured: true });
vi.mock('@/lib/tasks/task-service', () => ({
  taskService: { executeTask: (...args: unknown[]) => mockExecuteTask(...args) },
}));

describe('Task Lifecycle - smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckQuota.mockResolvedValue({ allowed: true, current: 0, limit: 100, percentUsed: 0 });
    mockIncrementUsage.mockResolvedValue(undefined);
    mockAssertProductionGate.mockResolvedValue(undefined);
    mockDataCreateTask.mockResolvedValue({
      data: { id: 'task-1', status: 'pending', workspace_id: 'ws-1', user_id: 'user-1' },
      error: null,
      isConfigured: true,
    });
    mockExecuteTask.mockResolvedValue({ data: { success: true }, error: null, isConfigured: true });
  });



  it('gatedCreateTask checks quota before creating', async () => {
    const { gatedCreateTask } = await import('@/actions/tasks');
    await gatedCreateTask({
      workspaceId: 'ws-1',
      userId: 'user-1',
      agentType: 'content-creator',
      title: 'Test Task',
      description: 'Test',
    });

    expect(mockCheckQuota).toHaveBeenCalledWith('ws-1', 'tasks');
    expect(mockAssertProductionGate).toHaveBeenCalledWith('ws-1');
    expect(mockDataCreateTask).toHaveBeenCalled();
    expect(mockIncrementUsage).toHaveBeenCalledWith('ws-1', 'tasks', 1);
  });

  it('gatedCreateTask blocks when quota exceeded', async () => {
    mockCheckQuota.mockResolvedValueOnce({
      allowed: false,
      current: 100,
      limit: 100,
      percentUsed: 100,
      message: 'Task quota exceeded.',
    });

    const { gatedCreateTask } = await import('@/actions/tasks');
    await expect(
      gatedCreateTask({
        workspaceId: 'ws-1',
        userId: 'user-1',
        agentType: 'content-creator',
        title: 'Test Task',
        description: 'Test',
      })
    ).rejects.toThrow('Task quota exceeded');

    expect(mockDataCreateTask).not.toHaveBeenCalled();
  });

  it('gatedCreateTask does not increment usage when creation fails', async () => {
    mockDataCreateTask.mockResolvedValueOnce({ data: null, error: 'DB error', isConfigured: true });

    const { gatedCreateTask } = await import('@/actions/tasks');
    await gatedCreateTask({
      workspaceId: 'ws-1',
      userId: 'user-1',
      agentType: 'content-creator',
      title: 'Test Task',
      description: 'Test',
    });

    expect(mockIncrementUsage).not.toHaveBeenCalled();
  });

  it('gatedCreateTask throws when RBAC workspace access is denied (H7)', async () => {
    const { requireWorkspaceAccessWithRBAC } = await import('@/lib/auth/rbac');
    vi.mocked(requireWorkspaceAccessWithRBAC).mockResolvedValueOnce({
      ok: false,
      error: 'Editor role required to create tasks',
    });

    const { gatedCreateTask } = await import('@/actions/tasks');
    await expect(
      gatedCreateTask({
        workspaceId: 'ws-1',
        userId: 'user-1',
        agentType: 'content-creator',
        title: 'Test Task',
        description: 'Test',
      })
    ).rejects.toThrow('Editor role required to create tasks');
    expect(mockDataCreateTask).not.toHaveBeenCalled();
  });

  it('gatedExecuteTask checks quota + production gate before execution', async () => {
    const { gatedExecuteTask } = await import('@/actions/tasks');
    await gatedExecuteTask('task-1', 'ws-1');

    expect(mockCheckQuota).toHaveBeenCalledWith('ws-1', 'ai_generations');
    expect(mockAssertProductionGate).toHaveBeenCalledWith('ws-1');
    expect(mockExecuteTask).toHaveBeenCalledWith('task-1', 'ws-1');
    expect(mockIncrementUsage).toHaveBeenCalledWith('ws-1', 'ai_generations', 1);
  });

  it('gatedExecuteTask blocks when AI generation quota exceeded', async () => {
    mockCheckQuota.mockResolvedValueOnce({
      allowed: false,
      current: 50,
      limit: 50,
      percentUsed: 100,
      message: 'AI generation quota exceeded.',
    });

    const { gatedExecuteTask } = await import('@/actions/tasks');
    await expect(gatedExecuteTask('task-1', 'ws-1')).rejects.toThrow('AI generation quota exceeded');
  });

  it('gatedExecuteTask blocks when RBAC operator access is denied (H7)', async () => {
    const { requireWorkspaceAccessWithRBAC } = await import('@/lib/auth/rbac');
    vi.mocked(requireWorkspaceAccessWithRBAC).mockResolvedValueOnce({
      ok: false,
      error: 'Operator role required to execute tasks',
    });

    const { gatedExecuteTask } = await import('@/actions/tasks');
    await expect(gatedExecuteTask('task-1', 'ws-1')).rejects.toThrow(
      'Operator role required to execute tasks'
    );
    expect(mockExecuteTask).not.toHaveBeenCalled();
  });
});
