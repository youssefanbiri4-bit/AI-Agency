'use client';

import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function ExportReportButton() {
  const handleExport = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.print();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      aria-label="Export client-ready report as PDF"
    >
      <FileDown className="h-4 w-4" />
      Export PDF
    </Button>
  );
}
