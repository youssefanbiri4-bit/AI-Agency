import Link from 'next/link';
import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { ArrowLeft, Image as ImageIcon, Link2, Play, Video } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getCreativeAssetById } from '@/lib/data/creative-assets';
import { getBrandKitForWorkspace } from '@/lib/data/brand-kit';
import { checkOpenAIImageReadiness } from '@/lib/ai/openai-images';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDateTime } from '@/lib/utils';
import type { CreativeAssetRecord } from '@/types/database';
import { CreativeAssetDeleteButton } from '../CreativeAssetDeleteButton';
import { RemoveCreativeAssetImageButton } from '../RemoveCreativeAssetImageButton';

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

type Props = {
  params: Promise<{ id: string }>;
};

function valueOrEmpty(value?: string | null) {
  return value?.trim() || 'Not linked';
}

function DetailBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-black/42">{label}</p>
      <p className="mt-1 break-words text-sm leading-6 text-black/70">{valueOrEmpty(value)}</p>
    </div>
  );
}

function getVideoMetadata(asset: CreativeAssetRecord) {
  const video = asset.metadata?.video;

  if (!video || Array.isArray(video) || typeof video !== 'object') {
    return null;
  }

  const metadata = video as Record<string, unknown>;
  const publicUrl =
    typeof metadata.public_url === 'string'
      ? metadata.public_url
      : typeof metadata.public_video_url === 'string'
        ? metadata.public_video_url
        : null;

  return {
    publicUrl,
    filename: typeof metadata.original_filename === 'string' ? metadata.original_filename : null,
  };
}

function AssetContextPanel({ asset }: { asset: CreativeAssetRecord }) {
  const video = getVideoMetadata(asset);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Current Video"
          description="Video assets are used for organic Instagram Reels when linked in Content Studio."
          action={<Video className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="overflow-hidden rounded-lg border border-black/8 bg-[#D5E5E5]/30">
          {video?.publicUrl ? (
            <video
              src={video.publicUrl}
              controls
              playsInline
              className="max-h-[420px] w-full bg-black object-contain"
            />
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 px-6 text-center text-black/52">
              <Play className="h-10 w-10 text-[#F7CBCA]" />
              <p className="text-sm font-bold">No video saved yet</p>
            </div>
          )}
        </div>
        {video?.filename ? (
          <p className="mt-3 break-words text-xs font-bold text-black/48">{video.filename}</p>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Current Image"
          description="Existing image is preserved unless you choose a replacement upload."
          action={
            asset.image_url ? (
              <RemoveCreativeAssetImageButton assetId={asset.id} />
            ) : (
              <ImageIcon className="h-5 w-5 text-[#F7CBCA]" />
            )
          }
        />
        <div className="overflow-hidden rounded-lg border border-black/8 bg-[#D5E5E5]/30">
          {asset.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.image_url}
              alt={`${asset.title} preview`}
              className="max-h-[420px] w-full object-contain"
            />
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 px-6 text-center text-black/52">
              <ImageIcon className="h-10 w-10 text-[#F7CBCA]" />
              <p className="text-sm font-bold">No image saved yet</p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Linked Content"
          description="These relationships stay attached when the asset is updated."
          action={<Link2 className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="space-y-4">
          <DetailBlock label="Linked Reel" value={asset.linked_reel_id} />
          <DetailBlock label="Linked Task" value={asset.linked_task_id} />
          <DetailBlock label="Linked Campaign Task" value={asset.linked_campaign_task_id} />
          <DetailBlock label="Created" value={formatDateTime(asset.created_at)} />
          <DetailBlock label="Last Updated" value={formatDateTime(asset.updated_at)} />
        </div>
      </Card>
    </div>
  );
}

export default async function CreativeAssetDetailsPage({ params }: Props) {
  const { id: assetId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/creative-assets');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const [assetResult, brandKitResult] = await Promise.all([
    getCreativeAssetById(
      workspaceResult.data.id,
      user.id,
      assetId,
      supabase
    ),
    getBrandKitForWorkspace(supabase, workspaceResult.data.id),
  ]);
  const asset = assetResult.data;
  const readiness = checkOpenAIImageReadiness();

  if (!asset) {
    return (
      <div className="space-y-6">
        <Notice tone="warning" title="Asset not found">
          The requested creative asset is unavailable in this workspace.
        </Notice>
        <Link href="/dashboard/creative-assets" className={buttonStyles({ variant: 'outline' })}>
          <ArrowLeft className="h-4 w-4" />
          Back to Assets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Creative Assets"
        title="Edit Creative Asset"
        description="Update this saved creative asset without creating a duplicate."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/creative-assets" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              Back to Assets
            </Link>
            <CreativeAssetDeleteButton assetId={asset.id} redirectAfterDelete />
          </div>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <CreativeAssetForm
          mode="edit"
          openAIReady={readiness.isReady}
          workspaceId={workspaceResult.data.id}
          userId={user.id}
          asset={asset}
          brandKit={brandKitResult.data.brandKit}
          brandKitExists={brandKitResult.data.exists}
        />
        <AssetContextPanel asset={asset} />
      </div>
    </div>
  );
}
