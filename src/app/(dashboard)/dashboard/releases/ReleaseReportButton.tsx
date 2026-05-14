'use client';

import { Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

export function ReleaseReportButton({ report }: { report: string }) {
  return (
    <Button
      onClick={async () => {
        await navigator.clipboard.writeText(report);
        toast.success('Release report copied.');
      }}
    >
      <Clipboard className="h-4 w-4" />
      Copy Release Report
    </Button>
  );
}
