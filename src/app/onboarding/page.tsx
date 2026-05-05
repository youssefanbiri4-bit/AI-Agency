import { redirect } from 'next/navigation';
import { CheckCircle2, Database, Workflow } from 'lucide-react';
import { WorkspaceSetupForm } from './WorkspaceSetupForm';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
  isSupabaseServerConfigured,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BrandMark } from '@/components/brand/BrandMark';

export default async function OnboardingPage() {
  if (!isSupabaseServerConfigured) {
    redirect('/auth/login?message=Supabase is not configured yet');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/onboarding');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (workspaceResult.data) {
    redirect('/dashboard');
  }

  const userLabel =
    typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name
      ? user.user_metadata.full_name
      : user.email;

  return (
    <div className="premium-page min-h-screen px-4 py-10 text-black sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1fr_440px] lg:items-center">
        <section className="space-y-6">
          <BrandMark href="/" tagline="Workspace setup" />

          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[#8B3CDE]">
              Welcome{userLabel ? `, ${userLabel}` : ''}
            </p>
            <h1 className="max-w-3xl text-3xl font-black tracking-normal text-black sm:text-4xl">
              Set up the workspace that will hold your real agency operations.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-black/62 sm:text-base">
              No sample tasks, reports, reviews, or activity will be created. Once this workspace exists,
              the dashboard can safely load real workspace-scoped data.
            </p>
          </div>

          <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-black/8 bg-white p-4 shadow-sm">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#F0DBEF] text-[#8B3CDE]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-black">Authenticated</p>
              <p className="mt-1 text-xs leading-5 text-black/54">Your Supabase session is active.</p>
            </div>
            <div className="rounded-lg border border-black/8 bg-white p-4 shadow-sm">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#F0DBEF] text-[#8B3CDE]">
                <Database className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-black">Supabase configured</p>
              <p className="mt-1 text-xs leading-5 text-black/54">Workspace records will be stored with RLS.</p>
            </div>
            <div className="rounded-lg border border-black/8 bg-white p-4 shadow-sm">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#F0DBEF] text-[#F55477]">
                <Workflow className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-black">n8n guarded</p>
              <p className="mt-1 text-xs leading-5 text-black/54">Execution stays disabled for this phase.</p>
            </div>
          </div>

          <StatusBadge status="Setup Required" type="system" />
        </section>

        <WorkspaceSetupForm />
      </div>
    </div>
  );
}
