'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageUp, RotateCcw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { toast } from '@/components/ui/toast';
import type { BrandKit } from '@/types/brand-kit';
import {
  resetBrandingSettingsAction,
  saveBrandingSettingsAction,
  type BrandingSettingsState,
} from './actions';

const LOGO_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const LOGO_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_ACCEPT_ATTRIBUTE = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';

interface LogoBrandingSettingsProps {
  initialState: BrandingSettingsState | null;
  brandKit: BrandKit | null;
}

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function LogoBrandingSettings({
  initialState,
  brandKit,
}: LogoBrandingSettingsProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<BrandingSettingsState>(
    initialState ?? {
      error: null,
      branding: {
        logo_url: null,
        logo_storage_path: null,
        logo_alt_text: 'AgentFlow AI',
        favicon_url: null,
        updated_at: null,
      },
      exists: false,
    }
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logoAltText, setLogoAltText] = useState(state.branding.logo_alt_text ?? 'AgentFlow AI');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const activeLogoUrl = previewUrl ?? state.branding.logo_url;
  const colorChips = useMemo(
    () =>
      [
        { label: 'Primary', value: brandKit?.primaryColor },
        { label: 'Secondary', value: brandKit?.secondaryColor },
        { label: 'Accent', value: brandKit?.accentColor },
      ].filter((chip): chip is { label: string; value: string } => Boolean(chip.value)),
    [brandKit]
  );

  const handleSelectLogo = (file: File | null) => {
    if (!file) return;

    if (!LOGO_ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Unsupported file type.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > LOGO_MAX_FILE_SIZE_BYTES) {
      toast.error('Logo file is too large.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    toast.success('Logo selected.');
  };

  const handleSaveBranding = async () => {
    if (!selectedFile) {
      toast.error('Could not update logo.', {
        description: 'Select a logo before saving.',
      });
      return;
    }

    setIsSaving(true);
    const loadingToastId = toast.loading('Uploading logo...');

    const formData = new FormData();
    formData.set('logoFile', selectedFile);
    formData.set('logoAltText', logoAltText);

    try {
      const result = await saveBrandingSettingsAction(state, formData);
      setState(result);
      setLogoAltText(result.branding.logo_alt_text ?? 'AgentFlow AI');

      if (result.error) {
        toast.update(loadingToastId, {
          tone: 'error',
          title: 'Could not update logo.',
          description: result.error,
        });
        return;
      }

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      toast.update(loadingToastId, {
        tone: 'success',
        title: 'Logo updated successfully.',
      });
      router.refresh();
    } catch (error) {
      toast.update(loadingToastId, {
        tone: 'error',
        title: 'Could not update logo.',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetBranding = async () => {
    setIsResetting(true);

    try {
      const result = await resetBrandingSettingsAction();
      setState(result);
      setLogoAltText(result.branding.logo_alt_text ?? 'AgentFlow AI');

      if (result.error) {
        toast.error('Could not update logo.', {
          description: result.error,
        });
        return;
      }

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      toast.success('Logo reset to default.');
      router.refresh();
    } catch (error) {
      toast.error('Could not update logo.', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Logo & Branding"
        description="Upload and manage the logo used across your AgentFlow AI workspace."
      />

      {state.error && (
        <Notice tone="warning" title="Branding settings">
          {state.error}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-[#F7CBCA]/10 bg-[#F1F7F7] p-4">
            <p className="text-sm font-black text-black">Current logo preview</p>
            <div className="mt-4 flex min-h-24 items-center justify-center rounded-lg border border-black/8 bg-white p-4">
              <BrandMark
                showTagline={false}
                customLogoUrl={activeLogoUrl}
                customLogoAlt={logoAltText || 'AgentFlow AI logo'}
                className="max-w-full"
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-black/52">
              Logos are displayed with a fixed height and preserved aspect ratio, so wide or tall
              files stay contained.
            </p>
          </div>

          {colorChips.length > 0 && (
            <div className="rounded-lg border border-black/8 bg-white p-4">
              <p className="text-sm font-black text-black">Brand Kit colors</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {colorChips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-2 rounded-lg border border-black/8 bg-[#F1F7F7] px-3 py-2 text-xs font-bold text-black/68"
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ backgroundColor: chip.value }}
                    />
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <Label htmlFor="workspaceLogo">Logo file</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                ref={fileInputRef}
                id="workspaceLogo"
                type="file"
                accept={LOGO_ACCEPT_ATTRIBUTE}
                onChange={(event) => handleSelectLogo(event.target.files?.[0] ?? null)}
                disabled={isSaving || isResetting}
                className="cursor-pointer"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving || isResetting}
              >
                <ImageUp className="h-4 w-4" />
                Upload Logo
              </Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-black/52">
              PNG, JPG, JPEG, or WEBP. Max {formatFileSize(LOGO_MAX_FILE_SIZE_BYTES)}.
            </p>
          </div>

          <div>
            <Label htmlFor="logoAltText">Logo alt text</Label>
            <Input
              id="logoAltText"
              value={logoAltText}
              onChange={(event) => setLogoAltText(event.target.value)}
              disabled={isSaving || isResetting}
              placeholder="AgentFlow AI logo"
              maxLength={120}
            />
          </div>

          {selectedFile && (
            <div className="rounded-lg border border-[#F7CBCA]/12 bg-[#D5E5E5]/45 p-4 text-sm leading-6 text-black/68">
              Selected: <span className="font-bold text-black">{selectedFile.name}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button onClick={handleSaveBranding} disabled={isSaving || isResetting || !selectedFile}>
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Branding'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleResetBranding}
              disabled={isSaving || isResetting}
            >
              <RotateCcw className="h-4 w-4" />
              {isResetting ? 'Resetting...' : 'Reset to Default Logo'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
