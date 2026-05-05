'use server';

import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getSupabaseAdmin,
  setActiveWorkspaceIdCookie,
} from '@/lib/supabase-server';
import type { WorkspaceRecord } from '@/types/database';
import {
  buildWorkspaceSlug,
  getCurrentUserWorkspace,
  getCurrentWorkspaceMembership,
} from '@/lib/data/workspaces';

export interface WorkspaceSetupState {
  error: string | null;
  fields: {
    name: string;
    slug: string;
  };
}

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function createWorkspaceAction(
  _state: WorkspaceSetupState,
  formData: FormData
): Promise<WorkspaceSetupState> {
  const name = readField(formData, 'name');
  const rawSlug = readField(formData, 'slug');
  const slug = buildWorkspaceSlug(rawSlug || name);
  const fields = { name, slug: rawSlug };

  if (name.length < 2) {
    return {
      error: 'Workspace name must be at least 2 characters.',
      fields,
    };
  }

  if (name.length > 80) {
    return {
      error: 'Workspace name must be 80 characters or fewer.',
      fields,
    };
  }

  if (slug.length < 3) {
    return {
      error: 'Workspace slug must contain at least 3 letters or numbers.',
      fields,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/auth/login?redirectTo=/onboarding');
  }

  const existingWorkspace = await getCurrentUserWorkspace(supabase);

  if (existingWorkspace.data) {
    await setActiveWorkspaceIdCookie(existingWorkspace.data.id);
    redirect('/dashboard');
  }

  let workspace: WorkspaceRecord | null = null;

  const { data: insertedWorkspace, error: insertError } = await supabase
    .from('workspaces')
    .insert({
      name,
      slug,
      owner_id: user.id,
    })
    .select('*')
    .single();

  if (insertError) {
    if (insertError.code === '42501') {
      const { client: adminClient, error: adminClientError } = getSupabaseAdmin();

      if (!adminClient) {
        return {
          error: adminClientError,
          fields,
        };
      }

      const { data: adminWorkspace, error: adminInsertError } = await adminClient
        .from('workspaces')
        .insert({
          name,
          slug,
          owner_id: user.id,
        })
        .select('*')
        .single();

      if (adminInsertError) {
        return {
          error:
            adminInsertError.code === '23505'
              ? 'That workspace slug is already in use. Choose a different slug.'
              : adminInsertError.message,
          fields,
        };
      }

      workspace = adminWorkspace;
    } else {
      return {
        error:
          insertError.code === '23505'
            ? 'That workspace slug is already in use. Choose a different slug.'
            : insertError.message,
        fields,
      };
    }
  } else {
    workspace = insertedWorkspace;
  }

  const membershipResult = await getCurrentWorkspaceMembership(
    supabase,
    workspace.id,
    user.id
  );

  if (membershipResult.error || membershipResult.data?.role !== 'owner') {
    const { client: adminClient } = getSupabaseAdmin();
    const { data: adminMembership } = adminClient
      ? await adminClient
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspace.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : { data: null };

    if (adminMembership?.role !== 'owner') {
      return {
        error:
          'Workspace was created, but the owner membership was not visible yet. Refresh and try the dashboard again.',
        fields,
      };
    }
  }

  await setActiveWorkspaceIdCookie(workspace.id);
  redirect('/dashboard');
}
