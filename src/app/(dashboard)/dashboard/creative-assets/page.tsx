import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowUpRight,
  FileText,
  Image as ImageIcon,
  Layers3,
  Pencil,
  Play,
  Plus,
  Sparkles,
  TriangleAlert,
  Video,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { checkOpenAIImageReadiness } from '@/lib/ai/openai-images';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles, Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { formatDate } from '@/lib/utils';
import type { CreativeAssetRecord, CreativeAssetStatus } from '@/types/database';
import { generatePromptAction } from './actions';
import { CreativeAssetDeleteButton } from './CreativeAssetDeleteButton';

const statusTone: Record<CreativeAssetStatus, string> = {
  draft: 'bg-black/8 text-black/64',
  prompt_ready: 'bg-[#D5E5E5]/58 text-[#F7CBCA]',
  generating: 'bg-[#F1F7F7]/58 text-[#E7F5DC]',
  generated: 'bg-[#D4EDDA]/58 text-[#155724]',
  failed: 'bg-[#FFD4D4]/58 text-[#A00000]',
  selected: 'bg-black text-white',
  archived: 'bg-black/8 text-black/48',
};

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function linkedLabel(asset: CreativeAssetRecord) {
  if (asset.linked_reel_id) {
    return 'Linked Reel';
  }

  if (asset.linked_campaign_task_id) {
    return 'Linked Campaign';
  }

  if (asset.linked_task_id) {
    return 'Linked Task';
  }

  return 'Not linked';
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
  };
}

function isVideoAsset(asset: CreativeAssetRecord) {
  return (
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(getVideoMetadata(asset)?.publicUrl)
  );
}

function CreativeAssetCard({ asset }: { asset: CreativeAssetRecord }) {
  async function generatePromptForAsset() {
    'use server';

    await generatePromptAction(asset.id);
  }

  const video = getVideoMetadata(asset);
  const videoAsset = isVideoAsset(asset);

  return (
    <Card className="grid gap-5 lg:grid-cols-[168px_minmax(0,1fr)]">
      <div className="aspect-[4/3] overflow-hidden rounded-lg border border-black/8 bg-[#D5E5E5]/36">
        {videoAsset && video?.publicUrl ? (
          <video
            src={video.publicUrl}
            controls
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        ) : asset.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.image_url}
            alt={`${asset.title} preview`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-black/46">
            {videoAsset ? (
              <Play className="h-7 w-7 text-[#F7CBCA]" />
            ) : (
              <ImageIcon className="h-7 w-7 text-[#F7CBCA]" />
            )}
            <p className="text-xs font-bold">{videoAsset ? 'Video asset' : 'Preview pending'}</p>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link href={`/dashboard/creative-assets/${asset.id}`}>
              <h2 className="break-words text-lg font-black text-black transition-colors hover:text-[#F7CBCA]">
                {asset.title}
              </h2>
            </Link>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className={statusTone[asset.status]}>{formatLabel(asset.status)}</Badge>
              <Badge className="bg-black/8 text-black/64">{formatLabel(asset.asset_type)}</Badge>
              {videoAsset ? <Badge className="bg-black text-white">Video</Badge> : null}
              <Badge className="bg-[#D5E5E5]/58 text-[#F7CBCA]">{formatLabel(asset.platform)}</Badge>
            </div>
          </div>
          <p className="shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-black/38">
            {formatDate(asset.created_at)}
          </p>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-black/58 sm:grid-cols-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-black/36">Source</p>
            <p className="mt-1 font-semibold text-black/70">{formatLabel(asset.source)}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-black/36">Linked</p>
            <p className="mt-1 font-semibold text-black/70">{linkedLabel(asset)}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-black/36">Prompt</p>
            <p className="mt-1 font-semibold text-black/70">
              {asset.prompt ? 'Ready' : 'Draft'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={`/dashboard/creative-assets/${asset.id}`}
            className={buttonStyles({ size: 'sm' })}
          >
            <Pencil className="h-4 w-4" />
            Edit Asset
          </Link>
          <Link
            href={`/dashboard/creative-assets/${asset.id}`}
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
          >
            Open Asset
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <form action={generatePromptForAsset}>
            <Button type="submit" variant="soft" size="sm">
              <FileText className="h-4 w-4" />
              Generate Prompt
            </Button>
          </form>
          <CreativeAssetDeleteButton assetId={asset.id} />
        </div>
      </div>
    </Card>
  );
}

export default async function CreativeAssetsPage() {
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

  const assetsResult = await listCreativeAssetsForWorkspace(
    workspaceResult.data.id,
    user.id,
    supabase,
    { limit: 48 }
  );
  const readiness = checkOpenAIImageReadiness();
  const assets = assetsResult.error ? [] : assetsResult.data;
  const draftPrompts = assets.filter((asset) => asset.status === 'draft').length;
  const generatedImages = assets.filter((asset) => asset.status === 'generated').length;
  const videoAssets = assets.filter(isVideoAsset).length;
  const failedGenerations = assets.filter((asset) => asset.status === 'failed').length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Creative Assets"
        title="Creative Assets"
        description="Generate reusable image prompts now and keep OpenAI image generation ready for server-side setup."
        actions={
          <Link href="/dashboard/creative-assets/new" className={buttonStyles()}>
            <Plus className="h-4 w-4" />
            New Creative Asset
          </Link>
        }
      />

      {!readiness.isReady && (
        <Notice tone="warning" title="Image generation setup required">
          Add OPENAI_API_KEY in Vercel to enable real image generation.
        </Notice>
      )}

      {assetsResult.error && (
        <Notice tone="danger" title="Creative assets unavailable">
          {assetsResult.error}
        </Notice>
      )}

      <div className="dashboard-stat-grid">
        <StatCard title="Total Assets" value={assets.length} icon={<Layers3 className="h-5 w-5" />} tone="neutral" />
        <StatCard title="Draft Prompts" value={draftPrompts} icon={<FileText className="h-5 w-5" />} tone="accent" />
        <StatCard title="Generated Images" value={generatedImages} icon={<ImageIcon className="h-5 w-5" />} tone="dark" />
        <StatCard title="Video Assets" value={videoAssets} icon={<Video className="h-5 w-5" />} tone="brand" />
        <StatCard title="Failed Generations" value={failedGenerations} icon={<TriangleAlert className="h-5 w-5" />} tone="brand" />
      </div>

      <Card>
        <CardHeader
          title="Asset Library"
          description="Workspace-scoped creative prompts, generated images, and future placement links."
          action={
            <Link href="/dashboard/creative-assets/new" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              <Sparkles className="h-4 w-4" />
              Generate Prompt
            </Link>
          }
        />
        {assets.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="No creative assets yet"
            description="Create a prompt-ready creative asset for Reels, campaigns, thumbnails, stories, or ads."
            action={
              <Link href="/dashboard/creative-assets/new" className={buttonStyles()}>
                <Plus className="h-4 w-4" />
                New Creative Asset
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {assets.map((asset) => (
              <CreativeAssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
