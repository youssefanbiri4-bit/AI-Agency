import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, resetAt: Date.now() + 1000 }),
}));

const mockGetWorkspace = vi.fn();
vi.mock('@/lib/data/workspaces-server', () => ({
  getWorkspace: (...args: unknown[]) => mockGetWorkspace(...args),
}));

const mockUpdateTaskExecutionState = vi.fn();
const mockGetTaskById = vi.fn();
vi.mock('@/lib/data/tasks', async () => {
  const actual = await vi.importActual('@/lib/data/tasks');
  return {
    ...actual,
    updateTaskExecutionState: (...args: unknown[]) => mockUpdateTaskExecutionState(...args),
    getTaskById: (...args: unknown[]) => mockGetTaskById(...args),
  };
});

const mockAdd = vi.fn();
vi.mock('@/lib/queue/queues', () => ({
  taskQueue: { add: (...args: unknown[]) => mockAdd(...args) },
}));

describe('POST /api/tasks/execute - lifecycle transition', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetWorkspace.mockResolvedValue({ data: { id: 'workspace-1' } });
  });

  it('transitions pending -> processing and enqueues job', async () => {
    mockUpdateTaskExecutionState.mockResolvedValue({ data: { id: 'task-1' }, error: null });
    mockAdd.mockResolvedValue({ id: 'job-123' });

    const { POST } = await import('@/app/api/tasks/execute/route');

    const body = {
      taskPayload: { foo: 'bar' },
      taskExecutionId: 'task-1',
      workspaceId: 'workspace-1',
    };

    const res = await POST(new NextRequest(new Request('http://localhost/api/tasks/execute', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }))); 

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.queued).toBe(true);
    expect(json.jobId).toBe('job-123');
    expect(mockUpdateTaskExecutionState).toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalled();
  });

  it('accepts task_id (snake_case) and includes task_id in job payload', async () => {
    mockUpdateTaskExecutionState.mockResolvedValue({ data: { id: 'task-1' }, error: null });
    mockAdd.mockResolvedValue({ id: 'job-234' });

    const { POST } = await import('@/app/api/tasks/execute/route');

    const body = {
      taskPayload: { foo: 'bar' },
      task_id: 'task-1',
      workspaceId: 'workspace-1',
    };

    const res = await POST(new NextRequest(new Request('http://localhost/api/tasks/execute', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }))); 

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.queued).toBe(true);
    expect(json.jobId).toBe('job-234');
    expect(mockUpdateTaskExecutionState).toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalled();
    // verify job payload contains canonical task_id
    const jobData = mockAdd.mock.calls[0][1];
    expect(jobData.task_id).toBe('task-1');
  });

  it('accepts taskId (camelCase) and includes task_id in job payload', async () => {
    mockUpdateTaskExecutionState.mockResolvedValue({ data: { id: 'task-1' }, error: null });
    mockAdd.mockResolvedValue({ id: 'job-345' });

    const { POST } = await import('@/app/api/tasks/execute/route');

    const body = {
      taskPayload: { foo: 'bar' },
      taskId: 'task-1',
      workspaceId: 'workspace-1',
    };

    const res = await POST(new NextRequest(new Request('http://localhost/api/tasks/execute', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }))); 

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.queued).toBe(true);
    expect(json.jobId).toBe('job-345');
    const jobData = mockAdd.mock.calls[0][1];
    expect(jobData.task_id).toBe('task-1');
  });

  it('accepts taskExecutionId when it matches an existing task id', async () => {
    // simulate lookup by getTaskById
    mockGetTaskById.mockResolvedValue({ data: { id: 'task-3' }, error: null });
    mockUpdateTaskExecutionState.mockResolvedValue({ data: { id: 'task-3' }, error: null });
    mockAdd.mockResolvedValue({ id: 'job-456' });

    const { POST } = await import('@/app/api/tasks/execute/route');

    const body = {
      taskPayload: { foo: 'bar' },
      taskExecutionId: 'task-3',
      workspaceId: 'workspace-1',
    };

    const res = await POST(new NextRequest(new Request('http://localhost/api/tasks/execute', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }))); 

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.queued).toBe(true);
    expect(json.jobId).toBe('job-456');
    const jobData = mockAdd.mock.calls[0][1];
    expect(jobData.task_id).toBe('task-3');
  });

  it('rejects unknown taskExecutionId', async () => {
    mockGetTaskById.mockResolvedValue({ data: null, error: null });
    mockUpdateTaskExecutionState.mockResolvedValue({ data: null, error: 'not found' });

    const { POST } = await import('@/app/api/tasks/execute/route');

    const body = {
      taskPayload: { foo: 'bar' },
      taskExecutionId: 'unknown-task',
      workspaceId: 'workspace-1',
    };

    const res = await POST(new NextRequest(new Request('http://localhost/api/tasks/execute', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }))); 

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/Task cannot be processed/);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('does not enqueue when transition fails', async () => {
    mockUpdateTaskExecutionState.mockResolvedValue({ data: null, error: 'already processing' });

    const { POST } = await import('@/app/api/tasks/execute/route');

    const body = {
      taskPayload: { foo: 'bar' },
      taskExecutionId: 'task-2',
      workspaceId: 'workspace-1',
    };

    const res = await POST(new NextRequest(new Request('http://localhost/api/tasks/execute', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }))); 

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/Task cannot be processed/);
    expect(mockAdd).not.toHaveBeenCalled();
  });
});
