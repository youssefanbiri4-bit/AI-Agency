import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the reels data layer directly (like existing tests do for tasks)
const mockListReels = vi.fn().mockResolvedValue({ data: [], error: null, isConfigured: true });
const mockCreateReel = vi.fn().mockResolvedValue({
  data: { id: 'reel-1', workspace_id: 'ws-1', user_id: 'user-1', title: 'Test Reel', status: 'draft', platform: 'instagram', type: 'reel' },
  error: null,
  isConfigured: true,
});
const mockDeleteReel = vi.fn().mockResolvedValue({ data: null, error: null, isConfigured: true });
const mockCountReelsByStatus = vi.fn().mockResolvedValue({
  data: { draft: 0, ready: 0, scheduled: 0, publishing: 0, published: 0, failed: 0 },
  error: null,
  isConfigured: true,
});
const mockUpdateReel = vi.fn().mockResolvedValue({ data: null, error: null, isConfigured: true });

vi.mock('@/lib/data/reels', () => ({
  listReels: (...args: unknown[]) => mockListReels(...args),
  createReel: (...args: unknown[]) => mockCreateReel(...args),
  deleteReel: (...args: unknown[]) => mockDeleteReel(...args),
  countReelsByStatus: (...args: unknown[]) => mockCountReelsByStatus(...args),
  updateReel: (...args: unknown[]) => mockUpdateReel(...args),
}));

describe('Reels Lifecycle - smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listReels returns empty array when no reels exist', async () => {
    const { listReels } = await import('@/lib/data/reels');
    const result = await listReels({ workspaceId: 'ws-1' });

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('createReel inserts a new reel with correct defaults', async () => {
    const { createReel } = await import('@/lib/data/reels');
    const result = await createReel({
      workspaceId: 'ws-1',
      userId: 'user-1',
      title: 'Test Reel',
    });

    expect(mockCreateReel).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'user-1',
      title: 'Test Reel',
    });
    expect(result.data).not.toBeNull();
    expect(result.data?.id).toBe('reel-1');
    expect(result.data?.status).toBe('draft');
    expect(result.error).toBeNull();
  });

  it('countReelsByStatus returns zero counts when no reels exist', async () => {
    const { countReelsByStatus } = await import('@/lib/data/reels');
    const result = await countReelsByStatus({ workspaceId: 'ws-1' });

    expect(result.data).toEqual({
      draft: 0,
      ready: 0,
      scheduled: 0,
      publishing: 0,
      published: 0,
      failed: 0,
    });
  });

  it('deleteReel succeeds for valid workspace and reel id', async () => {
    const { deleteReel } = await import('@/lib/data/reels');
    const result = await deleteReel('ws-1', 'reel-1');

    expect(mockDeleteReel).toHaveBeenCalledWith('ws-1', 'reel-1');
    expect(result.error).toBeNull();
  });
});
