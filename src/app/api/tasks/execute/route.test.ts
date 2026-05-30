import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/tasks/execute/route';
import type { DataResult } from '@/lib/data/types';
import type { WorkspaceRecord } from '@/types/database';

// Mock dependencies
vi.mock('@/lib/n8n', () => ({
  executeTask: vi.fn(),
}));

vi.mock('@/lib/data/workspaces-server', () => ({
  getWorkspace: vi.fn(),
}));

vi.mock('@/lib/data/tasks', () => ({
  updateTaskExecutionState: vi.fn().mockResolvedValue({ data: { id: 'task-1' }, error: null }),
  getTaskById: vi.fn().mockResolvedValue({ data: { id: 'task-1' }, error: null }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 100,
    resetAt: Date.now() + 900000,
  }),
}));

import { executeTask } from '@/lib/n8n';
import { getWorkspace } from '@/lib/data/workspaces-server';
import { checkRateLimit } from '@/lib/rate-limit';

const executeTaskMock = vi.mocked(executeTask);
const getWorkspaceMock = vi.mocked(getWorkspace);
const checkRateLimitMock = vi.mocked(checkRateLimit);

function makeWorkspaceRecord(id: string): WorkspaceRecord {
  return {
    id,
    name: 'Mock Workspace',
    slug: null,
    owner_id: 'owner-123',
    created_at: new Date('2020-01-01T00:00:00.000Z').toISOString(),
    updated_at: new Date('2020-01-02T00:00:00.000Z').toISOString(),
  };
}

function makeWorkspaceResult(
  data: WorkspaceRecord | null | undefined,
  isConfigured: boolean
): DataResult<WorkspaceRecord | null | undefined> {
  return { data, error: null, isConfigured };
}

describe('POST /api/tasks/execute', () => {
  const mockWorkspaceId = '550e8400-e29b-41d4-a716-446655440000';
  const mockTaskExecutionId = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute task successfully with valid payload', async () => {
    const workspaceResult = makeWorkspaceResult(
      makeWorkspaceRecord(mockWorkspaceId),
      true
    );

    getWorkspaceMock.mockResolvedValue(
      workspaceResult as unknown as Awaited<ReturnType<typeof getWorkspace>>
    );

    executeTaskMock.mockResolvedValue({ success: true, error: undefined });

    const request = new Request('http://localhost:3000/api/tasks/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskPayload: { action: 'test' },
        taskExecutionId: mockTaskExecutionId,
        workspaceId: mockWorkspaceId,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('should return 400 for invalid payload', async () => {
    const workspaceResult = makeWorkspaceResult(
      makeWorkspaceRecord(mockWorkspaceId),
      true
    );

    getWorkspaceMock.mockResolvedValue(
      workspaceResult as unknown as Awaited<ReturnType<typeof getWorkspace>>
    );

    const request = new Request('http://localhost:3000/api/tasks/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskPayload: { action: 'test' },
        // Missing required fields
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should return 429 when rate limited', async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const workspaceResult = makeWorkspaceResult(
      makeWorkspaceRecord(mockWorkspaceId),
      true
    );

    getWorkspaceMock.mockResolvedValue(
      workspaceResult as unknown as Awaited<ReturnType<typeof getWorkspace>>
    );

    const request = new Request('http://localhost:3000/api/tasks/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskPayload: { action: 'test' },
        taskExecutionId: mockTaskExecutionId,
        workspaceId: mockWorkspaceId,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
  });

  it('should return 400 when workspace not found', async () => {
    const workspaceResult = makeWorkspaceResult(undefined, false);

    getWorkspaceMock.mockResolvedValue(
      workspaceResult as unknown as Awaited<ReturnType<typeof getWorkspace>>
    );

    const request = new Request('http://localhost:3000/api/tasks/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskPayload: { action: 'test' },
        taskExecutionId: mockTaskExecutionId,
        workspaceId: mockWorkspaceId,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 400 when workspace ID mismatch', async () => {
    const differentWorkspaceId = '550e8400-e29b-41d4-a716-446655440002';

    const workspaceResult = makeWorkspaceResult(
      makeWorkspaceRecord(mockWorkspaceId),
      true
    );

    getWorkspaceMock.mockResolvedValue(
      workspaceResult as unknown as Awaited<ReturnType<typeof getWorkspace>>
    );

    const request = new Request('http://localhost:3000/api/tasks/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskPayload: { action: 'test' },
        taskExecutionId: mockTaskExecutionId,
        workspaceId: differentWorkspaceId,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Workspace ID mismatch');
  });
});
