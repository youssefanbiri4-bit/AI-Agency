'use client';

import { useState } from 'react';
import { FileText, Download, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/FormControls';
import { toast } from '@/components/ui/toast';
import { downloadClientReportPdfAction } from '@/actions/reports/actions';
import type { ClientReportTemplate } from '@/lib/reports/report-types';

interface ClientReportButtonProps {
  workspaceId: string;
  workspaceName: string;
  taskIds?: string[];
  label?: string;
  variant?: 'primary' | 'outline' | 'secondary';
  showTemplatePicker?: boolean;
  showPasswordField?: boolean;
  compact?: boolean;
}

function triggerPdfDownload(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ClientReportButton({
  workspaceId,
  workspaceName,
  taskIds,
  label = 'Download Client PDF',
  variant = 'primary',
  showTemplatePicker = true,
  showPasswordField = false,
  compact = false,
}: ClientReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [template, setTemplate] = useState<ClientReportTemplate>('full');
  const [password, setPassword] = useState('');

  const handleDownload = async () => {
    if (!workspaceId) {
      toast.error('Workspace required to generate report.');
      return;
    }

    setIsGenerating(true);

    try {
      const result = await downloadClientReportPdfAction({
        workspaceId,
        taskIds,
        template,
        password: password.trim() || undefined,
        period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      });

      if (!result.ok || !result.pdfBase64 || !result.filename) {
        throw new Error(result.error || 'PDF generation failed.');
      }

      triggerPdfDownload(result.pdfBase64, result.filename);

      toast.success('Client PDF downloaded', {
        description: `Professional report for ${workspaceName} with real workspace data.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate report';
      toast.error('Report generation failed', { description: message });
    } finally {
      setIsGenerating(false);
    }
  };

  if (compact) {
    return (
      <Button
        onClick={handleDownload}
        disabled={isGenerating || !workspaceId}
        variant={variant}
        className="gap-2"
        aria-label={label}
      >
        <FileText className="h-4 w-4" />
        {isGenerating ? 'Generating PDF...' : label}
        <Download className="h-4 w-4 opacity-60" />
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {showTemplatePicker && (
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-semibold text-black/50">Template</label>
          <Select
            value={template}
            onChange={(e) => setTemplate(e.target.value as ClientReportTemplate)}
            aria-label="Report template"
          >
            <option value="full">Full report</option>
            <option value="executive">Executive summary</option>
            <option value="performance">Performance focus</option>
          </Select>
        </div>
      )}

      {showPasswordField && (
        <div className="min-w-[180px]">
          <label className="mb-1 block text-xs font-semibold text-black/50">PDF password (optional)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="AES-256 if qpdf installed"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          />
        </div>
      )}

      <Button
        onClick={handleDownload}
        disabled={isGenerating || !workspaceId}
        variant={variant}
        className="gap-2"
        aria-label={label}
      >
        {isGenerating ? (
          'Generating PDF...'
        ) : (
          <>
            <FileText className="h-4 w-4" />
            {label}
            <Download className="h-4 w-4 opacity-60" />
          </>
        )}
      </Button>

      {showPasswordField && (
        <p className="flex items-center gap-1 text-[10px] text-black/45 sm:basis-full">
          <Lock className="h-3 w-3" />
          Password protection uses server-side encryption when qpdf is available.
        </p>
      )}
    </div>
  );
}

export default ClientReportButton;