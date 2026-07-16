import Link from 'next/link';
import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getBrandKitForWorkspace } from '@/lib/data/brand-kit';
import { checkOpenAIImageReadiness } from '@/lib/ai/openai-images';
import { buttonStyles } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';

const CreativeAssetForm = dynamic(
  () => import('../CreativeAssetForm').then((mod) => mod.CreativeAssetForm),
  {
    loading: () => (
      <LoadingState
        title="Loading form"
        description="Preparing the creative asset form."
      />
    ),
  }
);

export default async function NewCreativeAssetPage() {
  const readiness = checkOpenAIImageReadiness();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/creative-assets/new');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const brandKitResult = await getBrandKitForWorkspace(supabase, workspaceResult.data.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Creative Assets"
        title="New Creative Asset"
        description="Create a prompt-ready asset for Reels, campaigns, ads, thumbnails, stories, or carousel visuals."
        actions={
          <Link href="/dashboard/creative-assets" className={buttonStyles({ variant: 'outline' })}>
            <ArrowLeft className="h-4 w-4" />
            Back to Assets
          </Link>
        }
      />

      <CreativeAssetForm
        mode="create"
        openAIReady={readiness.isReady}
        workspaceId={workspaceResult.data.id}
        userId={user.id}
        brandKit={brandKitResult.data.brandKit}
        brandKitExists={brandKitResult.data.exists}
      />
    </div>
  );
}
