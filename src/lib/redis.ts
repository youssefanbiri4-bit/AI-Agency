// SPDX-License-Identifier: MIT
// AgentFlow-AI — Unified Redis Client
// W10-P1-T1: Central Redis connection manager with lazy connection and in-memory fallback
//
// Provides:
//   - getRedisClient()   — lazy ioredis connection, returns null on failure
//   - isRedisAvailable() — quick readiness check
//   - connectRedis()      — explicit connect / wait-for-ready
//   - redis               — re-exported ioredis instance from queue/redis
//
// All consumers should call getRedisClient() and fall back to in-memory
// stores when it returns null.

import 'server-only';
import { logger } from '@/lib/logger';
import { redis as queueRedis, connectRedis as queueConnectRedis } from '@/lib/queue/redis';
import { registerShutdownable, asShutdownable } from '@/lib/graceful-shutdown';
import type { Redis } from 'ioredis';

const log = logger.child('redis');

let redisClient: Redis | null = null;
let connectionAttempted = false;
let connectionFailed = false;

/**
 * Get the shared Redis client (lazy connect).
 *
 * Returns the ioredis `Redis` instance if Redis is configured and reachable,
 * or `null` if Redis is not configured / unreachable (caller should fall back
 * to in-memory storage).
 *
 * Safe to call multiple times — only attempts connection once.
 */
export async function getRedisClient(): Promise<Redis | null> {
  if (redisClient) return redisClient;
  if (connectionAttempted) return connectionFailed ? null : redisClient;

  connectionAttempted = true;

  const host = process.env.REDIS_HOST?.trim();
  const portRaw = process.env.REDIS_PORT?.trim();

  if (!host) {
    log.info('REDIS_HOST not set — using in-memory fallback for all stores');
    connectionFailed = true;
    return null;
  }

  const port = portRaw ? Number(portRaw) : 6379;

  if (Number.isNaN(port) || port < 1 || port > 65535) {
    log.warn('Invalid REDIS_PORT — using in-memory fallback', { port: portRaw });
    connectionFailed = true;
    return null;
  }

  try {
    log.info('Connecting to Redis...', { host, port });
    await queueConnectRedis();

    if (queueRedis.status !== 'ready') {
      // Wait a bit for the ready event
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Redis connection timed out'));
        }, 10_000);

        queueRedis.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        queueRedis.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }

    redisClient = queueRedis;
    connectionFailed = false;

    // Register for graceful shutdown
    registerShutdownable(asShutdownable('redis', async () => {
      if (redisClient && redisClient.status !== 'end' && redisClient.status !== 'close') {
        try {
          await redisClient.quit();
          log.info('Redis connection closed gracefully');
        } catch (err) {
          log.error('Error closing Redis connection', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }));

    log.info('Redis client ready', { host, port });
    return redisClient;
  } catch (err) {
    connectionFailed = true;
    log.error('Redis connection failed — falling back to in-memory stores', {
      error: err instanceof Error ? err.message : String(err),
      host,
      port,
    });
    return null;
  }
}

/**
 * Check if a Redis client is available and ready.
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.status === 'ready';
}

/**
 * Connect to Redis and wait until ready.
 * Rejects if connection cannot be established.
 */
export async function connectRedis(): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    throw new Error('Redis is not available');
  }
}

/**
 * Force a reconnection attempt (useful after Redis recovers).
 */
export function resetRedisConnection(): void {
  connectionAttempted = false;
  connectionFailed = false;
  redisClient = null;
}

// Re-export the underlying ioredis instance for direct usage (e.g. BullMQ workers)
export { redis } from '@/lib/queue/redis';
export { connectRedis as queueConnectRedis } from '@/lib/queue/redis';
