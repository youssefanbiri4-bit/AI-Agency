'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/data/notifications';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

async function getNotificationActionContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/notifications');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  return {
    supabase,
    userId: user.id,
    workspaceId: workspaceResult.data.id,
  };
}

export async function markNotificationReadAction(formData: FormData) {
  const notificationId = readField(formData, 'notificationId');

  if (!notificationId) {
    return;
  }

  const { supabase, userId, workspaceId } = await getNotificationActionContext();

  await markNotificationRead(
    {
      workspaceId,
      userId,
      notificationId,
    },
    supabase
  );

  revalidatePath('/dashboard');
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/dashboard/notifications');
}

export async function markAllNotificationsReadAction() {
  const { supabase, userId, workspaceId } = await getNotificationActionContext();

  await markAllNotificationsRead(
    {
      workspaceId,
      userId,
    },
    supabase
  );

  revalidatePath('/dashboard');
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/dashboard/notifications');
}
