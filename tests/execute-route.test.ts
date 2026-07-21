import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetWorkspace = vi.fn();
vi.mock('@/lib/data/workspaces-server', () => ({
  getWorkspace: (...args: unknown[]) => mockGetWorkspace(...args),
}));

const mockUpdateTaskExecutionState = vi.fn();
const mockGetTaskById = vi.fn();
vi.mock('@/features/tasks/data/tasks', async () => {
  const actual = await vi.importActual('@/features/tasks/data/tasks');
  return {
    ...actual,
    updateTaskExecutionState: (...args: unknown[]) => mockUpdateTaskExecutionState(...args),
    getTaskById: (...args: unknown[]) => mockGetTaskById(...args),
  };
});

const mockAdd = vi.fn();
vi.mock('@/lib/queue/queues', () => ({
  getTaskQueue: () => ({ add: (...args: unknown[]) => mockAdd(...args) }),
}));

const VALID_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_TASK_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_TASK_ID_2 = '550e8400-e29b-41d4-a716-446655440002';
const VALID_TASK_ID_3 = '550e8400-e29b-41d4-a716-446655440003';
const UNKNOWN_TASK_ID = '550e8400-e29b-41d4-a716-446655440099';

const mockCheckRateLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 900000 });
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));
vi.mock('@/lib/payload-limit', () => ({
  checkPayloadSize: vi.fn().mockImplementation(async (req: Request) => ({ ok: true as const, request: req })),
  PAYLOAD_LIMITS: { taskExecute: 256 * 1024 },
}));

describe('POST /api/tasks/execute - lifecycle transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockResolvedValue({ data: { id: VALID_WORKSPACE_ID } });
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 900000 });
  });

  it('transitions pending -> processing and enqueues job', async () => {
    mockGetTaskById.mockResolvedValue({ data: { id: VALID_TASK_ID_1 }, error: null });
    mockUpdateTaskExecutionState.mockResolvedValue({ data: { id: VALID_TASK_ID_1 }, error: null });
    mockAdd.mockResolvedValue({ id: 'job-123' });

    const { POST } = await import('@/app/api/tasks/execute/route');

    const body = {
      taskPayload: { foo: 'bar' },
      taskExecutionId: VALID_TASK_ID_1,
      workspaceId: VALID_WORKSPACE_ID,
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
    mockUpdateTaskExecutionState.mockResolvedValue({ data: { id: VALID_TASK_ID_1 }, error: null });
    mockAdd.mockResolvedValue({ id: 'job-234' });

    const { POST } = await import('@/app/api/tasks/execute/route');

    const body = {
      taskPayload: { foo: 'bar' },
      task_id: VALID_TASK_ID_1,
      workspaceId: VALID_WORKSPACE_ID,
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
    expect(jobData.task_id).toBe(VALID_TASK_ID_1);
  });

  it('accepts taskId (camelCase) and includes task_id in job payload', async () => {
    mockUpdateTaskExecutionState.mockResolvedValue({ data: { id: VALID_TASK_ID_1 }, error: null });
    mockAdd.mockResolvedValue({ id: 'job-345' });

    const { POST } = await import('@/app/api/tasks/execute/route');

    const body = {
      taskPayload: { foo: 'bar' },
      taskId: VALID_TASK_ID_1,
      workspaceId: VALID_WORKSPACE_ID,
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
    expect(jobData.task_id).toBe(VALID_TASK_ID_1);
  });

  it('accepts taskExecutionId when it matches an existing task id', async () => {
    // simulate lookup by getTaskById
    mockGetTaskById.mockResolvedValue({ data: { id: VALID_TASK_ID_3 }, error: null });
    mockUpdateTaskExecutionState.mockResolvedValue({ data: { id: VALID_TASK_ID_3 }, error: null });
    mockAdd.mockResolvedValue({ id: 'job-456' });

    const { POST } = await import('@/app/api/tasks/execute/route');

    const body = {
      taskPayload: { foo: 'bar' },
      taskExecutionId: VALID_TASK_ID_3,
      workspaceId: VALID_WORKSPACE_ID,
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
    expect(jobData.task_id).toBe(VALID_TASK_ID_3);
  });

  it('rejects unknown taskExecutionId', async () => {
    mockGetTaskById.mockResolvedValue({ data: null, error: null });
    mockUpdateTaskExecutionState.mockResolvedValue({ data: null, error: 'not found' });

    const { POST } = await import('@/app/api/tasks/execute/route');

    const body = {
      taskPayload: { foo: 'bar' },
      taskExecutionId: UNKNOWN_TASK_ID,
      workspaceId: VALID_WORKSPACE_ID,
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

    // Use task_id to bypass the tentative getTaskById path and hit the main transition failure.
    const body = {
      taskPayload: { foo: 'bar' },
      task_id: VALID_TASK_ID_2,
      workspaceId: VALID_WORKSPACE_ID,
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
