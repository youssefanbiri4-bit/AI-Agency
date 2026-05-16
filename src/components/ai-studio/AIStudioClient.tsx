'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  Copy,
  Film,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  RefreshCw,
  RotateCcw,
  Save,
  SearchCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  generateAIStudioImageAction,
  generateAIStudioVideoAction,
  refreshAIStudioVideoAction,
  type AIStudioAssetView,
  type AIStudioMode,
} from '@/app/(dashboard)/dashboard/ai-studio/actions';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/context';

interface AIStudioClientProps {
  initialHistory: AIStudioAssetView[];
  readiness: {
    image: {
      isReady: boolean;
      message: string;
      model: string;
      quality: string;
    };
    video: {
      isReady: boolean;
      message: string;
      model: string;
    };
  };
}

const imageModels = ['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini', 'dall-e-3'];
const videoModels = ['sora-2', 'sora-2-pro'];

const styleOptions = [
  { value: 'premium_saas', label: 'Premium SaaS' },
  { value: 'realistic', label: 'Realistic' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'bold_ad', label: 'Bold Ad' },
  { value: 'clean_corporate', label: 'Clean Corporate' },
  { value: 'luxury', label: 'Luxury' },
];

const aspectRatios = ['1:1', '4:5', '9:16', '16:9'];
const videoSizes = [
  { value: '1280x720', label: 'Landscape 16:9' },
  { value: '720x1280', label: 'Vertical 9:16' },
  { value: '1024x1024', label: 'Square 1:1' },
];
const videoDurations = ['4', '8', '12'];
const actionClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-sm font-black text-white/76 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-white';

function copyText(text: string, success: string, error: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(success),
    () => toast.error(error)
  );
}

function statusTone(status: string) {
  if (status === 'generated') return 'border-emerald-400/30 bg-emerald-400/12 text-emerald-100';
  if (status === 'failed') return 'border-rose-400/30 bg-rose-400/12 text-rose-100';
  if (status === 'generating') return 'border-sky-400/30 bg-sky-400/12 text-sky-100';
  return 'border-white/15 bg-white/10 text-white/70';
}

function modeLabel(mode: AIStudioMode) {
  return mode === 'image' ? 'Image' : 'Video';
}

export function AIStudioClient({ initialHistory, readiness }: AIStudioClientProps) {
  const { t, dir } = useLanguage();
  const [mode, setMode] = useState<AIStudioMode>('image');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [title, setTitle] = useState('');
  const [imageModel, setImageModel] = useState(readiness.image.model);
  const [videoModel, setVideoModel] = useState(readiness.video.model);
  const [style, setStyle] = useState('premium_saas');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [videoSize, setVideoSize] = useState('1280x720');
  const [duration, setDuration] = useState('8');
  const [history, setHistory] = useState(initialHistory);
  const [selectedAsset, setSelectedAsset] = useState<AIStudioAssetView | null>(initialHistory[0] ?? null);
  const [isPending, startTransition] = useTransition();

  const recentByMode = useMemo(
    () => history.filter((asset) => asset.mode === mode).slice(0, 8),
    [history, mode]
  );

  const promptLength = prompt.trim().length;
  const activeReadiness = mode === 'image' ? readiness.image : readiness.video;
  const canGenerate = promptLength >= 10 && activeReadiness.isReady && !isPending;

  function upsertHistory(asset: AIStudioAssetView) {
    setHistory((current) => [asset, ...current.filter((item) => item.id !== asset.id)].slice(0, 18));
    setSelectedAsset(asset);
  }

  function submit() {
    if (!canGenerate) {
      toast.error(
        !activeReadiness.isReady
          ? activeReadiness.message
          : t('dashboardI18n.aiStudio.promptTooShort', 'Add a more detailed prompt first.')
      );
      return;
    }

    const formData = new FormData();
    formData.set('prompt', prompt);
    formData.set('title', title || (mode === 'image' ? 'AI Studio Image' : 'AI Studio Video'));

    startTransition(async () => {
      const result =
        mode === 'image'
          ? await generateImage()
          : await generateVideo();

      if (result.error || !result.asset) {
        toast.error(result.error ?? t('dashboardI18n.aiStudio.generationFailed', 'Generation failed.'));
        return;
      }

      upsertHistory(result.asset);
      toast.success(result.message ?? t('dashboardI18n.aiStudio.generated', 'Generated successfully.'));
    });

    async function generateImage() {
      formData.set('negative_prompt', negativePrompt);
      formData.set('model', imageModel);
      formData.set('output_style', style);
      formData.set('aspect_ratio', aspectRatio);
      return generateAIStudioImageAction(formData);
    }

    async function generateVideo() {
      formData.set('model', videoModel);
      formData.set('seconds', duration);
      formData.set('size', videoSize);
      return generateAIStudioVideoAction(formData);
    }
  }

  function refreshVideo(asset: AIStudioAssetView) {
    startTransition(async () => {
      const result = await refreshAIStudioVideoAction(asset.id);
      if (result.error || !result.asset) {
        toast.error(result.error ?? t('dashboardI18n.aiStudio.refreshFailed', 'Could not refresh video status.'));
        return;
      }

      upsertHistory(result.asset);
      toast.success(result.message ?? t('dashboardI18n.aiStudio.statusRefreshed', 'Status refreshed.'));
    });
  }

  function reusePrompt(asset: AIStudioAssetView) {
    setMode(asset.mode);
    setPrompt(asset.prompt);
    setNegativePrompt(asset.negativePrompt ?? '');
    setTitle(asset.title);
    toast.success(t('dashboardI18n.aiStudio.promptReused', 'Prompt loaded into the studio.'));
  }

  return (
    <div dir={dir} className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#070A12] text-white shadow-[0_30px_90px_rgba(2,6,23,0.25)]">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_30%)] px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                {t('dashboardI18n.aiStudio.eyebrow', 'AI Studio')}
              </p>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                {t('dashboardI18n.aiStudio.title', 'Generate campaign visuals and videos')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/62">
                {t('dashboardI18n.aiStudio.description', 'Prompt, generate, review, and save OpenAI outputs as reusable Creative Assets. Nothing is published, scheduled, or sent to n8n.')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/8 p-1.5">
              <ModeButton active={mode === 'image'} onClick={() => setMode('image')} icon={<ImageIcon className="h-4 w-4" />}>
                {t('dashboardI18n.aiStudio.imageGeneration', 'Image Generation')}
              </ModeButton>
              <ModeButton active={mode === 'video'} onClick={() => setMode('video')} icon={<Film className="h-4 w-4" />}>
                {t('dashboardI18n.aiStudio.videoGeneration', 'Video Generation')}
              </ModeButton>
            </div>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
          <aside className="border-b border-white/10 bg-white/[0.035] p-5 xl:border-b-0 xl:border-e">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-white/84">
                  {t('dashboardI18n.aiStudio.assetTitle', 'Asset title')}
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, 120))}
                  placeholder={mode === 'image' ? 'Luxury skincare ad visual' : 'Product reveal video'}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-white/84">
                  {t('dashboardI18n.aiStudio.prompt', 'Prompt')}
                </span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value.slice(0, 4000))}
                  rows={8}
                  dir={/[\u0590-\u08FF]/.test(prompt) ? 'rtl' : 'ltr'}
                  placeholder={t('dashboardI18n.aiStudio.promptPlaceholder', 'Describe the scene, product, audience, mood, lighting, composition, and campaign goal...')}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                />
                <span className="mt-1 block text-xs font-bold text-white/35">{promptLength}/4000</span>
              </label>

              {mode === 'image' ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-white/84">
                    {t('dashboardI18n.aiStudio.negativePrompt', 'Negative prompt')}
                  </span>
                  <textarea
                    value={negativePrompt}
                    onChange={(event) => setNegativePrompt(event.target.value.slice(0, 1200))}
                    rows={3}
                    placeholder={t('dashboardI18n.aiStudio.negativePlaceholder', 'Optional: clutter, broken text, watermarks, low quality...')}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                  />
                </label>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {mode === 'image' ? (
                  <>
                    <SelectControl label={t('dashboardI18n.aiStudio.model', 'Model')} value={imageModel} onChange={setImageModel} options={imageModels.map((item) => ({ value: item, label: item }))} />
                    <SelectControl label={t('dashboardI18n.aiStudio.stylePreset', 'Style preset')} value={style} onChange={setStyle} options={styleOptions} />
                    <SelectControl label={t('dashboardI18n.aiStudio.aspectRatio', 'Aspect ratio')} value={aspectRatio} onChange={setAspectRatio} options={aspectRatios.map((item) => ({ value: item, label: item }))} />
                  </>
                ) : (
                  <>
                    <SelectControl label={t('dashboardI18n.aiStudio.model', 'Model')} value={videoModel} onChange={setVideoModel} options={videoModels.map((item) => ({ value: item, label: item }))} />
                    <SelectControl label={t('dashboardI18n.aiStudio.duration', 'Duration')} value={duration} onChange={setDuration} options={videoDurations.map((item) => ({ value: item, label: `${item}s` }))} />
                    <SelectControl label={t('dashboardI18n.aiStudio.orientation', 'Orientation')} value={videoSize} onChange={setVideoSize} options={videoSizes} />
                  </>
                )}
              </div>

              {!activeReadiness.isReady ? (
                <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
                  {activeReadiness.message}
                </div>
              ) : null}

              <button
                type="button"
                onClick={submit}
                disabled={!canGenerate}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 text-sm font-black text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:pointer-events-none disabled:bg-white/12 disabled:text-white/35 disabled:shadow-none"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {mode === 'image'
                  ? t('dashboardI18n.aiStudio.generateImage', 'Generate Image')
                  : t('dashboardI18n.aiStudio.generateVideo', 'Generate Video')}
              </button>
              <Link
                href={`/dashboard/quality-review?type=${mode === 'image' ? 'ai_studio_image_prompt' : 'ai_studio_video_prompt'}&platform=generic&content=${encodeURIComponent(prompt.slice(0, 6000))}`}
                className={cn(actionClass, 'w-full border-cyan-300/20 bg-cyan-300/10 text-cyan-100')}
              >
                <SearchCheck className="h-4 w-4" />
                {mode === 'image' ? 'Review Prompt' : 'Review Video Prompt'}
              </Link>
            </div>
          </aside>

          <main className="min-h-[620px] bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.12),transparent_38%)] p-5 sm:p-7">
            <div className="flex h-full min-h-[560px] flex-col rounded-[24px] border border-white/10 bg-black/24 p-4 shadow-inner">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/36">
                    {t('dashboardI18n.aiStudio.preview', 'Preview')}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">
                    {selectedAsset?.title ?? t('dashboardI18n.aiStudio.emptyPreviewTitle', 'Your generation will appear here')}
                  </h2>
                </div>
                {selectedAsset ? (
                  <span className={cn('rounded-full border px-3 py-1 text-xs font-black', statusTone(selectedAsset.status))}>
                    {selectedAsset.status}
                  </span>
                ) : null}
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[22px] border border-white/10 bg-slate-950">
                {selectedAsset ? (
                  <PreviewAsset asset={selectedAsset} />
                ) : (
                  <div className="max-w-md px-6 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/8">
                      <Sparkles className="h-7 w-7 text-cyan-200" />
                    </div>
                    <h3 className="mt-5 text-lg font-black text-white">
                      {t('dashboardI18n.aiStudio.emptyPreviewTitle', 'Your generation will appear here')}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/48">
                      {t('dashboardI18n.aiStudio.emptyPreviewDescription', 'Use the left panel to generate a campaign image or start an OpenAI video job.')}
                    </p>
                  </div>
                )}
              </div>

              {selectedAsset ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => reusePrompt(selectedAsset)} className={actionClass}>
                    <RotateCcw className="h-4 w-4" />
                    {t('dashboardI18n.aiStudio.reusePrompt', 'Reuse Prompt')}
                  </button>
                  <button type="button" onClick={() => copyText(selectedAsset.prompt, t('dashboardI18n.aiStudio.promptCopied', 'Prompt copied.'), t('dashboardI18n.aiStudio.copyFailed', 'Could not copy.'))} className={actionClass}>
                    <Copy className="h-4 w-4" />
                    {t('dashboardI18n.aiStudio.copyPrompt', 'Copy Prompt')}
                  </button>
                  <Link
                    href={`/dashboard/quality-review?type=${selectedAsset.mode === 'image' ? 'ai_studio_image_prompt' : 'ai_studio_video_prompt'}&platform=generic&content=${encodeURIComponent([
                      `Title: ${selectedAsset.title}`,
                      `Mode: ${selectedAsset.mode}`,
                      `Status: ${selectedAsset.status}`,
                      `Model: ${selectedAsset.model ?? 'Not provided'}`,
                      `Size: ${selectedAsset.size ?? 'Not provided'}`,
                      '',
                      selectedAsset.prompt,
                    ].join('\n').slice(0, 6000))}`}
                    className={actionClass}
                  >
                    <SearchCheck className="h-4 w-4" />
                    Review Creative
                  </Link>
                  {selectedAsset.mode === 'video' && selectedAsset.status !== 'generated' ? (
                    <button type="button" onClick={() => refreshVideo(selectedAsset)} disabled={isPending} className={cn(actionClass, 'disabled:opacity-50')}>
                      <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
                      {t('dashboardI18n.aiStudio.refreshStatus', 'Refresh Status')}
                    </button>
                  ) : null}
                  {(selectedAsset.imageUrl || selectedAsset.videoUrl) ? (
                    <a href={selectedAsset.imageUrl ?? selectedAsset.videoUrl ?? '#'} download className={actionClass}>
                      <ArrowDownToLine className="h-4 w-4" />
                      {t('common.download')}
                    </a>
                  ) : null}
                  <Link href={`/dashboard/creative-assets/${selectedAsset.id}`} className={actionClass}>
                    <Save className="h-4 w-4" />
                    {t('dashboardI18n.aiStudio.openCreativeAsset', 'Open Creative Asset')}
                  </Link>
                </div>
              ) : null}
            </div>
          </main>

          <aside className="border-t border-white/10 bg-white/[0.035] p-5 xl:border-s xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-white">
                  {t('dashboardI18n.aiStudio.recentGenerations', 'Recent generations')}
                </h2>
                <p className="mt-1 text-xs font-semibold text-white/42">
                  {recentByMode.length} {modeLabel(mode).toLowerCase()} results
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {recentByMode.length ? recentByMode.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelectedAsset(asset)}
                  className={cn(
                    'w-full rounded-2xl border p-3 text-start transition',
                    selectedAsset?.id === asset.id
                      ? 'border-cyan-300/40 bg-cyan-300/10'
                      : 'border-white/10 bg-black/22 hover:border-white/20 hover:bg-white/8'
                  )}
                >
                  <div className="flex gap-3">
                    <Thumb asset={asset} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-black text-white">{asset.title}</p>
                        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black', statusTone(asset.status))}>
                          {asset.status}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/46">{asset.prompt}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-black text-white/50">{asset.model ?? modeLabel(asset.mode)}</span>
                        {asset.size ? <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-black text-white/50">{asset.size}</span> : null}
                      </div>
                    </div>
                  </div>
                </button>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-black/22 px-4 py-8 text-center text-sm leading-6 text-white/45">
                  {t('dashboardI18n.aiStudio.noHistory', 'No generations in this mode yet.')}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition',
        active ? 'bg-white text-slate-950 shadow-sm' : 'text-white/58 hover:bg-white/8 hover:text-white'
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SelectControl({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-white/44">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-950 text-white">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewAsset({ asset }: { asset: AIStudioAssetView }) {
  if (asset.mode === 'image' && asset.imageUrl) {
    return (
      <a href={asset.imageUrl} target="_blank" rel="noreferrer" className="group relative flex h-full w-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.imageUrl} alt={asset.title} className="max-h-full max-w-full rounded-2xl object-contain" />
        <span className="absolute end-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-black text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" />
          Open
        </span>
      </a>
    );
  }

  if (asset.mode === 'video' && asset.videoUrl) {
    return <video src={asset.videoUrl} controls className="max-h-full max-w-full rounded-2xl" />;
  }

  return (
    <div className="px-6 text-center">
      <Loader2 className="mx-auto h-10 w-10 animate-spin text-cyan-200" />
      <h3 className="mt-4 text-lg font-black text-white">
        {asset.mode === 'video' ? 'Video generation in progress' : 'Generation in progress'}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-white/46">
        {asset.mode === 'video'
          ? 'OpenAI video generation can take a while. Refresh the status from the action bar or history card.'
          : 'Waiting for the generated media to become available.'}
      </p>
      {asset.progress !== null ? (
        <div className="mx-auto mt-5 h-2 w-64 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.max(4, Math.min(100, asset.progress))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Thumb({ asset }: { asset: AIStudioAssetView }) {
  if (asset.mode === 'image' && asset.imageUrl) {
    return (
      <div className="h-16 w-16 overflow-hidden rounded-xl bg-white/8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.imageUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-white/56">
      {asset.mode === 'video' ? <Film className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
    </div>
  );
}
