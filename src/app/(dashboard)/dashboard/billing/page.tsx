import { PageHeader } from '@/components/ui/PageHeader';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getSubscription } from '@/lib/billing/billing-service';
import { getCurrentUsage, getAllQuotas } from '@/lib/usage/quotas';
import { PLAN_LIMITS } from '@/lib/usage/usage-limits';
import type { BillingPlan } from '@/types/database';
import { UsageDashboard } from './UsageDashboard';

export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;

  if (!workspaceId) {
    return <div className="p-8">Workspace required to view usage.</div>;
  }

  const [subscription, currentUsage, quotas] = await Promise.all([
    getSubscription(workspaceId),
    getCurrentUsage(workspaceId),
    getAllQuotas(workspaceId),
  ]);

  const planId = (subscription.plan?.id ?? 'free') as BillingPlan;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Usage & Limits"
        eyebrow="Platform Usage"
        description="Current usage across all quotas — no billing enforcement, soft warnings only."
      />
      <UsageDashboard
        plan={subscription.plan?.name ?? 'Free'}
        planId={planId}
        memberCount={subscription.memberCount}
        currentUsage={currentUsage}
        quotas={quotas}
        planLimits={PLAN_LIMITS}
      />
    </div>
  );
}
