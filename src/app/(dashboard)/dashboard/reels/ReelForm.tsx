'use client';

import { useActionState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Captions, Clapperboard, FileText, Film, Megaphone, Wand2 } from 'lucide-react';
import {
  createReelAction,
  updateReelAction,
  type CreateReelActionState,
  type UpdateReelActionState,
} from './actions';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { useActionToast } from '@/components/ui/useActionToast';
import type { ReelRecord } from '@/types/database';

type ReelFormMode = 'create' | 'edit';

interface ReelFormProps {
  mode: ReelFormMode;
  reel?: ReelRecord;
}

const initialState: CreateReelActionState | UpdateReelActionState = {
  error: null,
  message: null,
};

function metadataNotes(reel?: ReelRecord) {
  const value = reel?.metadata?.notes;
  return typeof value === 'string' ? value : '';
}

function formatDatetimeLocal(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function hashtagsValue(reel?: ReelRecord) {
  return reel?.hashtags?.length ? reel.hashtags.map((tag) => `#${tag}`).join(' ') : '';
}

export function ReelForm({ mode, reel }: ReelFormProps) {
  const router = useRouter();
  const action = useMemo(
    () => (mode === 'create' ? createReelAction : updateReelAction.bind(null, reel?.id || '')),
    [mode, reel?.id]
  );
  const [state, formAction, isPending] = useActionState(action, initialState);

  useActionToast({
    isPending,
    state,
    loadingMessage: mode === 'create' ? 'Creating reel draft...' : 'Updating draft...',
    successMessage: (currentState) => currentState.message ?? (mode === 'create' ? 'Draft saved.' : 'Draft updated.'),
    errorMessage: (currentState) => currentState.error ?? (mode === 'create' ? 'Could not create reel.' : 'Could not update reel.'),
  });

  useEffect(() => {
    if (mode === 'create' && state.reel && !state.error) {
      router.push(`/dashboard/reels/${state.reel.id}`);
    }

    if (mode === 'edit' && state.reel && !state.error) {
      router.refresh();
    }
  }, [mode, router, state.error, state.reel]);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <Notice tone="danger" title="Reel action failed">
          {state.error}
        </Notice>
      )}

      {state.message && !state.error && (
        <Notice tone="success" title="Reel updated">
          {state.message}
        </Notice>
      )}

      <Card id={mode === 'edit' ? 'editor' : undefined}>
        <CardHeader
          title="Campaign Basics"
          description="Core positioning for the organic Instagram Reel."
          action={<Megaphone className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="title">Reel Title</Label>
            <Input
              id="title"
              name="title"
              required
              minLength={3}
              maxLength={200}
              defaultValue={reel?.title || ''}
              placeholder="Product launch teaser"
            />
          </div>

          <div>
            <Label htmlFor="offer">Product / Service / Offer</Label>
            <Input
              id="offer"
              name="offer"
              defaultValue={reel?.offer || ''}
              placeholder="AI operations sprint"
            />
          </div>

          <div>
            <Label htmlFor="goal">Campaign Goal</Label>
            <Input
              id="goal"
              name="goal"
              defaultValue={reel?.goal || ''}
              placeholder="Drive qualified demo requests"
            />
          </div>

          <div>
            <Label htmlFor="target_audience">Target Audience</Label>
            <Input
              id="target_audience"
              name="target_audience"
              defaultValue={reel?.target_audience || ''}
              placeholder="B2B founders and operators"
            />
          </div>

          <div>
            <Label htmlFor="market">Market / Country</Label>
            <Input
              id="market"
              name="market"
              defaultValue={reel?.market || ''}
              placeholder="United States"
            />
          </div>

          <div>
            <Label htmlFor="tone">Tone</Label>
            <Input
              id="tone"
              name="tone"
              defaultValue={reel?.tone || ''}
              placeholder="Confident, concise, premium"
            />
          </div>

          <div>
            <Label htmlFor="cta">CTA</Label>
            <Input
              id="cta"
              name="cta"
              defaultValue={reel?.cta || ''}
              placeholder="Book a strategy call"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={metadataNotes(reel)}
              placeholder="Brand constraints, proof points, objections, or production notes"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Creative Planning"
          description="Script, caption, and creative direction for the Reel."
          action={<Clapperboard className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="hook">Hook</Label>
            <Textarea
              id="hook"
              name="hook"
              rows={3}
              defaultValue={reel?.hook || ''}
              placeholder="First 3 seconds"
            />
          </div>

          <div>
            <Label htmlFor="main_message">Main Message</Label>
            <Textarea
              id="main_message"
              name="main_message"
              rows={3}
              defaultValue={reel?.main_message || ''}
              placeholder="Primary takeaway"
            />
          </div>

          <div>
            <Label htmlFor="script">Script</Label>
            <Textarea
              id="script"
              name="script"
              rows={8}
              defaultValue={reel?.script || ''}
              placeholder="Voiceover, on-screen copy, and beats"
            />
          </div>

          <div>
            <Label htmlFor="storyboard">Scene Outline / Storyboard</Label>
            <Textarea
              id="storyboard"
              name="storyboard"
              rows={8}
              defaultValue={reel?.storyboard || ''}
              placeholder="Scene-by-scene visual outline"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              name="caption"
              rows={5}
              defaultValue={reel?.caption || ''}
              placeholder="Instagram caption"
            />
          </div>

          <div>
            <Label htmlFor="hashtags">Hashtags</Label>
            <Input
              id="hashtags"
              name="hashtags"
              defaultValue={hashtagsValue(reel)}
              placeholder="#automation #agency #reels"
            />
          </div>

          <div>
            <Label htmlFor="duration_seconds">Duration</Label>
            <Input
              id="duration_seconds"
              name="duration_seconds"
              type="number"
              min={1}
              step={1}
              defaultValue={reel?.duration_seconds || ''}
              placeholder="30"
            />
          </div>

          <div>
            <Label htmlFor="creative_type">Creative Type</Label>
            <Select
              id="creative_type"
              name="creative_type"
              defaultValue={reel?.creative_type || ''}
            >
              <option value="">Select type</option>
              <option value="product_demo">Product demo</option>
              <option value="founder_talk">Founder talk</option>
              <option value="ugc_style">UGC style</option>
              <option value="testimonial">Testimonial</option>
              <option value="educational">Educational</option>
              <option value="behind_the_scenes">Behind the scenes</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="scheduled_for">Scheduled For</Label>
            <Input
              id="scheduled_for"
              name="scheduled_for"
              type="datetime-local"
              defaultValue={formatDatetimeLocal(reel?.scheduled_for)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Media Assets"
          description="Video, cover, subtitle, and sound references."
          action={<Film className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="video_url">Video URL or Uploaded Video Reference</Label>
            <Input
              id="video_url"
              name="video_url"
              defaultValue={reel?.video_url || ''}
              placeholder="https://cdn.example.com/reel.mp4"
            />
          </div>

          <div>
            <Label htmlFor="cover_url">Cover Image URL or Uploaded Cover Reference</Label>
            <Input
              id="cover_url"
              name="cover_url"
              defaultValue={reel?.cover_url || ''}
              placeholder="https://cdn.example.com/cover.jpg"
            />
          </div>

          <div>
            <Label htmlFor="subtitles">Optional Subtitle Text</Label>
            <Textarea
              id="subtitles"
              name="subtitles"
              rows={4}
              defaultValue={reel?.subtitles || ''}
              placeholder="Subtitle transcript or SRT reference"
            />
          </div>

          <div>
            <Label htmlFor="music_note">Optional Music / Sound Note</Label>
            <Textarea
              id="music_note"
              name="music_note"
              rows={4}
              defaultValue={reel?.music_note || ''}
              placeholder="Original audio, licensed track, or trend note"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Actions"
          description="Save, prepare, task, or preview the Reel draft."
          action={<Wand2 className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="submit"
            name="intent"
            value="save_draft"
            disabled={isPending}
          >
            <FileText className="h-4 w-4" />
            Save Draft
          </Button>
          <Button
            type="submit"
            name="intent"
            value="mark_ready"
            variant="success"
            disabled={isPending}
          >
            <Film className="h-4 w-4" />
            Mark Ready
          </Button>
          <Button
            type="submit"
            name="intent"
            value="ai_script"
            variant="outline"
            disabled={isPending}
          >
            <Wand2 className="h-4 w-4" />
            Create AI Script Task
          </Button>
          <Button
            type="submit"
            name="intent"
            value="ai_caption"
            variant="outline"
            disabled={isPending}
          >
            <Captions className="h-4 w-4" />
            Create AI Caption Task
          </Button>
          <Button
            type="submit"
            name="intent"
            value="open_preview"
            variant="soft"
            disabled={isPending}
          >
            <Film className="h-4 w-4" />
            Open Preview
          </Button>
        </div>
      </Card>
    </form>
  );
}
