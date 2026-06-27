import NodeCache from 'node-cache';
import { logger } from '@/lib/logger';

const cacheLog = logger.child('data:cache');

// Basic in-memory cache for provider states
// Key format: provider-${providerName}-workspace-${workspaceId}
const providerCache = new NodeCache();

export async function getProviderState<T>(
  providerName: string,
  workspaceId: string,
  fetchFn: () => Promise<T>
): Promise<{ data: T | null; error: string | null }> {
  const cacheKey = `provider-${providerName}-workspace-${workspaceId}`;
  const cachedData = providerCache.get(cacheKey) as T | undefined;

  if (cachedData) {
    cacheLog.info('Cache hit', { provider: providerName, workspaceId });
    return { data: cachedData, error: null };
  }

  cacheLog.info('Cache miss', { provider: providerName, workspaceId });
  try {
    const data = await fetchFn();
    // Cache for a reasonable duration, e.g., 5 minutes
    providerCache.set(cacheKey, data, 300); 
    return { data, error: null };
  } catch (error: unknown) {
    cacheLog.error('Error fetching provider state', { provider: providerName, workspaceId, error: error instanceof Error ? error.message : String(error) });
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function clearProviderCache(providerName?: string, workspaceId?: string): void {
  if (providerName && workspaceId) {
    const cacheKey = `provider-${providerName}-workspace-${workspaceId}`;
    providerCache.del(cacheKey);
    cacheLog.info('Cleared cache', { provider: providerName, workspaceId });
  } else {
    providerCache.flushAll();
    cacheLog.info('Cleared all provider cache');
  }
}

export { providerCache };