import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { reportAppError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export default async function OperationalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let caughtError: unknown;
  let workspaceData:
    | {
        workspaceId: string;
        userRole: string;
      }
    | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const workspaceResult = await getCurrentUserWorkspace(supabase, undefined);

    if (workspaceResult.error) {
      throw workspaceResult.error;
    }

    if (!workspaceResult.data) {
      workspaceData = null;
    } else {
      const { data: workspace, error: workspaceError } = workspaceResult;
      if (workspaceError) throw workspaceError;

      const userId = (await supabase.auth.getUser()).data.user?.id;

      if (!userId) {
        workspaceData = null;
      } else {

        const { data: member, error: memberError } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspace.id)
          .eq('user_id', userId)
          .single();

        if (memberError) throw memberError;

        if (!member || !('role' in member)) {
          workspaceData = null;
        } else {
          workspaceData = {
            workspaceId: workspace.id,
            userRole: (member as { role: string }).role,
          };
        }

      }

    }
  } catch (error) {
    caughtError = error;
  }

  if (caughtError) {
    reportAppError('Operational dashboard layout error', caughtError);
    return (
      <div>
        <p>Error loading operational dashboard. Please try again later.</p>
        <a href="/dashboard">Go to Dashboard</a>
      </div>
    );
  }

  if (!workspaceData) {
    return (
      <div>
        <p>No active workspace found. Please select a workspace.</p>
        <a href="/dashboard">Go to Dashboard</a>
      </div>
    );
  }

  // If we reached here, workspaceData exists (userRole is admin/owner).
  return <>{children}</>;
}
