'use client';

import { useState, useActionState } from 'react';
import { Palette, Eye, EyeOff, Upload, RotateCcw } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { saveWhiteLabelAction } from '@/app/(dashboard)/dashboard/settings/actions/white-label';
import type { WorkspaceBrandingSettingsState } from '@/app/(dashboard)/dashboard/settings/actions/_shared';
import type { WhiteLabelConfig, WhiteLabelColors } from '@/types/white-label';
import { defaultWhiteLabelConfig } from '@/types/white-label';

const COLOR_FIELDS: Array<{ key: keyof WhiteLabelColors; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'text', label: 'Text' },
  { key: 'sidebar', label: 'Sidebar' },
  { key: 'header', label: 'Header' },
];

function ColorInput({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="relative cursor-pointer">
        <input
          type="color"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-0 w-0 opacity-0"
        />
        <span
          className="block h-8 w-8 rounded-lg border border-border shadow-sm transition-transform hover:scale-110"
          style={{ backgroundColor: value }}
        />
      </label>
      <div className="flex-1">
        <label className="text-xs font-bold text-foreground-muted">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 h-8 w-full rounded border border-border bg-white px-2 font-mono text-xs focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
        />
      </div>
    </div>
  );
}

export function WhiteLabelSettings({
  initialData,
}: {
  initialData: WorkspaceBrandingSettingsState;
}) {
  const [state, formAction, isPending] = useActionState(saveWhiteLabelAction, initialData);
  const [config, setConfig] = useState<WhiteLabelConfig>(
    state.settings?.whiteLabel ?? initialData.settings?.whiteLabel ?? defaultWhiteLabelConfig
  );
  const [showPreview, setShowPreview] = useState(false);

  function updateColor(key: keyof WhiteLabelColors, value: string) {
    setConfig((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
  }

  return (
    <Card>
      <CardHeader
        title="White Label"
        description="Customize the platform with your own branding. Replace AgentFlow AI branding with your company identity."
        action={
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? 'Hide Preview' : 'Preview'}
          </button>
        }
      />

      {showPreview && (
        <div className="mx-6 mb-4 rounded-lg border border-border p-4" style={{
          backgroundColor: config.colors.background,
          color: config.colors.text,
        }}>
          <div className="flex items-center gap-3 mb-3" style={{ backgroundColor: config.colors.header, padding: '8px 12px', borderRadius: '8px' }}>
            <div className="h-8 w-8 rounded" style={{ backgroundColor: config.colors.primary }} />
            <span className="font-bold" style={{ color: config.colors.text }}>
              {config.companyName || 'Your Company'}
            </span>
          </div>
          <div className="flex gap-3">
            <div className="w-32 rounded p-2 text-xs" style={{ backgroundColor: config.colors.sidebar }}>
              <p style={{ color: config.colors.text }}>Sidebar</p>
            </div>
            <div className="flex-1 rounded p-3 text-xs" style={{ backgroundColor: config.colors.background, border: `1px solid ${config.colors.accent}` }}>
              <p style={{ color: config.colors.text }}>Content area preview</p>
            </div>
          </div>
        </div>
      )}

      <form action={formAction} className="space-y-6 p-6 pt-0">
        {state.message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {state.message}
          </div>
        )}
        {state.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <input type="hidden" name="enabled" value="off" />
          <label className="relative inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="enabled"
              checked={config.enabled}
              onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white" />
          </label>
          <span className="text-sm font-bold">Enable White Label</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-foreground-muted">Company Name</label>
            <input
              type="text"
              name="companyName"
              value={config.companyName ?? ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, companyName: e.target.value || null }))}
              placeholder="Your Company Name"
              className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-foreground-muted">Tagline</label>
            <input
              type="text"
              name="tagline"
              value={config.tagline ?? ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, tagline: e.target.value || null }))}
              placeholder="Your Platform Tagline"
              className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input type="hidden" name="hideAgentFlowBranding" value="off" />
          <label className="relative inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="hideAgentFlowBranding"
              checked={config.hideAgentFlowBranding}
              onChange={(e) => setConfig((prev) => ({ ...prev, hideAgentFlowBranding: e.target.checked }))}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white" />
          </label>
          <span className="text-sm font-bold">Hide AgentFlow AI Branding</span>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Brand Colors
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COLOR_FIELDS.map((field) => (
              <ColorInput
                key={field.key}
                name={`color${String(field.key).charAt(0).toUpperCase() + String(field.key).slice(1)}`}
                label={field.label}
                value={config.colors[field.key] as string}
                onChange={(v) => updateColor(field.key, v)}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-foreground-muted">Logo URL</label>
          <input
            type="url"
            name="logoUrl"
            value={config.logoUrl ?? ''}
            onChange={(e) => setConfig((prev) => ({ ...prev, logoUrl: e.target.value || null }))}
            placeholder="https://your-cdn.com/logo.png"
            className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
          />
          <p className="mt-1 text-xs text-foreground-muted">URL to your company logo (PNG, SVG, or WebP)</p>
        </div>

        <div>
          <label className="text-xs font-bold text-foreground-muted">Logo Alt Text</label>
          <input
            type="text"
            name="logoAltText"
            value={config.logoAltText ?? ''}
            onChange={(e) => setConfig((prev) => ({ ...prev, logoAltText: e.target.value || null }))}
            placeholder="Your Company Logo"
            className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-foreground-muted">Favicon URL</label>
          <input
            type="url"
            name="faviconUrl"
            value={config.faviconUrl ?? ''}
            onChange={(e) => setConfig((prev) => ({ ...prev, faviconUrl: e.target.value || null }))}
            placeholder="https://your-cdn.com/favicon.ico"
            className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-foreground-muted">Custom CSS (Advanced)</label>
          <textarea
            name="customCss"
            value={config.customCss ?? ''}
            onChange={(e) => setConfig((prev) => ({ ...prev, customCss: e.target.value || null }))}
            placeholder=".sidebar { background: #f00; }"
            rows={4}
            className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-xs focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
          />
          <p className="mt-1 text-xs text-foreground-muted">Custom CSS overrides for advanced branding. Be careful with selectors.</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save White Label Settings'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
