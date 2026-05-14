'use client';

import { Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

export function GitHubReleaseNotesButton({ draft }: { draft: string }) {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(draft);
        toast.success('GitHub release notes draft copied.');
      }}
    >
      <Clipboard className="h-4 w-4" />
      Copy GitHub Release Notes Draft
    </Button>
  );
}
