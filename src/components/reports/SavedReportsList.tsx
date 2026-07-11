'use client';

import { useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Lock,
  Share2,
  Trash2,
} from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/FormControls';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/utils';
import {
  createReportShareLinkAction,
  getSavedReportDownloadUrlAction,
  revokeReportShareLinkAction,
  saveClientReport,
} from '@/actions/reports/actions';
import type { SavedReportWithShares } from '@/lib/reports/report-storage';
import type { ClientReportTemplate } from '@/lib/reports/report-types';

interface SavedReportsListProps {
  workspaceId: string;
  workspaceName: string;
  initialReports: SavedReportWithShares[];
  canManage?: boolean;
}

function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isShareLinkActive(link: SavedReportWithShares['share_links'][number]) {
  if (link.is_revoked) return false;
  if (Date.parse(link.expires_at) <= Date.now()) return false;
  if (typeof link.max_access_count === 'number' && link.access_count >= link.max_access_count) {
    return false;
  }
  return true;
}

export function SavedReportsList({
  workspaceId,
  workspaceName,
  initialReports,
  canManage = true,
}: SavedReportsListProps) {
  const [reports, setReports] = useState(initialReports);
  const [saving, setSaving] = useState(false);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [shareReportId, setShareReportId] = useState<string | null>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [shareExpiresDays, setShareExpiresDays] = useState('7');
  const [template, setTemplate] = useState<ClientReportTemplate>('full');

  const handleSaveNewReport = async () => {
    if (!workspaceId) {
      toast.error('Workspace required.');
      return;
    }

    setSaving(true);
    try {
      const result = await saveClientReport({
        workspaceId,
        template,
        period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        title: `Client Report — ${workspaceName}`,
      });

      if (!result.ok || !result.reportId) {
        throw new Error(result.error || 'Failed to save report.');
      }

      toast.success('Report saved', {
        description: `${result.filename} is now available in Saved Reports.`,
      });

      window.location.reload();
    } catch (error) {
      toast.error('Save failed', {
        description: error instanceof Error ? error.message : 'Could not save report.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (reportId: string) => {
    setBusyReportId(reportId);
    try {
      const result = await getSavedReportDownloadUrlAction(reportId, workspaceId);
      if (!result.ok || !result.signedUrl) {
        throw new Error(result.error || 'Download unavailable.');
      }

      const anchor = document.createElement('a');
      anchor.href = result.signedUrl;
      anchor.download = result.filename || 'client-report.pdf';
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.click();

      toast.success('Download started');
    } catch (error) {
      toast.error('Download failed', {
        description: error instanceof Error ? error.message : 'Could not download report.',
      });
    } finally {
      setBusyReportId(null);
    }
  };

  const handleCreateShareLink = async (reportId: string) => {
    setBusyReportId(reportId);
    try {
      const result = await createReportShareLinkAction({
        reportId,
        workspaceId,
        expiresInDays: Number(shareExpiresDays) || 7,
        password: sharePassword.trim() || undefined,
      });

      if (!result.ok || !result.shareUrl) {
        throw new Error(result.error || 'Failed to create share link.');
      }

      await navigator.clipboard.writeText(result.shareUrl);
      toast.success('Share link copied', {
        description: `Expires ${result.expiresAt ? formatDateTime(result.expiresAt) : 'soon'}.`,
      });
      setShareReportId(null);
      setSharePassword('');
      window.location.reload();
    } catch (error) {
      toast.error('Share failed', {
        description: error instanceof Error ? error.message : 'Could not create share link.',
      });
    } finally {
      setBusyReportId(null);
    }
  };

  const handleRevokeLink = async (linkId: string, reportId: string) => {
    setBusyReportId(reportId);
    try {
      const result = await revokeReportShareLinkAction(linkId, workspaceId);
      if (!result.ok) {
        throw new Error(result.error || 'Failed to revoke link.');
      }

      setReports((current) =>
        current.map((report) =>
          report.id === reportId
            ? {
                ...report,
                share_links: report.share_links.map((link) =>
                  link.id === linkId ? { ...link, is_revoked: true } : link
                ),
              }
            : report
        )
      );

      toast.success('Share link revoked');
    } catch (error) {
      toast.error('Revoke failed', {
        description: error instanceof Error ? error.message : 'Could not revoke link.',
      });
    } finally {
      setBusyReportId(null);
    }
  };

  const copyShareUrl = async (token: string) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/reports/share/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Share URL copied');
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F7CBCA]">
            Saved Reports
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-normal text-[#5D6B6B]">
            Persistent Client Reports
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/58">
            PDFs stored in Supabase with signed download URLs and optional password-protected share
            links.
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[150px]">
              <label className="mb-1 block text-xs font-semibold text-black/50">Template</label>
              <Select
                value={template}
                onChange={(e) => setTemplate(e.target.value as ClientReportTemplate)}
                aria-label="Save report template"
              >
                <option value="full">Full report</option>
                <option value="executive">Executive summary</option>
                <option value="performance">Performance focus</option>
              </Select>
            </div>
            <Button onClick={handleSaveNewReport} disabled={saving || !workspaceId} className="gap-2">
              <FileText className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save New Report'}
            </Button>
          </div>
        ) : null}
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No saved reports yet"
          description={
            canManage
              ? 'Generate and save a client PDF to keep a persistent copy with shareable links.'
              : 'Saved client reports will appear here when an editor saves one.'
          }
        />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const activeLinks = report.share_links.filter(isShareLinkActive);
            const isBusy = busyReportId === report.id;

            return (
              <article
                key={report.id}
                className="rounded-2xl border border-black/7 bg-white/90 p-5 shadow-[0_18px_45px_rgba(93,107,107,0.07)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-[#5D6B6B]">{report.title}</h3>
                    <p className="mt-1 text-sm text-black/55">{report.filename}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-black/50">
                      <span className="rounded-full border border-black/10 bg-background/70 px-3 py-1 capitalize">
                        {report.template}
                      </span>
                      <span className="rounded-full border border-black/10 bg-background/70 px-3 py-1">
                        {formatFileSize(report.file_size_bytes)}
                      </span>
                      <span className="rounded-full border border-black/10 bg-background/70 px-3 py-1">
                        Saved {formatDateTime(report.created_at)}
                      </span>
                      {report.period_label ? (
                        <span className="rounded-full border border-black/10 bg-background/70 px-3 py-1">
                          {report.period_label}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={isBusy}
                      onClick={() => handleDownload(report.id)}
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>

                    {canManage ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                        disabled={isBusy}
                        onClick={() =>
                          setShareReportId((current) => (current === report.id ? null : report.id))
                        }
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </Button>
                    ) : null}
                  </div>
                </div>

                {shareReportId === report.id && canManage ? (
                  <div className="mt-4 rounded-2xl border border-[#D5E5E5] bg-[#F1F7F7]/70 p-4">
                    <p className="text-sm font-bold text-[#5D6B6B]">Create signed share link</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-end">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-black/50">
                          Expires in
                        </label>
                        <Select
                          value={shareExpiresDays}
                          onChange={(e) => setShareExpiresDays(e.target.value)}
                          aria-label="Share link expiration"
                        >
                          <option value="1">1 day</option>
                          <option value="7">7 days</option>
                          <option value="14">14 days</option>
                          <option value="30">30 days</option>
                          <option value="90">90 days</option>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-black/50">
                          Link password (optional)
                        </label>
                        <Input
                          type="password"
                          value={sharePassword}
                          onChange={(e) => setSharePassword(e.target.value)}
                          placeholder="Required to open shared link"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="gap-2"
                        disabled={isBusy}
                        onClick={() => handleCreateShareLink(report.id)}
                      >
                        <Link2 className="h-4 w-4" />
                        Create & Copy
                      </Button>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-black/45">
                      <Lock className="h-3 w-3" />
                      Share links expire automatically and can be revoked anytime.
                    </p>
                  </div>
                ) : null}

                {activeLinks.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-black/42">
                      Active share links
                    </p>
                    {activeLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex flex-col gap-2 rounded-xl border border-black/7 bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 text-sm text-black/60">
                          <p>
                            Expires {formatDateTime(link.expires_at)}
                            {link.password_hash ? ' · Password protected' : ''}
                          </p>
                          <p className="font-mono text-xs text-black/45">
                            /reports/share/{link.token.slice(0, 8)}…
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={buttonStyles({ variant: 'ghost', size: 'sm' })}
                            onClick={() => copyShareUrl(link.token)}
                          >
                            <Copy className="h-4 w-4" />
                            Copy
                          </button>
                          <a
                            href={`/reports/share/${link.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonStyles({ variant: 'ghost', size: 'sm' })}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </a>
                          {canManage ? (
                            <button
                              type="button"
                              className={buttonStyles({ variant: 'ghost', size: 'sm' })}
                              disabled={isBusy}
                              onClick={() => handleRevokeLink(link.id, report.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Revoke
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default SavedReportsList;