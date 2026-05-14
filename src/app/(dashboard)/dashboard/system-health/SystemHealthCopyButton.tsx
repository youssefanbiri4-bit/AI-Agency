'use client';

import { useState } from 'react';
import { Clipboard, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

export function SystemHealthCopyButton({ reportText }: { reportText: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setFailed(false);
      toast.success('تم نسخ تقرير صحة النظام.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setFailed(true);
      setCopied(false);
      toast.error('تعذر نسخ التقرير.');
      window.setTimeout(() => setFailed(false), 2200);
    }
  }

  return (
    <Button type="button" onClick={copyReport} variant="primary" size="sm">
      {copied ? <Check className="h-4 w-4" /> : failed ? <AlertTriangle className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
      {copied ? 'تم نسخ التقرير' : failed ? 'تعذر النسخ' : 'نسخة من صحة النظام'}
    </Button>
  );
}
