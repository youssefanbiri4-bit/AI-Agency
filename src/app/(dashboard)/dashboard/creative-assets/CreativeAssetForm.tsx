'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  FileText,
  Image as ImageIcon,
  Layers3,
  Play,
  RefreshCcw,
  Save,
  Sparkles,
  Upload,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import {
  createCreativeAssetAction,
  updateCreativeAssetAction,
  type CreativeAssetActionState,
} from './actions';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { toast } from '@/components/ui/toast';
import { useActionToast } from '@/hooks/useActionToast';
import { supabase } from '@/lib/supabase-client';
import type { CreativeAssetRecord } from '@/types/database';
import type { BrandKit } from '@/types/brand-kit';

type CreativeAssetFormMode = 'create' | 'edit';

interface CreativeAssetFormProps {
  mode: CreativeAssetFormMode;
  openAIReady: boolean;
  workspaceId: string;
  userId: string;
  asset?: CreativeAssetRecord;
  brandKit: BrandKit;
  brandKitExists: boolean;
}

const initialState: CreativeAssetActionState = {
  error: null,
  message: null,
  asset: null,
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const CREATIVE_ASSETS_BUCKET = 'creative-assets';

interface UploadedImageState {
  storagePath: string;
  imageUrl: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

interface UploadedVideoState {
  storagePath: string;
  publicUrl: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  duration: number | null;
}

function formatBytes(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

function formatDuration(seconds: number | null) {
  if (!seconds || !Number.isFinite(seconds)) {
    return 'Duration unavailable';
  }

  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = `${rounded % 60}`.padStart(2, '0');

  return `${minutes}:${remainingSeconds}`;
}

function readVideoMetadata(asset?: CreativeAssetRecord) {
  const video = asset?.metadata?.video;

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
    size: typeof metadata.size === 'number' ? metadata.size : null,
    duration: typeof metadata.duration === 'number' ? metadata.duration : null,
  };
}

function getGenerationMode(asset?: CreativeAssetRecord) {
  const generationMode = asset?.metadata?.generation_mode;

  return generationMode === 'generate_image' ? 'generate_image' : 'prompt_only';
}

export function CreativeAssetForm({
  mode,
  openAIReady,
  workspaceId,
  userId,
  asset,
  brandKit,
  brandKitExists,
}: CreativeAssetFormProps) {
  const router = useRouter();
  const [intent, setIntent] = useState(mode === 'edit' ? 'update_asset' : 'save_draft');
  const hasShownLoadedToastRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(asset?.image_url ?? null);
  const [uploadedImage, setUploadedImage] = useState<UploadedImageState | null>(null);
  const existingVideo = readVideoMetadata(asset);
  const [selectedVideoName, setSelectedVideoName] = useState<string | null>(
    existingVideo?.filename ?? null
  );
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(
    existingVideo?.publicUrl ?? null
  );
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideoState | null>(null);
  const brandColors = [
    brandKit.primaryColor,
    brandKit.secondaryColor,
    brandKit.accentColor,
    brandKit.backgroundColor,
  ]
    .filter(Boolean)
    .join(', ');
  const brandCreativeNotes = [
    brandKit.visualStyle,
    brandKit.imageStyleNotes,
    brandKit.designInspirationNotes,
  ]
    .filter(Boolean)
    .join('\n');
  const shouldPrefillFromBrand = mode === 'create';
  const [selectedVideoDuration, setSelectedVideoDuration] = useState<number | null>(
    existingVideo?.duration ?? null
  );
  const existingVideoFilename = existingVideo?.filename ?? null;
  const existingVideoDuration = existingVideo?.duration ?? null;
  const existingVideoPublicUrl = existingVideo?.publicUrl ?? null;
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const action =
    mode === 'create'
      ? createCreativeAssetAction
      : updateCreativeAssetAction.bind(null, asset?.id || '');
  const [state, formAction, isPending] = useActionState(action, initialState);
  const isBusy = isPending || isUploading;

  useActionToast({
    isPending,
    state,
    loadingMessage:
      intent === 'generate_image'
        ? 'Generating image...'
        : intent === 'generate_prompt'
          ? 'Generating image prompt...'
          : intent === 'update_asset'
            ? 'Updating asset...'
          : intent === 'save_to_assets'
            ? 'Saving asset...'
            : mode === 'create'
              ? 'Creating asset draft...'
              : 'Saving asset...',
    successMessage: (currentState) => currentState.message ?? 'Creative asset saved',
    successDescription:
      uploadedImage
        ? 'Creative asset saved'
        : intent === 'generate_image'
        ? 'The new image was saved to Creative Assets.'
        : intent === 'generate_prompt'
          ? 'Your prompt is ready for review.'
          : undefined,
    errorMessage: (currentState) =>
      uploadedImage
        ? 'Upload failed'
        : currentState.error ??
          (mode === 'edit'
            ? 'Could not update asset.'
            : intent === 'generate_image'
              ? 'Could not generate image.'
              : intent === 'generate_prompt'
                ? 'Could not generate image prompt.'
                : 'Could not save asset.'),
    errorDescription: (currentState) => (uploadedImage ? currentState.error : undefined),
  });

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }

      if (videoPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [previewUrl, videoPreviewUrl]);

  useEffect(() => {
    if (mode === 'edit' && asset && !hasShownLoadedToastRef.current) {
      hasShownLoadedToastRef.current = true;
      toast.info('Asset loaded.');
    }
  }, [asset, mode]);

  useEffect(() => {
    if (mode === 'create' && state.asset && !state.error) {
      router.push(`/dashboard/creative-assets/${state.asset.id}`);
    }

    if (mode === 'edit' && state.asset && !state.error) {
      window.setTimeout(() => {
        setSelectedImageName(null);
        setUploadedImage(null);
        setUploadedVideo(null);
        setSelectedVideoName(existingVideoFilename);
        setSelectedVideoDuration(existingVideoDuration);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (videoInputRef.current) {
          videoInputRef.current.value = '';
        }
      }, 0);
      router.refresh();
    }
  }, [existingVideoDuration, existingVideoFilename, mode, router, state.asset, state.error]);

  function validateSelectedFile(file: File) {
    const hasAllowedExtension = /\.(png|jpe?g|webp)$/i.test(file.name);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type) || !hasAllowedExtension) {
      toast.warning('Unsupported file type', {
        description: 'Use PNG, JPG, JPEG, or WEBP.',
      });
      return false;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.warning('File is too large', {
        description: `Choose an image up to ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      });
      return false;
    }

    return true;
  }

  function validateSelectedVideo(file: File) {
    const hasAllowedExtension = /\.(mp4|mov|webm)$/i.test(file.name);

    if (!ACCEPTED_VIDEO_TYPES.includes(file.type) || !hasAllowedExtension) {
      toast.warning('Unsupported video type.');
      return false;
    }

    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      toast.warning('Video is too large.', {
        description: `Choose a video up to ${formatBytes(MAX_VIDEO_UPLOAD_BYTES)}.`,
      });
      return false;
    }

    return true;
  }

  function sanitizeUploadFilename(filename: string) {
    const lower = filename.toLowerCase().trim();
    const safeBase = lower
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^\.+/, '')
      .slice(0, 120);

    return safeBase || 'creative-image.png';
  }

  function sanitizeUploadVideoFilename(filename: string) {
    const lower = filename.toLowerCase().trim();
    const safeBase = lower
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^\.+/, '')
      .slice(0, 120);

    return safeBase || 'creative-video.mp4';
  }

  async function applySelectedFile(file: File) {
    if (!validateSelectedFile(file)) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedImageName(file.name);
    setUploadedImage(null);
    setPreviewUrl(URL.createObjectURL(file));
    toast.info('Image selected', {
      description: file.name,
    });

    const loadingToastId = toast.loading('Uploading image...');
    setIsUploading(true);

    try {
      const storagePath = `${workspaceId}/${userId}/${Date.now()}-${sanitizeUploadFilename(file.name)}`;
      const { error } = await supabase.storage
        .from(CREATIVE_ASSETS_BUCKET)
        .upload(storagePath, file, {
          cacheControl: '31536000',
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        toast.update(loadingToastId, {
          tone: 'error',
          title: 'Upload failed',
          description: error.message,
        });
        setUploadedImage(null);
        setSelectedImageName(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setUploadedImage({
        storagePath,
        imageUrl: '',
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      toast.update(loadingToastId, {
        tone: 'success',
        title: 'Image uploaded successfully',
      });
    } catch {
      toast.update(loadingToastId, {
        tone: 'error',
        title: 'Upload failed',
      });
      setUploadedImage(null);
      setSelectedImageName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function applySelectedVideo(file: File) {
    if (!validateSelectedVideo(file)) {
      if (videoInputRef.current) {
        videoInputRef.current.value = '';
      }
      return;
    }

    if (videoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedVideoName(file.name);
    setSelectedVideoDuration(null);
    setUploadedVideo(null);
    setVideoPreviewUrl(objectUrl);
    toast.info('Video selected.', {
      description: file.name,
    });

    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.src = objectUrl;
    probe.onloadedmetadata = () => {
      setSelectedVideoDuration(Number.isFinite(probe.duration) ? probe.duration : null);
    };

    const loadingToastId = toast.loading('Uploading video...');
    setIsUploading(true);

    try {
      const storagePath = `${workspaceId}/${userId}/videos/${Date.now()}-${sanitizeUploadVideoFilename(file.name)}`;
      const { error } = await supabase.storage
        .from(CREATIVE_ASSETS_BUCKET)
        .upload(storagePath, file, {
          cacheControl: '31536000',
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        toast.update(loadingToastId, {
          tone: 'error',
          title: 'Could not upload video.',
          description: error.message,
        });
        setUploadedVideo(null);
        setSelectedVideoName(existingVideoFilename);
        setSelectedVideoDuration(existingVideoDuration);
        if (videoInputRef.current) {
          videoInputRef.current.value = '';
        }
        return;
      }

      const { data } = supabase.storage.from(CREATIVE_ASSETS_BUCKET).getPublicUrl(storagePath);

      setUploadedVideo({
        storagePath,
        publicUrl: data.publicUrl,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        duration: Number.isFinite(probe.duration) ? probe.duration : null,
      });
      setVideoPreviewUrl(data.publicUrl);
      toast.update(loadingToastId, {
        tone: 'success',
        title: 'Video uploaded successfully.',
      });
    } catch {
      toast.update(loadingToastId, {
        tone: 'error',
        title: 'Could not upload video.',
      });
      setUploadedVideo(null);
      setSelectedVideoName(existingVideoFilename);
      setSelectedVideoDuration(existingVideoDuration);
      if (videoInputRef.current) {
        videoInputRef.current.value = '';
      }
    } finally {
      setIsUploading(false);
    }
  }

  function removeSelectedImage() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedImageName(null);
    setUploadedImage(null);
    setPreviewUrl(asset?.image_url ?? null);
  }

  function removeSelectedVideo() {
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }

    if (videoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    setSelectedVideoName(existingVideoFilename);
    setSelectedVideoDuration(existingVideoDuration);
    setUploadedVideo(null);
    setVideoPreviewUrl(existingVideoPublicUrl);
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="uploaded_storage_path" value={uploadedImage?.storagePath ?? ''} />
      <input type="hidden" name="uploaded_image_url" value={uploadedImage?.imageUrl ?? ''} />
      <input type="hidden" name="uploaded_filename" value={uploadedImage?.filename ?? ''} />
      <input type="hidden" name="uploaded_content_type" value={uploadedImage?.contentType ?? ''} />
      <input type="hidden" name="uploaded_size_bytes" value={uploadedImage?.sizeBytes ?? ''} />
      <input type="hidden" name="uploaded_video_storage_path" value={uploadedVideo?.storagePath ?? ''} />
      <input type="hidden" name="uploaded_video_public_url" value={uploadedVideo?.publicUrl ?? ''} />
      <input type="hidden" name="uploaded_video_filename" value={uploadedVideo?.filename ?? ''} />
      <input type="hidden" name="uploaded_video_content_type" value={uploadedVideo?.contentType ?? ''} />
      <input type="hidden" name="uploaded_video_size_bytes" value={uploadedVideo?.sizeBytes ?? ''} />
      <input type="hidden" name="uploaded_video_duration" value={uploadedVideo?.duration ?? ''} />
      {!openAIReady && (
        <Notice tone="warning" title="Image generation setup required">
          Add OPENAI_API_KEY in Vercel to enable real image generation.
        </Notice>
      )}

      {state.error && (
        <Notice
          tone={state.setupRequired ? 'warning' : 'danger'}
          title={state.setupRequired ? 'Image generation disabled' : 'Creative asset action failed'}
        >
          {state.error}
        </Notice>
      )}

      {state.message && !state.error && (
        <Notice tone="success" title="Creative asset updated">
          {state.message}
        </Notice>
      )}

      <Card className="border-[#F7CBCA]/12 bg-white/90">
        <CardHeader
          title="Brand Context"
          description={
            brandKitExists
              ? 'Brand Kit values prefill empty creative fields and are included when image prompts are generated.'
              : 'Sample brand defaults are available until a Brand Kit is saved in Settings.'
          }
          action={<Sparkles className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="muted-panel p-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">Brand</p>
            <p className="mt-1 text-sm font-semibold text-black">{brandKit.brandName}</p>
          </div>
          <div className="muted-panel p-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">Offer</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-black">
              {brandKit.offer ?? 'Not set'}
            </p>
          </div>
          <div className="muted-panel p-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">Colors</p>
            <p className="mt-1 text-sm font-semibold text-black">{brandColors || 'Not set'}</p>
          </div>
          <div className="muted-panel p-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">Visual Style</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-black">
              {brandKit.visualStyle ?? 'Not set'}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Creative Brief"
          description="Define the asset, placement, audience, and visual constraints."
          action={<Layers3 className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              minLength={3}
              maxLength={200}
              defaultValue={asset?.title || ''}
              placeholder="Launch offer hero visual"
            />
          </div>

          <div>
            <Label htmlFor="asset_type">Type</Label>
            <Select id="asset_type" name="asset_type" defaultValue={asset?.asset_type || 'ad_creative'}>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="reel_cover">Reel cover</option>
              <option value="reel_video">Reel video</option>
              <option value="ad_creative">Ad creative</option>
              <option value="thumbnail">Thumbnail</option>
              <option value="campaign_visual">Campaign visual</option>
              <option value="carousel_slide">Carousel slide</option>
              <option value="story_visual">Story visual</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="platform">Platform</Label>
            <Select id="platform" name="platform" defaultValue={asset?.platform || 'general'}>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="google_ads">Google Ads</option>
              <option value="pinterest">Pinterest</option>
              <option value="general">General</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="goal">Goal</Label>
            <Input id="goal" name="goal" defaultValue={asset?.goal || ''} placeholder="Drive demo requests" />
          </div>

          <div>
            <Label htmlFor="offer">Offer</Label>
            <Input
              id="offer"
              name="offer"
              defaultValue={
                asset?.offer ||
                (shouldPrefillFromBrand
                  ? brandKit.campaignDefaults.defaultOffer || brandKit.offer || ''
                  : '')
              }
              placeholder="AI operations sprint"
            />
          </div>

          <div>
            <Label htmlFor="target_audience">Target Audience</Label>
            <Input
              id="target_audience"
              name="target_audience"
              defaultValue={asset?.target_audience || (shouldPrefillFromBrand ? brandKit.targetAudience || '' : '')}
              placeholder="B2B founders and operators"
            />
          </div>

          <div>
            <Label htmlFor="market">Market</Label>
            <Input id="market" name="market" defaultValue={asset?.market || (shouldPrefillFromBrand ? brandKit.market || '' : '')} placeholder="United States" />
          </div>

          <div>
            <Label htmlFor="tone">Tone</Label>
            <Input id="tone" name="tone" defaultValue={asset?.tone || (shouldPrefillFromBrand ? brandKit.toneOfVoice || '' : '')} placeholder="Confident, concise, premium" />
          </div>

          <div>
            <Label htmlFor="style">Style</Label>
            <Input id="style" name="style" defaultValue={asset?.style || (shouldPrefillFromBrand ? brandKit.visualStyle || '' : '')} placeholder="Premium SaaS editorial" />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="visual_direction">Visual Direction</Label>
            <Textarea
              id="visual_direction"
              name="visual_direction"
              rows={4}
              defaultValue={
                asset?.visual_direction ||
                (shouldPrefillFromBrand
                  ? brandKit.campaignDefaults.defaultCreativeDirection || brandCreativeNotes || ''
                  : '')
              }
              placeholder="Describe subject, environment, lighting, framing, and composition."
            />
          </div>

          <div>
            <Label htmlFor="text_overlay">Text Overlay</Label>
            <Input
              id="text_overlay"
              name="text_overlay"
              defaultValue={asset?.text_overlay || ''}
              placeholder="Cut onboarding time by 40%"
            />
          </div>

          <div>
            <Label htmlFor="brand_colors">Brand Colors</Label>
            <Input
              id="brand_colors"
              name="brand_colors"
              defaultValue={asset?.brand_colors || (shouldPrefillFromBrand ? brandColors : '')}
              placeholder="#F7CBCA, #F7CBCA, black, white"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={asset?.notes || (shouldPrefillFromBrand ? brandKit.imageStyleNotes || '' : '')}
              placeholder="Brand constraints, examples, compliance notes, or placement details."
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Upload Image"
          description="Upload a creative image for this workspace asset."
          action={<Upload className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div
          className={
            isDragging
              ? 'rounded-lg border border-[#F7CBCA]/45 bg-[#D5E5E5]/58 p-4 transition-colors'
              : 'rounded-lg border border-dashed border-black/14 bg-[#F9F7FB] p-4 transition-colors'
          }
          onDragOver={(event) => {
            event.preventDefault();
            if (!isBusy) {
              setIsDragging(true);
            }
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);

            if (isBusy) {
              return;
            }

            const file = event.dataTransfer.files[0];

            if (!file) {
              return;
            }

            const transfer = new DataTransfer();
            transfer.items.add(file);

            if (fileInputRef.current) {
              fileInputRef.current.files = transfer.files;
            }

            void applySelectedFile(file);
          }}
        >
          <input
            ref={fileInputRef}
            id="image_file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={isBusy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];

              if (file) {
                void applySelectedFile(file);
              }
            }}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex min-w-0 flex-col justify-center gap-3">
              <div>
                <p className="text-sm font-black text-black">Upload a creative image</p>
                <p className="mt-1 text-sm leading-6 text-black/58">
                  PNG, JPG, WEBP up to 10MB
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Choose Image
                </Button>
                {previewUrl ? (
                  <>
                    <Button
                      type="button"
                      variant="soft"
                      disabled={isBusy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Replace
                    </Button>
                    {selectedImageName ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={removeSelectedImage}
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
              <p className="min-h-5 truncate text-xs font-bold text-black/44">
                {selectedImageName || (asset?.storage_path ? 'Current asset image' : 'Drag an image here or choose one from your computer.')}
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-black/8 bg-white">
              {previewUrl ? (
                <div>
                  <div className="border-b border-black/8 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-black/42">
                    Preview
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Selected creative asset preview"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-4 text-center text-black/46">
                  <ImageIcon className="h-8 w-8 text-[#F7CBCA]" />
                  <p className="text-xs font-bold">Preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Upload Video"
          description="Upload an MP4, MOV, or WEBM asset for organic Instagram Reels."
          action={<Video className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="rounded-lg border border-dashed border-black/14 bg-[#F9F7FB] p-4 transition-colors">
          <input
            ref={videoInputRef}
            id="video_file"
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="sr-only"
            disabled={isBusy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];

              if (file) {
                void applySelectedVideo(file);
              }
            }}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex min-w-0 flex-col justify-center gap-3">
              <div>
                <p className="text-sm font-black text-black">Upload a Reel video</p>
                <p className="mt-1 text-sm leading-6 text-black/58">
                  MP4, MOV, WEBM up to {formatBytes(MAX_VIDEO_UPLOAD_BYTES)}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Choose Video
                </Button>
                {videoPreviewUrl ? (
                  <>
                    <Button
                      type="button"
                      variant="soft"
                      disabled={isBusy}
                      onClick={() => videoInputRef.current?.click()}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Replace
                    </Button>
                    {uploadedVideo ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={removeSelectedVideo}
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="min-h-5 space-y-1 text-xs font-bold text-black/44">
                <p className="truncate">
                  {selectedVideoName || 'Choose a video from your computer.'}
                </p>
                {selectedVideoName ? (
                  <p>
                    {uploadedVideo ? formatBytes(uploadedVideo.sizeBytes) : existingVideo?.size ? formatBytes(existingVideo.size) : 'Size pending'} · {formatDuration(selectedVideoDuration)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-black/8 bg-white">
              {videoPreviewUrl ? (
                <div>
                  <div className="border-b border-black/8 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-black/42">
                    Video Preview
                  </div>
                  <video
                    src={videoPreviewUrl}
                    controls
                    playsInline
                    className="aspect-[4/3] w-full bg-black object-contain"
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-4 text-center text-black/46">
                  <Play className="h-8 w-8 text-[#F7CBCA]" />
                  <p className="text-xs font-bold">Video preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Prompt Builder"
          description="Generate reusable image prompts now, and real images after setup."
          action={<Wand2 className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              name="prompt"
              rows={8}
              defaultValue={asset?.prompt || ''}
              placeholder="Optional starting prompt. The prompt builder can refine this from the brief."
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="negative_prompt">Negative Prompt</Label>
            <Textarea
              id="negative_prompt"
              name="negative_prompt"
              rows={4}
              defaultValue={asset?.negative_prompt || ''}
              placeholder="Avoid low-resolution artifacts, distorted text, clutter, and off-brand visuals."
            />
          </div>

          <div>
            <Label htmlFor="aspect_ratio">Aspect Ratio</Label>
            <Select id="aspect_ratio" name="aspect_ratio" defaultValue={asset?.aspect_ratio || '1:1'}>
              <option value="1:1">1:1</option>
              <option value="4:5">4:5</option>
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="output_style">Output Style</Label>
            <Select id="output_style" name="output_style" defaultValue={asset?.output_style || 'premium_saas'}>
              <option value="premium_saas">Premium SaaS</option>
              <option value="realistic">Realistic</option>
              <option value="minimal">Minimal</option>
              <option value="bold_ad">Bold Ad</option>
              <option value="clean_corporate">Clean Corporate</option>
              <option value="luxury">Luxury</option>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="generation_mode">Generation Mode</Label>
            <Select id="generation_mode" name="generation_mode" defaultValue={getGenerationMode(asset)}>
              <option value="prompt_only">Prompt only</option>
              <option value="generate_image">Generate image</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Actions"
          description="Save drafts, prepare prompts, and keep future placement hooks ready."
          action={<Sparkles className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {mode === 'edit' ? (
            <Button
              type="submit"
              name="intent"
              value="update_asset"
              disabled={isBusy}
              onClick={() => setIntent('update_asset')}
            >
              <Save className="h-4 w-4" />
              Update Asset
            </Button>
          ) : (
            <Button
              type="submit"
              name="intent"
              value="save_draft"
              disabled={isBusy}
              onClick={() => setIntent('save_draft')}
            >
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
          )}
          <Button
            type="submit"
            name="intent"
            value="generate_prompt"
            variant="outline"
            disabled={isBusy}
            onClick={() => setIntent('generate_prompt')}
          >
            <FileText className="h-4 w-4" />
            Generate Image Prompt
          </Button>
          {openAIReady ? (
            <Button
              type="submit"
              name="intent"
              value="generate_image"
              variant="success"
              disabled={isBusy}
              onClick={() => setIntent('generate_image')}
            >
              <ImageIcon className="h-4 w-4" />
              Generate Image
            </Button>
          ) : (
            <Button
              type="button"
              variant="success"
              className="opacity-80"
              disabled={isBusy}
              onClick={() =>
                toast.warning('Image generation setup is incomplete.', {
                  description: 'Add OPENAI_API_KEY in Vercel before generating real images.',
                })
              }
            >
              <ImageIcon className="h-4 w-4" />
              Generate Image
            </Button>
          )}
          <Button
            type="submit"
            name="intent"
            value="save_to_assets"
            variant="soft"
            disabled={isBusy}
            onClick={() => setIntent('save_to_assets')}
          >
            <BadgeCheck className="h-4 w-4" />
            Save to Assets
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isBusy}
            onClick={() =>
              toast.info('Reel cover linking is not available yet.', {
                description: 'This foundation keeps the asset ready for future reel-cover workflows.',
              })
            }
          >
            <ImageIcon className="h-4 w-4" />
            Use as Reel Cover later
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isBusy}
            onClick={() =>
              toast.info('Campaign creative linking is not available yet.', {
                description: 'This asset is saved now and can be wired into future campaign flows later.',
              })
            }
          >
            <Layers3 className="h-4 w-4" />
            Use as Campaign Creative later
          </Button>
        </div>
      </Card>
    </form>
  );
}
