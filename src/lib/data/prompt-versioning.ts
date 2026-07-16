import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

type PromptClient = SupabaseClient<Database>;

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  title: string;
  description: string | null;
  promptText: string;
  category: string;
  tags: string[];
  createdAt: string;
  createdBy: string | null;
  changeNote: string | null;
}

interface CreateVersionInput {
  promptId: string;
  workspaceId: string;
  userId: string;
  title: string;
  description: string | null;
  promptText: string;
  category: string;
  tags: string[];
  changeNote: string | null;
}

const VERSION_STORAGE_KEY = 'af_prompt_versions';

function getVersionStorageKey(promptId: string): string {
  return `${VERSION_STORAGE_KEY}_${promptId}`;
}

function getVersionsFromStorage(promptId: string): PromptVersion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getVersionStorageKey(promptId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVersionsToStorage(promptId: string, versions: PromptVersion[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getVersionStorageKey(promptId), JSON.stringify(versions));
  } catch { /* */ }
}

export function getVersionHistory(promptId: string): PromptVersion[] {
  return getVersionsFromStorage(promptId).sort((a, b) => b.version - a.version);
}

export function getLatestVersion(promptId: string): PromptVersion | null {
  const versions = getVersionsFromStorage(promptId);
  return versions.length > 0 ? versions[versions.length - 1] : null;
}

export function createVersion(input: CreateVersionInput): PromptVersion {
  const existing = getVersionsFromStorage(input.promptId);
  const nextVersion = existing.length > 0 ? Math.max(...existing.map((v) => v.version)) + 1 : 1;

  const version: PromptVersion = {
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    promptId: input.promptId,
    version: nextVersion,
    title: input.title,
    description: input.description,
    promptText: input.promptText,
    category: input.category,
    tags: input.tags,
    createdAt: new Date().toISOString(),
    createdBy: input.userId,
    changeNote: input.changeNote,
  };

  existing.push(version);
  saveVersionsToStorage(input.promptId, existing);

  return version;
}

export function restoreVersion(promptId: string, versionId: string): PromptVersion | null {
  const versions = getVersionsFromStorage(promptId);
  const target = versions.find((v) => v.id === versionId);
  if (!target) return null;

  const maxVersion = Math.max(...versions.map((v) => v.version), 0);
  const restored: PromptVersion = {
    ...target,
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    version: maxVersion + 1,
    createdAt: new Date().toISOString(),
    changeNote: `Restored from v${target.version}`,
  };

  versions.push(restored);
  saveVersionsToStorage(promptId, versions);

  return restored;
}

export function deleteVersion(promptId: string, versionId: string): boolean {
  const versions = getVersionsFromStorage(promptId);
  const filtered = versions.filter((v) => v.id !== versionId);
  if (filtered.length === versions.length) return false;

  saveVersionsToStorage(promptId, filtered);
  return true;
}

export function getVersionDiff(promptId: string, versionAId: string, versionBId: string): {
  textChanged: boolean;
  tagsChanged: boolean;
  categoryChanged: boolean;
  titleChanged: boolean;
} | null {
  const versions = getVersionsFromStorage(promptId);
  const a = versions.find((v) => v.id === versionAId);
  const b = versions.find((v) => v.id === versionBId);
  if (!a || !b) return null;

  return {
    textChanged: a.promptText !== b.promptText,
    tagsChanged: JSON.stringify(a.tags) !== JSON.stringify(b.tags),
    categoryChanged: a.category !== b.category,
    titleChanged: a.title !== b.title,
  };
}

export async function createVersionFromCurrent(
  client: PromptClient | null,
  promptId: string,
  workspaceId: string,
  userId: string,
  changeNote: string | null
): Promise<DataResult<PromptVersion | null>> {
  if (!client) {
    return errorDataResult<PromptVersion | null>(null, 'Database not configured');
  }

  try {
    const { data, error } = await client
      .from('prompt_library')
      .select('*')
      .eq('id', promptId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !data) {
      return errorDataResult<PromptVersion | null>(null, error?.message ?? 'Prompt not found');
    }

    const version = createVersion({
      promptId,
      workspaceId,
      userId,
      title: data.title,
      description: data.description,
      promptText: data.prompt_text,
      category: data.category,
      tags: data.tags ?? [],
      changeNote,
    });

    return emptyDataResult(version);
  } catch (err) {
    return errorDataResult<PromptVersion | null>(null, err instanceof Error ? err.message : 'Failed to create version');
  }
}

export function exportVersionHistory(promptId: string): string {
  const versions = getVersionHistory(promptId);
  return JSON.stringify(versions, null, 2);
}

export function importVersionHistory(promptId: string, json: string): boolean {
  try {
    const versions: PromptVersion[] = JSON.parse(json);
    if (!Array.isArray(versions)) return false;

    const validVersions = versions.filter((v) =>
      v.id && v.promptId && typeof v.version === 'number' && v.promptText
    );

    saveVersionsToStorage(promptId, validVersions);
    return true;
  } catch {
    return false;
  }
}
