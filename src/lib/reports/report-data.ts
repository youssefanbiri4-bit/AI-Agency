import 'server-only';

import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listTasks } from '@/lib/data/tasks';
import { listReelsForWorkspace } from '@/lib/data/reels';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { getBrandKitForWorkspace } from '@/lib/data/brand-kit';
import { getBrandingForWorkspace } from '@/lib/data/branding';
import type { ReportBranding } from '@/lib/reports/report-types';
import type { Task } from '@/types';
import type { CreativeAssetRecord, ReelRecord } from '@/types/database';

export interface ClientReportWorkspaceData {
  workspaceId: string;
  workspaceName: string;
  tasks: Task[];
  reels: ReelRecord[];
  creativeAssets: CreativeAssetRecord[];
  branding: ReportBranding;
  reviewsCount: number;
}

export async function gatherClientReportData(options?: {
  workspaceId?: string;
  taskIds?: string[];
}): Promise<{ data: ClientReportWorkspaceData | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: 'Authentication required.' };
    }

    const activeWorkspaceId = options?.workspaceId ?? (await getActiveWorkspaceIdFromCookie());
    const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

    if (!workspaceResult.data) {
      return { data: null, error: 'Workspace not found.' };
    }

    const workspaceId = workspaceResult.data.id;

    const [tasksResult, reelsResult, assetsResult, brandKitResult, brandingResult, reviewsResult] =
      await Promise.all([
        listTasks({ workspaceId }, supabase),
        listReelsForWorkspace(workspaceId, undefined, supabase),
        listCreativeAssetsForWorkspace(workspaceId, undefined, supabase),
        getBrandKitForWorkspace(supabase, workspaceId),
        getBrandingForWorkspace(supabase, workspaceId),
        supabase
          .from('task_reviews')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId),
      ]);

    if (tasksResult.error) {
      return { data: null, error: tasksResult.error };
    }

    let tasks = tasksResult.data;
    if (options?.taskIds?.length) {
      const idSet = new Set(options.taskIds);
      tasks = tasks.filter((task) => idSet.has(task.id));
    }

    const brandKit = brandKitResult.data?.brandKit;
    const workspaceBranding = brandingResult.data?.branding;

    const branding: ReportBranding = {
      agencyName:
        brandKit?.brandName ||
        workspaceBranding?.logo_alt_text ||
        workspaceResult.data.name ||
        'AgentFlow AI',
      logoUrl: brandKit?.logoUrl || workspaceBranding?.logo_url || null,
      primaryColor: brandKit?.primaryColor || '#F7CBCA',
      accentColor: brandKit?.accentColor || '#5D6B6B',
      secondaryColor: brandKit?.secondaryColor || '#D5E5E5',
    };

    return {
      data: {
        workspaceId,
        workspaceName: workspaceResult.data.name,
        tasks,
        reels: reelsResult.data ?? [],
        creativeAssets: assetsResult.data ?? [],
        branding,
        reviewsCount: reviewsResult.count ?? 0,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to gather report data.',
    };
  }
}