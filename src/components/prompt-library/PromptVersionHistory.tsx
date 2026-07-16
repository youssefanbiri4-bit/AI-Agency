'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, RotateCcw, Trash2, Download, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Label, Textarea } from '@/components/ui/FormControls';
import { toast } from '@/components/ui/toast';
import {
  getVersionHistory,
  createVersion,
  restoreVersion,
  deleteVersion,
  exportVersionHistory,
} from '@/lib/data/prompt-versioning';
import type { PromptVersion } from '@/lib/data/prompt-versioning';

interface PromptVersionHistoryProps {
  promptId: string;
  promptTitle: string;
  currentPromptText: string;
  currentTitle: string;
  currentCategory: string;
  currentTags: string[];
  userId: string;
  onRestore?: (version: PromptVersion) => void;
  className?: string;
}

export function PromptVersionHistory({
  promptId,
  promptTitle,
  currentPromptText,
  currentTitle,
  currentCategory,
  currentTags,
  userId,
  onRestore,
  className,
}: PromptVersionHistoryProps) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [changeNote, setChangeNote] = useState('');

  useEffect(() => {
    const loadVersions = () => {
      setVersions(getVersionHistory(promptId));
    };
    loadVersions();
  }, [promptId]);

  const handleCreateVersion = useCallback(() => {
    const version = createVersion({
      promptId,
      workspaceId: '',
      userId,
      title: currentTitle,
      description: null,
      promptText: currentPromptText,
      category: currentCategory,
      tags: currentTags,
      changeNote: changeNote || null,
    });

    setVersions(getVersionHistory(promptId));
    setShowCreateModal(false);
    setChangeNote('');
    toast.success('Version created', { description: `v${version.version} saved` });
  }, [promptId, userId, currentTitle, currentPromptText, currentCategory, currentTags, changeNote]);

  const handleRestore = useCallback((version: PromptVersion) => {
    const restored = restoreVersion(promptId, version.id);
    if (restored) {
      setVersions(getVersionHistory(promptId));
      onRestore?.(version);
      toast.success('Version restored', { description: `Restored from v${version.version}` });
    }
  }, [promptId, onRestore]);

  const handleDelete = useCallback((versionId: string) => {
    if (deleteVersion(promptId, versionId)) {
      setVersions(getVersionHistory(promptId));
      toast.success('Version deleted');
    }
  }, [promptId]);

  const handleExport = useCallback(() => {
    const json = exportVersionHistory(promptId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${promptTitle.replace(/\s+/g, '_')}_versions.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Version history exported');
  }, [promptId, promptTitle]);

  return (
    <Card className={className}>
      <CardHeader
        title="Version History"
        description={`${versions.length} version${versions.length !== 1 ? 's' : ''} saved`}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className={buttonStyles({ variant: 'ghost', size: 'sm' })}
              title="Export history"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
            >
              <Plus className="h-4 w-4" /> Save version
            </button>
          </div>
        }
      />

      {showCreateModal && (
        <div className="border-b border-divider p-4">
          <Label>Change note (optional)</Label>
          <Textarea
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="What changed in this version?"
            rows={2}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleCreateVersion}
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className={buttonStyles({ variant: 'ghost', size: 'sm' })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="p-6 text-center text-sm text-foreground-muted">
            <History className="mx-auto mb-2 h-8 w-8 opacity-30" />
            No versions saved yet. Create a version to track changes.
          </div>
        ) : (
          <div className="divide-y divide-divider">
            {versions.map((version) => (
              <div key={version.id} className="p-4">
                <div
                  className="flex cursor-pointer items-center gap-3"
                  onClick={() => setExpandedId(expandedId === version.id ? null : version.id)}
                >
                  <Badge tone="info">v{version.version}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{version.title}</p>
                    <p className="text-xs text-foreground-muted">
                      {new Date(version.createdAt).toLocaleDateString()}
                      {version.changeNote && ` · ${version.changeNote}`}
                    </p>
                  </div>
                  {expandedId === version.id ? (
                    <ChevronUp className="h-4 w-4 text-foreground-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-foreground-muted" />
                  )}
                </div>

                {expandedId === version.id && (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg bg-surface p-3">
                      <p className="text-xs font-bold text-foreground-muted">Prompt Text</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground line-clamp-4">
                        {version.promptText}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {version.tags.map((tag) => (
                        <Badge key={tag} tone="neutral">{tag}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestore(version)}
                        className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(version.id)}
                        className={buttonStyles({ variant: 'ghost', size: 'sm' })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-danger" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
