'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { BookOpen, Copy, Download, Layers3, Trash2 } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usePagination } from '@/hooks/usePagination';
import { useRowSelection } from '@/hooks/useRowSelection';
import { BulkActionBar, type BulkActionConfig } from '@/components/ui/BulkActionBar';
import { toast } from '@/components/ui/toast';
import { cn, formatDateTime } from '@/lib/utils';
import {
  formatContentStudioPlatformLabel,
  formatContentStudioTypeLabel,
  getTabForContentType,
} from '../content-studio/shared';
import type { ContentStudioItemView } from '../content-studio/shared';
import {
  bulkDeleteContentItems,
  bulkDuplicateContentItems,
  bulkExportContentItems,
} from './actions';

function buildStudioHref(item: ContentStudioItemView) {
  const tab = getTabForContentType(item.content_type);
  const params = new URLSearchParams({ item: item.id });
  if (tab !== 'all') params.set('tab', tab);
  return `/dashboard/content-studio?${params.toString()}`;
}

function actionTypeLabel(item: ContentStudioItemView) {
  if (item.status === 'setup_required') return 'Setup Required';
  if (item.status === 'approval_pending') return 'Approval Pending';
  if (item.content_type === 'linkedin_post_planner') return 'Manual-only / Copy LinkedIn Package';
  if (item.content_type === 'google_ads_campaign_draft') return 'Create Paused Google Ads Campaign Draft';
  if (item.content_type === 'pinterest_pin') return 'Publish to Pinterest';
  if (item.content_type === 'facebook_post') return 'Publish to Facebook Page';
  if (item.content_type === 'instagram_post') return 'Publish to Instagram';
  if (item.content_type === 'instagram_reel') return 'Publish Reel to Instagram';
  if (item.content_type.includes('_ad')) return 'Create Paused Meta Ad Draft';
  return 'Unsupported';
}

interface PaginatedContentLibraryTableProps {
  items: ContentStudioItemView[];
}

export function PaginatedContentLibraryTable({ items }: PaginatedContentLibraryTableProps) {
  const {
    pageItems,
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    nextPage,
    prevPage,
    goToPage,
  } = usePagination(items, 50);

  const pageItemIds = useMemo(() => pageItems.map((item) => item.id), [pageItems]);
  const { selectedIds, toggle, toggleRange, selectAll, clear, isAllSelected, isSomeSelected } =
    useRowSelection();
  const lastIndexRef = useRef<number | null>(null);

  const handleToggleRow = useCallback(
    (id: string, index: number, shiftKey: boolean) => {
      if (shiftKey && lastIndexRef.current !== null) {
        toggleRange(pageItemIds, lastIndexRef.current, index, id);
      } else {
        toggle(id);
      }
      lastIndexRef.current = index;
    },
    [pageItemIds, toggle, toggleRange],
  );

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      if (checked) selectAll(pageItemIds);
      else clear();
    },
    [pageItemIds, selectAll, clear],
  );

  const allChecked = isAllSelected(pageItemIds);
  const someChecked = isSomeSelected(pageItemIds);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [duplicatePending, setDuplicatePending] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportPending, setExportPending] = useState(false);

  const handleBulkDelete = useCallback(
    async () => {
      setDeleteConfirmOpen(false);
      setDeletePending(true);
      try {
        const result = await bulkDeleteContentItems(Array.from(selectedIds));
        if (result.ok) {
          toast.success(`Deleted ${result.updated} content item(s).`);
          clear();
        } else if (result.updated > 0) {
          toast.warning(`Deleted ${result.updated} item(s); ${result.failed} failed.`);
          clear();
        } else {
          toast.error(result.message || 'Failed to delete content items.');
        }
      } catch {
        toast.error('Failed to delete content items.');
      } finally {
        setDeletePending(false);
      }
    },
    [selectedIds, clear],
  );

  const handleBulkDuplicate = useCallback(
    async () => {
      setDuplicatePending(true);
      try {
        const result = await bulkDuplicateContentItems(Array.from(selectedIds));
        if (result.ok) {
          toast.success(`Duplicated ${result.updated} content item(s).`);
          clear();
        } else if (result.updated > 0) {
          toast.warning(`Duplicated ${result.updated} item(s); ${result.failed} failed.`);
          clear();
        } else {
          toast.error(result.message || 'Failed to duplicate content items.');
        }
      } catch {
        toast.error('Failed to duplicate content items.');
      } finally {
        setDuplicatePending(false);
      }
    },
    [selectedIds, clear],
  );

  const handleBulkExport = useCallback(
    async (format: 'csv' | 'json') => {
      setExportMenuOpen(false);
      setExportPending(true);
      try {
        const result = await bulkExportContentItems(Array.from(selectedIds), format);
        if (result.ok && result.data) {
          const blob = new Blob([result.data], {
            type: format === 'csv' ? 'text/csv' : 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.filename ?? `content-items-export.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success(`Exported ${selectedIds.size} item(s) as ${format.toUpperCase()}.`);
          clear();
        } else {
          toast.error(result.message || 'Failed to export content items.');
        }
      } catch {
        toast.error('Failed to export content items.');
      } finally {
        setExportPending(false);
      }
    },
    [selectedIds, clear],
  );

  const bulkActions: BulkActionConfig[] = [
    {
      key: 'duplicate',
      label: 'Duplicate',
      icon: Copy,
      onClick: () => void handleBulkDuplicate(),
      disabled: duplicatePending,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      variant: 'danger',
      onClick: () => setDeleteConfirmOpen(true),
      disabled: deletePending,
    },
    {
      key: 'export',
      label: 'Export',
      icon: Download,
      onClick: () => setExportMenuOpen((value) => !value),
      disabled: exportPending,
    },
  ];

  function rowCheckboxClasses() {
    return 'h-4 w-4 rounded border-border text-primary accent-[rgb(61,90,90)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';
  }

  return (
    <Card>
      <CardHeader
        title="Saved Content Items"
        description={`${items.length} item${items.length === 1 ? '' : 's'} match the current filters.`}
        action={<BookOpen className="h-5 w-5 text-[#F7CBCA]" />}
      />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-[#D5E5E5]/28 px-5 py-12 text-center">
          <Layers3 className="mx-auto h-10 w-10 text-[#F7CBCA]" />
          <p className="mt-4 text-base font-bold text-black">No content items match this library view</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-black/54">
            Create a platform draft in Content & Ads Studio, then return here to manage saved items, linked assets, provider status, and planned times.
          </p>
        </div>
      ) : (
        <>
          <div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-[#F1F7F7] text-xs font-black uppercase tracking-[0.14em] text-black/42">
                    <th className="rounded-l-xl border-y border-l border-black/7 px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                        onChange={(event) => handleToggleAll(event.target.checked)}
                        aria-label="Select all content items on this page"
                        className={rowCheckboxClasses()}
                      />
                    </th>
                    <th className="border-y border-black/7 px-3 py-3">Item</th>
                    <th className="border-y border-black/7 px-3 py-3">Platform</th>
                    <th className="border-y border-black/7 px-3 py-3">Content Type</th>
                    <th className="border-y border-black/7 px-3 py-3">Status</th>
                    <th className="border-y border-black/7 px-3 py-3">Provider</th>
                    <th className="border-y border-black/7 px-3 py-3">Assets</th>
                    <th className="border-y border-black/7 px-3 py-3">Planned Time</th>
                    <th className="border-y border-black/7 px-3 py-3">Safe Action</th>
                    <th className="rounded-r-xl border-y border-r border-black/7 px-3 py-3">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item, index) => {
                    const selected = selectedIds.has(item.id);
                    return (
                      <tr key={item.id} className={cn('align-top transition-colors hover:bg-[#F1F7F7]/75', selected && 'bg-primary-light/5')} aria-selected={selected}>
                        <td className="border-b border-black/6 px-3 py-4">
                          <input
                            type="checkbox"
                            checked={selected}
                            onClick={(event) => {
                              event.preventDefault();
                              handleToggleRow(item.id, index, event.shiftKey);
                            }}
                            aria-label={`Select ${item.title}`}
                            className={rowCheckboxClasses()}
                          />
                        </td>
                        <td className="border-b border-black/6 px-3 py-4">
                          <Link href={buildStudioHref(item)} className="font-black text-[#5D6B6B] hover:text-[#F7CBCA]">
                            {item.title}
                          </Link>
                          <p className="mt-1 max-w-[260px] text-xs leading-5 text-black/46">
                            Updated {formatDateTime(item.updated_at)}
                          </p>
                        </td>
                        <td className="border-b border-black/6 px-3 py-4 font-bold text-black/64">
                          {formatContentStudioPlatformLabel(item.platform)}
                        </td>
                        <td className="border-b border-black/6 px-3 py-4 text-black/62">
                          {formatContentStudioTypeLabel(item.content_type)}
                        </td>
                        <td className="border-b border-black/6 px-3 py-4">
                          <StatusBadge status={item.status} type="task" size="sm" />
                        </td>
                        <td className="border-b border-black/6 px-3 py-4">
                          <span className="font-semibold text-black/62">
                            {item.provider_status?.replace(/_/g, ' ') || 'not checked'}
                          </span>
                          {item.provider_error ? (
                            <p className="mt-1 max-w-[220px] text-xs leading-5 text-black/46">{item.provider_error}</p>
                          ) : null}
                        </td>
                        <td className="border-b border-black/6 px-3 py-4 font-mono text-sm font-black text-[#5D6B6B]">
                          {item.asset_count}
                        </td>
                        <td className="border-b border-black/6 px-3 py-4 text-black/62">
                          {item.schedule_at ? formatDateTime(item.schedule_at) : 'Not planned'}
                        </td>
                        <td className="border-b border-black/6 px-3 py-4 text-black/62">
                          {actionTypeLabel(item)}
                        </td>
                        <td className="border-b border-black/6 px-3 py-4">
                          <Link href={buildStudioHref(item)} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                            Open/Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                startIndex={startIndex}
                endIndex={endIndex}
                onPrev={prevPage}
                onNext={nextPage}
                onGoToPage={goToPage}
              />
            </div>
          </div>

          <BulkActionBar
            count={selectedIds.size}
            actions={bulkActions}
            onClear={clear}
            label="content item"
            aria-label="Bulk content item actions"
          />

          {exportMenuOpen && selectedIds.size > 0 && (
            <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} aria-hidden="true" />
          )}

          {exportMenuOpen && selectedIds.size > 0 && (
            <div
              role="menu"
              aria-label="Export format"
              className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit flex-col gap-1 rounded-lg border border-primary-light/20 bg-background p-2 shadow-[0_18px_42px_rgba(61,90,90,0.18)]"
            >
              <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-black/42">
                Export Format
              </p>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleBulkExport('csv')}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary-light/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                CSV (.csv)
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleBulkExport('json')}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary-light/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                JSON (.json)
              </button>
            </div>
          )}

          {deleteConfirmOpen && selectedIds.size > 0 && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setDeleteConfirmOpen(false)}>
              <div
                className="mx-4 w-full max-w-md rounded-2xl border border-primary-light/20 bg-background p-6 shadow-[0_18px_42px_rgba(61,90,90,0.18)]"
                onClick={(event) => event.stopPropagation()}
                role="alertdialog"
                aria-label="Delete confirmation"
              >
                <h3 className="text-lg font-bold text-foreground">
                  Delete {selectedIds.size} content item(s)?
                </h3>
                <p className="mt-2 text-sm text-foreground-muted">
                  This action cannot be undone. The items, linked assets metadata, and all associated data will be permanently removed.
                </p>
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(false)}
                    className={buttonStyles({ variant: 'outline', size: 'sm' })}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBulkDelete()}
                    disabled={deletePending}
                    className={buttonStyles({ variant: 'danger', size: 'sm' })}
                  >
                    {deletePending ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
