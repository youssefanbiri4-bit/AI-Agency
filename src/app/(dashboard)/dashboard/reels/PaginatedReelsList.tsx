'use client';

import Link from 'next/link';
import { Film } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { usePagination } from '@/hooks/usePagination';
import { formatContentStudioTypeLabel, getTabForContentType } from '../content-studio/shared';
import type { ContentStudioStatus, ContentStudioType } from '@/types/database';

interface ReelItemData {
  id: string;
  title: string;
  status: ContentStudioStatus;
  platform: string;
  contentType: ContentStudioType;
  objective?: string | null;
  scheduleAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedReelsListProps {
  reels: ReelItemData[];
}

function ReelItem({
  id,
  title,
  status,
  platform,
  contentType,
  objective,
  scheduleAt,
  publishedAt,
  createdAt,
  updatedAt,
}: ReelItemData) {
  const statusColors: Record<string, string> = {
    draft: 'bg-black/8 text-black/64',
    ready: 'bg-[#D5E5E5]/58 text-[#F7CBCA]',
    scheduled: 'bg-[#F1F7F7]/58 text-[#E7F5DC]',
    published: 'bg-[#D4EDDA]/58 text-[#155724]',
    failed: 'bg-[#FFD4D4]/58 text-[#A00000]',
    approval_pending: 'bg-[#FFF1D6]/70 text-[#9A5A00]',
    setup_required: 'bg-[#FFF1D6]/70 text-[#9A5A00]',
  };
  const contentStudioHref = `/dashboard/content-studio?tab=${getTabForContentType(contentType)}&item=${id}`;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-black/8 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 min-w-0">
        <Link href={contentStudioHref}>
          <h3 className="text-sm font-bold text-black hover:text-[#F7CBCA] transition-colors truncate">
            {title}
          </h3>
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-black/46">
          <span>Platform: {platform}</span>
          <span>Type: {formatContentStudioTypeLabel(contentType)}</span>
          <span>Status: {status}</span>
          {objective && <span>Objective: {objective}</span>}
          {scheduleAt && (
            <span>
              Scheduled: {new Date(scheduleAt).toLocaleDateString()}
            </span>
          )}
          {publishedAt && (
            <span>
              Published: {new Date(publishedAt).toLocaleDateString()}
            </span>
          )}
          <span>Created: {new Date(createdAt).toLocaleDateString()}</span>
          <span>Updated: {new Date(updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:ms-4 sm:justify-end">
        <Badge className={statusColors[status] || statusColors.draft}>
          {status}
        </Badge>
        <Link href={contentStudioHref}>
          <Button variant="outline" size="sm">
            Open Reel
          </Button>
        </Link>
        {status === 'draft' && (
          <Link href={contentStudioHref}>
            <Button variant="secondary" size="sm">
              Edit Draft
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

export function PaginatedReelsList({ reels }: PaginatedReelsListProps) {
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
  } = usePagination(reels, 50);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-black">All Reels</h2>
      {reels.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#D5E5E5]/70 text-[#F7CBCA]">
            <Film className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-black">No reels yet</h3>
            <p className="mt-1 text-sm text-black/46">
              Create your first Instagram Reel in Content & Ads Studio to get started.
            </p>
          </div>
          <Link href="/dashboard/content-studio?tab=reels&type=instagram_reel">
            <Button className="mt-4">New Reel</Button>
          </Link>
        </Card>
      ) : (
        <div>
          <div className="space-y-3">
            {pageItems.map((reel) => (
              <ReelItem key={reel.id} {...reel} />
            ))}
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
      )}
    </div>
  );
}
