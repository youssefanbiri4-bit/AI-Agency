import NodeCache from 'node-cache';

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
    console.log(`[ProviderCache] Cache hit for ${providerName} (${workspaceId})`);
    return { data: cachedData, error: null };
  }

  console.log(`[ProviderCache] Cache miss for ${providerName} (${workspaceId}). Fetching...`);
  try {
    const data = await fetchFn();
    // Cache for a reasonable duration, e.g., 5 minutes
    providerCache.set(cacheKey, data, 300); 
    return { data, error: null };
  } catch (error: unknown) {
    console.error(`[ProviderCache] Error fetching provider state for ${providerName} (${workspaceId}):`, error);
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function clearProviderCache(providerName?: string, workspaceId?: string): void {
  if (providerName && workspaceId) {
    const cacheKey = `provider-${providerName}-workspace-${workspaceId}`;
    providerCache.del(cacheKey);
    console.log(`[ProviderCache] Cleared cache for ${providerName} (${workspaceId})`);
  } else {
    providerCache.flushAll();
    console.log('[ProviderCache] Cleared all provider cache');
  }
}

export { providerCache };