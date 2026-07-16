/**
 * Horizontal Scaling Preparation (W17-T2)
 *
 * Helpers for running AgentFlow AI as multiple stateless instances behind a
 * load balancer:
 *  - Instance identity (stable per-process id, plus a human label).
 *  - Readiness / liveness probes that aggregate dependency health
 *    (Supabase/DB + Redis). Used by orchestrators (K8s, Fly, Render) and by a
 *    future /api/health endpoint.
 *  - `workspaceShardKey()` — deterministic affinity key for future data sharding
 *    or sticky routing without baking sharding logic into call sites.
 *
 * The app is already designed to be stateless (cookies for sessions, Redis for
 * rate-limit/cache state, DB for persistence), so these helpers make that
 * explicit and observable.
 */

import 'server-only';

import crypto from 'node:crypto';
import os from 'node:os';

import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const scaleLog = logger.child('scaling');

/** Stable per-process instance id (survives restarts only within the same PID). */
export const INSTANCE_ID: string =
  process.env.INSTANCE_ID ||
  `inst-${crypto.randomBytes(6).toString('hex')}`;

/** Human-friendly instance label (hostname + pid). */
export const INSTANCE_LABEL: string = `${os.hostname()}:${process.pid}`;

export interface DependencyHealth {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface ReadinessResult {
  ready: boolean;
  instanceId: string;
  checks: DependencyHealth[];
}

/**
 * Liveness: is this process alive and not deadlocked? Always true if we reach
 * the probe. Cheap; no I/O.
 */
export function livenessProbe(): { alive: boolean; instanceId: string; uptimeSeconds: number } {
  return {
    alive: true,
    instanceId: INSTANCE_ID,
    uptimeSeconds: Math.floor(process.uptime()),
  };
}

/**
 * Readiness: can this instance serve traffic? Aggregates dependency health.
 * Returns ready=false if any critical dependency is down.
 */
export async function readinessProbe(): Promise<ReadinessResult> {
  const checks: DependencyHealth[] = [];

  // Database / Supabase
  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) {
    checks.push({ name: 'database', ok: false, detail: 'admin client not configured' });
  } else {
    try {
      const { error } = await supabase.from('workspaces').select('id').limit(1).maybeSingle();
      checks.push({
        name: 'database',
        ok: !error,
        detail: error?.message,
      });
    } catch (err) {
      checks.push({ name: 'database', ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }

  // Redis (optional but required for distributed rate limiting / cache)
  try {
    const redis = await getRedisClient();
    if (!redis) {
      checks.push({ name: 'redis', ok: false, detail: 'not configured (in-memory fallback)' });
    } else {
      await redis.ping();
      checks.push({ name: 'redis', ok: true });
    }
  } catch (err) {
    checks.push({ name: 'redis', ok: false, detail: err instanceof Error ? err.message : String(err) });
  }

  const ready = checks.every((c) => c.ok);

  if (!ready) {
    scaleLog.warn('Readiness probe reports not-ready', { checks });
  }

  return { ready, instanceId: INSTANCE_ID, checks };
}

/**
 * Deterministic shard/affinity key for a workspace. Stable across instances and
 * restarts. Use for future data sharding, sticky routing, or partitioned
 * consumers — call sites stay decoupled from the sharding scheme.
 */
export function workspaceShardKey(workspaceId: string, shardCount = 64): number {
  let h = 2166136261;
  for (let i = 0; i < workspaceId.length; i++) {
    h ^= workspaceId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % shardCount;
}
