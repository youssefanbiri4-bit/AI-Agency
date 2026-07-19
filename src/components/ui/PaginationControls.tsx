'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onGoToPage: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPrev,
  onNext,
  onGoToPage,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const range = 2;
  for (let i = Math.max(1, currentPage - range); i <= Math.min(totalPages, currentPage + range); i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
      <p className="text-sm font-semibold text-foreground-muted">
        {startIndex}–{endIndex} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages[0] > 1 && (
          <>
            <button
              type="button"
              onClick={() => onGoToPage(1)}
              aria-label="Go to page 1"
              className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg px-2 text-sm font-bold text-foreground-muted transition-colors hover:bg-status-neutral-bg/65 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              1
            </button>
            {pages[0] > 2 && <span className="px-1 text-sm text-foreground-muted">...</span>}
          </>
        )}
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onGoToPage(page)}
            aria-current={page === currentPage ? 'page' : undefined}
            aria-label={`Go to page ${page}`}
            className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg px-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
              page === currentPage
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground-muted hover:bg-status-neutral-bg/65 hover:text-foreground'
            }`}
          >
            {page}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span className="px-1 text-sm text-foreground-muted">...</span>}
            <button
              type="button"
              onClick={() => onGoToPage(totalPages)}
              aria-label={`Go to page ${totalPages}`}
              className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg px-2 text-sm font-bold text-foreground-muted transition-colors hover:bg-status-neutral-bg/65 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {totalPages}
            </button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
