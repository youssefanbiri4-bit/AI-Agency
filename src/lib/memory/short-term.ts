import 'server-only';

import { getRedisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { increment, timing } from '@/lib/monitoring/metrics';
import type { MemoryMessage, ShortTermMemory } from './types';

const memoryLog = logger.child('memory:short-term');

const DEFAULT_TTL_SECONDS = 30 * 60; // 30 minutes

/** Process-local fallback used when Redis is unavailable. */
const localStore = new Map<string, ShortTermMemory>();

function nowIso(): string {
  return new Date().toISOString();
}

function blankMemory(runId: string, workspaceId: string, agentType: string): ShortTermMemory {
  const ts = nowIso();
  return {
    runId,
    workspaceId,
    agentType,
    messages: [],
    scratchpad: {},
    createdAt: ts,
    updatedAt: ts,
    ttlSeconds: DEFAULT_TTL_SECONDS,
  };
}

function key(runId: string): string {
  return `agent:stm:${runId}`;
}

async function readLocal(runId: string): Promise<ShortTermMemory | null> {
  return localStore.get(runId) ?? null;
}

async function writeLocal(run: ShortTermMemory): Promise<void> {
  localStore.set(run.runId, run);
}

async function readRedis(runId: string): Promise<ShortTermMemory | null> {
  const redis = await getRedisClient();
  if (!redis) return null;
  const raw = await redis.get(key(runId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShortTermMemory;
  } catch {
    memoryLog.warn('Corrupt short-term memory payload', { runId });
    return null;
  }
}

async function writeRedis(run: ShortTermMemory): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  await redis.set(key(run.runId), JSON.stringify(run), 'EX', run.ttlSeconds);
}

async function read(runId: string): Promise<ShortTermMemory | null> {
  const fromRedis = await readRedis(runId);
  if (fromRedis) return fromRedis;
  return readLocal(runId);
}

async function write(run: ShortTermMemory): Promise<void> {
  await writeRedis(run);
  await writeLocal(run); // keep local copy as a cache / fallback
}

export async function getShortTermMemory(
  runId: string,
  workspaceId: string,
  agentType: string
): Promise<ShortTermMemory> {
  const existing = await read(runId);
  if (existing) return existing;
  const fresh = blankMemory(runId, workspaceId, agentType);
  await write(fresh);
  return fresh;
}

export async function addMessage(
  runId: string,
  workspaceId: string,
  agentType: string,
  message: Omit<MemoryMessage, 'createdAt'>
): Promise<MemoryMessage> {
  const start = Date.now();
  const mem = await getShortTermMemory(runId, workspaceId, agentType);
  const full: MemoryMessage = { ...message, createdAt: nowIso() };
  mem.messages.push(full);
  mem.updatedAt = full.createdAt;
  await write(mem);
  timing('memory_shortterm_add_ms', Date.now() - start);
  increment('memory_shortterm_messages_total');
  return full;
}

export async function updateScratchpad(
  runId: string,
  workspaceId: string,
  agentType: string,
  patch: Record<string, unknown>
): Promise<void> {
  const mem = await getShortTermMemory(runId, workspaceId, agentType);
  mem.scratchpad = { ...mem.scratchpad, ...patch };
  mem.updatedAt = nowIso();
  await write(mem);
}

export async function getScratchpad(
  runId: string,
  workspaceId: string,
  agentType: string
): Promise<Record<string, unknown>> {
  const mem = await getShortTermMemory(runId, workspaceId, agentType);
  return mem.scratchpad;
}

export async function clearShortTermMemory(runId: string): Promise<void> {
  localStore.delete(runId);
  const redis = await getRedisClient();
  if (redis) {
    await redis.del(key(runId));
  }
  increment('memory_shortterm_cleared_total');
}
