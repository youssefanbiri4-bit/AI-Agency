'use client';

import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

interface CreativeAssetQuickActionsProps {
  prompt: string | null;
  imageUrl: string | null;
}

export function CreativeAssetQuickActions({
  prompt,
  imageUrl,
}: CreativeAssetQuickActionsProps) {
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    if (!prompt) {
      toast.warning('No prompt is available yet.');
      return;
    }

    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success('Prompt copied.');
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Button type="button" variant="outline" onClick={copyPrompt} disabled={!prompt}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Prompt Copied' : 'Copy Prompt'}
      </Button>
      {imageUrl && (
        <a href={imageUrl} download className={buttonStyles({ variant: 'soft' })}>
          <Download className="h-4 w-4" />
          Download Image
        </a>
      )}
    </div>
  );
}
