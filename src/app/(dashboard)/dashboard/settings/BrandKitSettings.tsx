'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Palette, RefreshCcw, Save, Sparkles, Target, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import { useActionToast } from '@/components/ui/useActionToast';
import { defaultBrandKit, type BrandKit } from '@/types/brand-kit';
import {
  saveBrandKitSettingsAction,
  type BrandKitSettingsState,
} from './actions';

interface BrandKitSettingsProps {
  initialState: BrandKitSettingsState | null;
}

const fallbackState: BrandKitSettingsState = {
  error: null,
  brandKit: defaultBrandKit,
  exists: false,
};

function joinValues(values: string[]) {
  return values.join(', ');
}

function fieldValue(value: string | null | undefined) {
  return value ?? '';
}

function BrandTextField({
  id,
  label,
  value,
  placeholder,
  required,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string | null | undefined;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        required={required}
        defaultValue={fieldValue(value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function BrandTextarea({
  id,
  label,
  value,
  placeholder,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string | null | undefined;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={id}
        rows={rows}
        defaultValue={fieldValue(value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function ColorInput({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string | null | undefined;
}) {
  const normalized = value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#F7CBCA';

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          aria-label={`${label} swatch`}
          type="color"
          defaultValue={normalized}
          className="h-[42px] w-12 shrink-0 rounded-lg border border-black/10 bg-white p-1"
          onChange={(event) => {
            const textInput = event.currentTarget.nextElementSibling;
            if (textInput instanceof HTMLInputElement) {
              textInput.value = event.currentTarget.value;
            }
          }}
        />
        <Input id={id} name={id} defaultValue={fieldValue(value)} placeholder="#F7CBCA" />
      </div>
    </div>
  );
}

export function BrandKitSettings({ initialState }: BrandKitSettingsProps) {
  const [formKey, setFormKey] = useState(0);
  const [useSample, setUseSample] = useState(false);
  const [activeState, formAction, isPending] = useActionState(
    saveBrandKitSettingsAction,
    initialState ?? fallbackState
  );
  const displayState = activeState.brandKit ? activeState : initialState ?? fallbackState;
  const brandKit = displayState.brandKit;
  const status = displayState.exists ? 'Ready' : 'Setup Required';
  const hasLoaded = Boolean(initialState);

  const summary = useMemo(
    () =>
      [
        brandKit.brandName,
        brandKit.toneOfVoice,
        brandKit.defaultCta ? `CTA: ${brandKit.defaultCta}` : null,
        brandKit.defaultHashtags ? 'Hashtags ready' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    [brandKit]
  );

  useEffect(() => {
    if (hasLoaded) {
      toast.success('Brand Kit loaded.');
    }
  }, [hasLoaded]);

  useActionToast({
    isPending,
    state: activeState,
    loadingMessage: 'Saving Brand Kit...',
    successMessage: (state) => state.message ?? 'Brand Kit saved.',
    errorMessage: (state) => state.error ?? 'Could not save Brand Kit.',
  });

  const loadSampleBrand = () => {
    setUseSample(true);
    setFormKey((current) => current + 1);
    toast.info('Sample Brand Kit loaded.', {
      description: 'Review the fields, then save when you are ready.',
    });
  };

  const resetForm = () => {
    setUseSample(false);
    setFormKey((current) => current + 1);
    toast.info('Brand Kit changes reset.');
  };

  const sampleOrSavedKit: BrandKit = useSample ? defaultBrandKit : brandKit;

  return (
    <Card id="brand-kit" className="border-[#F7CBCA]/14 bg-white/88">
      <CardHeader
        title="Brand Kit"
        description="Define the agency brand once, then reuse it across Content Studio, Creative Assets, campaign drafts, and AI generation."
        action={<StatusBadge status={status} type="system" size="sm" />}
      />

      {displayState.error ? (
        <Notice tone="warning" title="Brand Kit notice">
          {displayState.error}
        </Notice>
      ) : null}

      <div className="mb-5 rounded-2xl border border-[#F7CBCA]/14 bg-[#F1F7F7] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-black">Current brand context</p>
            <p className="mt-1 text-sm leading-6 text-black/58">
              {summary || 'No saved Brand Kit yet. Use the sample or add your own brand details.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={loadSampleBrand}>
              <Sparkles className="h-4 w-4" />
              Use Sample Brand
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm}>
              <RefreshCcw className="h-4 w-4" />
              Reset Changes
            </Button>
          </div>
        </div>
      </div>

      <form key={formKey} action={formAction} className="space-y-6">
        <Card className="shadow-none">
          <CardHeader
            title="Brand Basics"
            description="The core agency identity used by content and campaign generation."
            action={<BadgeCheck className="h-5 w-5 text-[#F7CBCA]" />}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <BrandTextField id="brandName" label="Brand name" value={sampleOrSavedKit.brandName} required />
            <BrandTextField id="websiteUrl" label="Website URL" value={sampleOrSavedKit.websiteUrl} type="url" />
            <div className="md:col-span-2">
              <BrandTextarea id="description" label="Short description" value={sampleOrSavedKit.description} />
            </div>
            <BrandTextarea id="offer" label="Main offer / value proposition" value={sampleOrSavedKit.offer} />
            <BrandTextarea id="services" label="Services" value={sampleOrSavedKit.services} />
            <BrandTextField id="industry" label="Industry / niche" value={sampleOrSavedKit.industry} />
            <BrandTextField id="targetMarket" label="Target market" value={sampleOrSavedKit.targetMarket} />
          </div>
        </Card>

        <Card className="shadow-none">
          <CardHeader
            title="Audience"
            description="Customer context for platform-specific messaging."
            action={<Target className="h-5 w-5 text-[#F7CBCA]" />}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <BrandTextarea id="targetAudience" label="Target audience" value={sampleOrSavedKit.targetAudience} />
            <BrandTextarea id="painPoints" label="Customer pain points" value={sampleOrSavedKit.painPoints} />
            <BrandTextarea id="audienceGoals" label="Customer goals" value={sampleOrSavedKit.audienceGoals} />
            <BrandTextField id="audienceLanguage" label="Audience language" value={sampleOrSavedKit.audienceLanguage} />
            <BrandTextField id="market" label="Audience location / market" value={sampleOrSavedKit.market} />
          </div>
        </Card>

        <Card className="shadow-none">
          <CardHeader
            title="Voice & Messaging"
            description="Reusable writing guidance for captions, hooks, ads, scripts, and planner copy."
            action={<Wand2 className="h-5 w-5 text-[#F7CBCA]" />}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <BrandTextField id="toneOfVoice" label="Tone of voice" value={sampleOrSavedKit.toneOfVoice} />
            <BrandTextField id="writingStyle" label="Writing style" value={sampleOrSavedKit.writingStyle} />
            <BrandTextarea id="brandPersonality" label="Brand personality" value={sampleOrSavedKit.brandPersonality} />
            <BrandTextarea id="wordsToUse" label="Words to use" value={sampleOrSavedKit.wordsToUse} />
            <BrandTextarea id="wordsToAvoid" label="Words to avoid" value={sampleOrSavedKit.wordsToAvoid} />
            <BrandTextField id="defaultCta" label="Default CTA" value={sampleOrSavedKit.defaultCta} />
            <div className="md:col-span-2">
              <BrandTextarea id="defaultHashtags" label="Main hashtags" value={sampleOrSavedKit.defaultHashtags} />
            </div>
          </div>
        </Card>

        <Card className="shadow-none">
          <CardHeader
            title="Visual Identity"
            description="Creative Assets can use these colors and style notes when building prompts."
            action={<Palette className="h-5 w-5 text-[#F7CBCA]" />}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <ColorInput id="primaryColor" label="Primary color" value={sampleOrSavedKit.primaryColor} />
            <ColorInput id="secondaryColor" label="Secondary color" value={sampleOrSavedKit.secondaryColor} />
            <ColorInput id="accentColor" label="Accent color" value={sampleOrSavedKit.accentColor} />
            <ColorInput id="backgroundColor" label="Background color" value={sampleOrSavedKit.backgroundColor} />
            <BrandTextField id="logoUrl" label="Logo URL" value={sampleOrSavedKit.logoUrl} type="url" />
            <BrandTextField id="logoAssetId" label="Logo creative asset ID" value={sampleOrSavedKit.logoAssetId} />
            <BrandTextField id="visualStyle" label="Preferred visual style" value={sampleOrSavedKit.visualStyle} />
            <BrandTextarea id="imageStyleNotes" label="Image style notes" value={sampleOrSavedKit.imageStyleNotes} />
            <div className="md:col-span-2">
              <BrandTextarea
                id="designInspirationNotes"
                label="Design inspiration notes"
                value={sampleOrSavedKit.designInspirationNotes}
              />
            </div>
          </div>
        </Card>

        <Card className="shadow-none">
          <CardHeader
            title="Campaign Defaults"
            description="Used to prefill empty campaign and content fields without overwriting your edits."
          />
          <div className="grid gap-5 md:grid-cols-2">
            <BrandTextField
              id="defaultObjective"
              label="Default campaign objective"
              value={sampleOrSavedKit.campaignDefaults.defaultObjective}
            />
            <BrandTextField
              id="defaultDestinationUrl"
              label="Default destination URL"
              value={sampleOrSavedKit.campaignDefaults.defaultDestinationUrl}
              type="url"
            />
            <BrandTextField
              id="defaultPlatforms"
              label="Default platforms"
              value={joinValues(sampleOrSavedKit.campaignDefaults.defaultPlatforms)}
            />
            <BrandTextField
              id="defaultPostingStyle"
              label="Default posting style"
              value={sampleOrSavedKit.campaignDefaults.defaultPostingStyle}
            />
            <BrandTextarea
              id="defaultCreativeDirection"
              label="Default creative direction"
              value={sampleOrSavedKit.campaignDefaults.defaultCreativeDirection}
            />
            <BrandTextarea
              id="defaultOffer"
              label="Default offer"
              value={sampleOrSavedKit.campaignDefaults.defaultOffer}
            />
            <div className="md:col-span-2">
              <BrandTextarea
                id="defaultDisclaimer"
                label="Default disclaimer / notes"
                value={sampleOrSavedKit.campaignDefaults.defaultDisclaimer}
              />
            </div>
          </div>
        </Card>

        <Card className="shadow-none">
          <CardHeader
            title="AI Preferences"
            description="Guidance for generation length, language, CTA style, and hashtag density."
          />
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="providerMode">Preferred AI provider mode</Label>
              <Select id="providerMode" name="providerMode" defaultValue={sampleOrSavedKit.aiPreferences.providerMode}>
                <option value="auto">Auto</option>
                <option value="openai">OpenAI</option>
                <option value="nvidia">NVIDIA</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="defaultLanguage">Default language</Label>
              <Select id="defaultLanguage" name="defaultLanguage" defaultValue={sampleOrSavedKit.aiPreferences.defaultLanguage}>
                <option value="english">English</option>
                <option value="arabic">Arabic</option>
                <option value="french">French</option>
                <option value="mixed">Mixed</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="contentLength">Default content length</Label>
              <Select id="contentLength" name="contentLength" defaultValue={sampleOrSavedKit.aiPreferences.contentLength}>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="detailed">Detailed</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="emojiUsage">Default emoji usage</Label>
              <Select id="emojiUsage" name="emojiUsage" defaultValue={sampleOrSavedKit.aiPreferences.emojiUsage}>
                <option value="none">None</option>
                <option value="minimal">Minimal</option>
                <option value="normal">Normal</option>
              </Select>
            </div>
            <BrandTextField
              id="hashtagCount"
              label="Default hashtag count"
              value={String(sampleOrSavedKit.aiPreferences.hashtagCount ?? '')}
              type="number"
            />
            <BrandTextField
              id="ctaStyle"
              label="Default CTA style"
              value={sampleOrSavedKit.aiPreferences.ctaStyle}
            />
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isPending} size="lg">
            <Save className="h-5 w-5" />
            {isPending ? 'Saving Brand Kit...' : 'Save Brand Kit'}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={resetForm}>
            <RefreshCcw className="h-5 w-5" />
            Reset Changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
