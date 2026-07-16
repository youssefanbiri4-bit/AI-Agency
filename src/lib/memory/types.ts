/**
 * Memory System — shared types.
 *
 * Models both short-term (ephemeral, in-session working memory) and
 * long-term (persistent, cross-session) memory for agents. Long-term memory
 * is partitioned into the classic cognitive-science categories:
 *   - episodic:   specific past events / interactions
 *   - semantic:   factual knowledge about the world / domain
 *   - procedural: how-to / skills / playbooks
 *   - working:    temporary scratch state (mirrors short-term memory in DB)
 */

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working';

export const MEMORY_TYPES: MemoryType[] = ['episodic', 'semantic', 'procedural', 'working'];

export interface MemoryEntry {
  id: string;
  workspaceId: string;
  agentType: string;
  memoryType: MemoryType;
  category: string;
  content: string;
  importance: number;
  confidence: number;
  source?: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  expiresAt: string | null;
}

/** A single turn in a conversation / reasoning working buffer. */
export interface MemoryMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ShortTermMemory {
  runId: string;
  workspaceId: string;
  agentType: string;
  messages: MemoryMessage[];
  scratchpad: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  ttlSeconds: number;
}

export interface RecallQuery {
  workspaceId: string;
  agentType?: string;
  memoryType?: MemoryType;
  category?: string;
  tags?: string[];
  limit?: number;
  minImportance?: number;
}

export function isValidMemoryType(value: unknown): value is MemoryType {
  return typeof value === 'string' && (MEMORY_TYPES as string[]).includes(value);
}
