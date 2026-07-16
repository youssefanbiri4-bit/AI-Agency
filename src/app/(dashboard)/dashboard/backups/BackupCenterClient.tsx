'use client';

import { useActionState, useMemo, useState } from 'react';
import {
  Clipboard,
  DatabaseBackup,
  Download,
  FileJson,
  FileText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { createBackupAction, type BackupCenterState } from './actions';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { useActionToast } from '@/hooks/useActionToast';
import { toast } from '@/components/ui/toast';
import type { BackupCategory } from '@/lib/backup-center';
import type { BackupRecord } from '@/lib/data/backup-records';

interface BackupCenterClientProps {
  categories: Array<{ value: BackupCategory; label: string }>;
  history: BackupRecord[];
}

const initialState: BackupCenterState = {
  error: null,
  message: null,
  backup: null,
  record: null,
};

function downloadText(fileName: string, value: string, type: string) {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}.`);
  }
}

export function BackupCenterClient({ categories, history }: BackupCenterClientProps) {
  const [selectedCategories, setSelectedCategories] = useState<BackupCategory[]>(
    categories.map((category) => category.value)
  );
  const [state, formAction, isCreating] = useActionState(createBackupAction, initialState);
  const backup = state.backup;
  const backupJson = useMemo(() => (backup ? JSON.stringify(backup, null, 2) : ''), [backup]);
  const latestHistoryMarkdown =
    typeof history[0]?.metadata?.markdown_summary === 'string'
      ? history[0].metadata.markdown_summary
      : '';

  useActionToast({
    isPending: isCreating,
    state,
    loadingMessage: 'Creating safe workspace backup...',
    successMessage: (currentState) => currentState.message ?? 'Backup generated.',
    errorMessage: (currentState) => currentState.error ?? 'Could not create backup.',
  });

  function toggleCategory(value: BackupCategory) {
    setSelectedCategories((current) => {
      if (current.includes(value)) {
        const next = current.filter((category) => category !== value);
        return next.length ? next : current;
      }
      return [...current, value];
    });
  }

  function selectAll() {
    setSelectedCategories(categories.map((category) => category.value));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.82fr)_minmax(0,1.18fr)]">
      <form action={formAction} className="space-y-6">
        <Card>
          <CardHeader
            title="Backup Scope Selector"
            description="Select the safe workspace data categories to include."
            action={<DatabaseBackup className="h-5 w-5 text-[#F7CBCA]" />}
          />
          <div className="space-y-3">
            <button
              type="button"
              onClick={selectAll}
              className="w-full rounded-lg border border-[#F7CBCA]/16 bg-[#D5E5E5]/45 px-4 py-3 text-left text-sm font-black text-[#F7CBCA]"
            >
              All safe workspace data
            </button>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {categories.map((category) => (
                <label
                  key={category.value}
                  className="flex items-start gap-3 rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-3 text-sm font-semibold leading-6 text-black/64"
                >
                  <input
                    type="checkbox"
                    name="categories"
                    value={category.value}
                    checked={selectedCategories.includes(category.value)}
                    onChange={() => toggleCategory(category.value)}
                    className="mt-1 h-4 w-4 rounded border-black/20 accent-[#F7CBCA]"
                  />
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
          </div>

          {state.error ? (
            <Notice tone="warning" title="Backup notice">
              {state.error}
            </Notice>
          ) : null}

          <Button type="submit" disabled={isCreating} className="mt-5 w-full">
            <Sparkles className="h-4 w-4" />
            {isCreating ? 'Creating Backup...' : 'Create Backup'}
          </Button>
        </Card>
      </form>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Backup Preview"
            description="Generated backups can be downloaded now. Only metadata/history is persisted."
            action={
              backup ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadText(backup.summary.file_name, backupJson, 'application/json')}
                  >
                    <FileJson className="h-4 w-4" />
                    Download JSON
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadText(backup.summary.file_name.replace(/\.json$/, '.md'), backup.summary.markdown, 'text/markdown')}
                  >
                    <FileText className="h-4 w-4" />
                    Download Markdown
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyText('Backup summary', backup.summary.markdown)}
                  >
                    <Clipboard className="h-4 w-4" />
                    Copy Backup Summary
                  </Button>
                </div>
              ) : latestHistoryMarkdown ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText('Latest backup summary', latestHistoryMarkdown)}
                >
                  <Clipboard className="h-4 w-4" />
                  Copy Backup Summary
                </Button>
              ) : null
            }
          />

          {!backup ? (
            <div className="rounded-lg border border-dashed border-black/12 bg-[#F1F7F7]/70 p-6 text-sm leading-6 text-black/58">
              <ShieldCheck className="mb-3 h-5 w-5 text-[#F7CBCA]" />
              No preview yet. Create a backup to see record counts, excluded sensitive fields,
              warnings, and download actions.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <PreviewMetric label="Backup date" value={new Date(backup.created_at).toLocaleString()} />
                <PreviewMetric label="Workspace" value={`${backup.workspace.name} (${backup.workspace.id.slice(0, 8)}...)`} />
                <PreviewMetric label="Total records" value={backup.summary.total_records} />
                <PreviewMetric label="Size estimate" value={`${Math.max(1, Math.round(backup.summary.size_estimate_bytes / 1024))} KB`} />
              </div>

              <section>
                <h3 className="mb-3 font-black text-[#5D6B6B]">Record Counts by Category</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(backup.summary.record_counts).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-black/7 bg-[#F1F7F7]/70 px-3 py-2 text-sm">
                      <span className="font-bold capitalize text-black/66">{key.replace(/_/g, ' ')}</span>
                      <span className="font-mono font-black text-[#F7CBCA]">{value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 font-black text-[#5D6B6B]">Excluded Sensitive Fields</h3>
                <div className="flex flex-wrap gap-2">
                  {(backup.summary.excluded_sensitive_fields.length ? backup.summary.excluded_sensitive_fields : ['No secret-like fields detected']).map((field) => (
                    <span key={field} className="rounded-full border border-[#F7CBCA]/16 bg-[#D5E5E5]/55 px-3 py-1 text-xs font-black text-[#F7CBCA]">
                      {field}
                    </span>
                  ))}
                </div>
              </section>

              <Notice tone="info" title="Security confirmation">
                Secrets excluded: yes. Tokens excluded: yes. Raw env values excluded: yes.
                Binary files included: no.
              </Notice>

              <section>
                <h3 className="mb-3 font-black text-[#5D6B6B]">Warnings</h3>
                <ul className="space-y-2">
                  {backup.summary.warnings.map((warning) => (
                    <li key={warning} className="rounded-lg border border-black/7 bg-white px-3 py-2 text-sm leading-6 text-black/62">
                      {warning}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-lg border border-black/7 bg-[#5D6B6B] p-4">
                <div className="mb-3 flex items-center gap-2 text-[#D5E5E5]">
                  <Download className="h-4 w-4" />
                  <h3 className="font-black">Markdown Summary</h3>
                </div>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-6 text-[#F1F7F7]">
                  {backup.summary.markdown}
                </pre>
              </section>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/7 bg-white p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-black/42">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-[#5D6B6B]">{value}</p>
    </div>
  );
}
