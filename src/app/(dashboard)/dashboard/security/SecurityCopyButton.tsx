'use client';

import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

export function SecurityCopyButton({ report }: { report: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      toast.success('Security report copied.');
    } catch {
      toast.error('Could not copy security report.');
    }
  };

  return (
    <Button type="button" onClick={handleCopy}>
      <ClipboardCheck className="h-4 w-4" />
      Copy Security Report
    </Button>
  );
}
