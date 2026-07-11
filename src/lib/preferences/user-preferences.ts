import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Department, RBACRole } from '@/types/auth';
import { isDepartment } from '@/types/auth';
import { hasPermission } from '@/lib/auth/rbac-client';
import { resolveEffectiveDepartment } from '@/lib/auth/require-page-access';

export const VIEW_AS_DEPARTMENT_KEY_PREFIX = 'view_as_department';

export function viewAsDepartmentKey(workspaceId: string): string {
  return `${VIEW_AS_DEPARTMENT_KEY_PREFIX}:${workspaceId}`;
}

export type PreferenceValue = string | number | boolean | null | Record<string, unknown>;

function normalizePreferenceValue(value: unknown): PreferenceValue | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function parseDepartmentPreference(value: unknown): Department | null {
  if (typeof value === 'string' && isDepartment(value)) {
    return value;
  }

  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { department?: unknown }).department === 'string' &&
    isDepartment((value as { department: string }).department)
  ) {
    return (value as { department: Department }).department;
  }

  return null;
}

export const userPreferencesService = {
  async get(
    supabase: SupabaseClient<Database>,
    userId: string,
    key: string
  ): Promise<PreferenceValue | null> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('value')
      .eq('user_id', userId)
      .eq('key', key)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return normalizePreferenceValue(data.value);
  },

  async set(
    supabase: SupabaseClient<Database>,
    userId: string,
    key: string,
    value: PreferenceValue
  ): Promise<void> {
    const { error } = await supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        key,
        value: value as Database['public']['Tables']['user_preferences']['Insert']['value'],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' }
    );

    if (error) {
      throw new Error(error.message);
    }
  },

  async delete(
    supabase: SupabaseClient<Database>,
    userId: string,
    key: string
  ): Promise<void> {
    const { error } = await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', userId)
      .eq('key', key);

    if (error) {
      throw new Error(error.message);
    }
  },

  async getViewAsDepartment(
    supabase: SupabaseClient<Database>,
    userId: string,
    workspaceId: string
  ): Promise<Department | null> {
    const raw = await this.get(supabase, userId, viewAsDepartmentKey(workspaceId));
    return parseDepartmentPreference(raw);
  },

  async setViewAsDepartment(
    supabase: SupabaseClient<Database>,
    userId: string,
    workspaceId: string,
    department: Department | null
  ): Promise<void> {
    const key = viewAsDepartmentKey(workspaceId);

    if (department === null) {
      await this.delete(supabase, userId, key);
      return;
    }

    await this.set(supabase, userId, key, department);
  },

  async getEffectiveDepartment(
    supabase: SupabaseClient<Database>,
    options: {
      userId: string;
      workspaceId: string;
      role: RBACRole;
      assignedDepartment: Department | null;
      cookieDepartment?: string | null;
    }
  ): Promise<Department | null> {
    const { userId, workspaceId, role, assignedDepartment, cookieDepartment } = options;

    let preferenceDepartment: string | null | undefined = undefined;

    if (hasPermission(role, 'admin')) {
      preferenceDepartment = await this.getViewAsDepartment(supabase, userId, workspaceId);
    }

    return resolveEffectiveDepartment({
      assignedDepartment,
      role,
      cookieDepartment,
      preferenceDepartment,
    });
  },
};