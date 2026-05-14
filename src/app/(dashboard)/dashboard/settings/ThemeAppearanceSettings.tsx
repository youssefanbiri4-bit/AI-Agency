'use client';

import { Sparkles } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';

export function ThemeAppearanceSettings() {
  return (
    <Card>
      <CardHeader
        title="Theme"
        description="AgentFlow AI uses a fixed professional brand theme. No customization controls are needed."
      />
      <div className="flex items-start gap-4 rounded-2xl border border-[#F7CBCA]/14 bg-[#F1F7F7] p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F7CBCA] to-[#BFDADB] text-white shadow-sm">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-black text-black">Professional brand theme active</p>
          <p className="mt-1 text-sm leading-6 text-black/58">
            The dashboard uses a curated palette of soft pink, pale aqua, soft mint, warm gray,
            glass white, and deep slate for a clean, premium experience across all pages.
          </p>
        </div>
      </div>
    </Card>
  );
}
