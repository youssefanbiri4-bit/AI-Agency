/**
 * Graceful shutdown handler for production environments.
 *
 * Registers SIGINT / SIGTERM listeners that:
 *  - Close the Redis connection (BullMQ)
 *  - Close BullMQ queue event listeners
 *  - Drain active queue jobs gracefully
 *  - Exit with a clean code after a forced timeout
 *
 * Usage: import in the root layout or instrumentation file:
 *    import '@/lib/graceful-shutdown';
 *    registerGracefulShutdown();
 *
 * This module is safe to import in server-only contexts.
 */

import 'server-only';
import { logger } from './logger';

const log = logger.child('graceful-shutdown');

let isShuttingDown = false;
const SHUTDOWN_TIMEOUT_MS = 15_000; // 15 seconds max

/** Interval handle for forced exit after timeout. */
let forceExitTimer: ReturnType<typeof setTimeout> | null = null;

interface Shutdownable {
  name: string;
  close: () => Promise<void> | void;
}

const resources: Shutdownable[] = [];

/**
 * Register a resource that should be closed during shutdown.
 */
export function registerShutdownable(resource: Shutdownable): void {
  resources.push(resource);
}

/**
 * Perform the graceful shutdown sequence.
 */
async function shutdownGracefully(signal: string): Promise<void> {
  if (isShuttingDown) {
    log.warn('Shutdown already in progress, ignoring duplicate signal', { signal });
    return;
  }
  isShuttingDown = true;

  log.info('Graceful shutdown started', { signal, resourceCount: resources.length });

  // Force exit after the timeout regardless
  forceExitTimer = setTimeout(() => {
    log.error('Graceful shutdown timed out, forcing exit', {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Close all registered resources in reverse order
  const results = await Promise.allSettled(
    resources.map(async (resource) => {
      try {
        await resource.close();
        log.info('Resource closed', { name: resource.name });
      } catch (err) {
        log.error('Resource close failed', {
          name: resource.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  const failed = results.filter((r) => r.status === 'rejected').length;

  if (forceExitTimer) {
    clearTimeout(forceExitTimer);
    forceExitTimer = null;
  }

  log.info('Graceful shutdown complete', { total: resources.length, failed });
  process.exit(0);
}

/**
 * Register the shutdown handlers.
 * Call this once at application startup.
 */
export function registerGracefulShutdown(): void {
  if (typeof process === 'undefined') return;
  if (process.listenerCount('SIGTERM') > 0) {
    // Already registered
    return;
  }

  const handler = (signal: string) => {
    // Remove listeners to prevent duplicate calls
    process.removeListener('SIGINT', handler as NodeJS.SignalsListener);
    process.removeListener('SIGTERM', handler as NodeJS.SignalsListener);
    void shutdownGracefully(signal);
  };

  process.on('SIGINT', handler as NodeJS.SignalsListener);
  process.on('SIGTERM', handler as NodeJS.SignalsListener);

  log.info('Graceful shutdown handlers registered');
}

/**
 * Helper to wrap an existing resource (like a Redis client) as a Shutdownable.
 */
export function asShutdownable(
  name: string,
  closeFn: () => Promise<void> | void
): Shutdownable {
  return { name, close: closeFn };
}
