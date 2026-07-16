'use client';

import { useMemo, useState } from 'react';

interface UsePaginationResult<T> {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageItems: T[];
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  startIndex: number;
  endIndex: number;
}

export function usePagination<T>(
  items: T[],
  pageSize: number,
  totalCount?: number
): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);

  const resolvedTotal = totalCount ?? items.length;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(resolvedTotal / pageSize)), [resolvedTotal, pageSize]);

  const safePage = useMemo(() => Math.min(currentPage, totalPages), [currentPage, totalPages]);

  const pageItems = useMemo(() => {
    if (totalCount !== undefined) {
      return items;
    }
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize, totalCount]);

  const startIndex = useMemo(() => (safePage - 1) * pageSize + 1, [safePage, pageSize]);
  const endIndex = useMemo(() => Math.min(safePage * pageSize, resolvedTotal), [safePage, pageSize, resolvedTotal]);

  return {
    currentPage: safePage,
    totalPages,
    totalItems: resolvedTotal,
    pageItems,
    goToPage: (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages))),
    nextPage: () => setCurrentPage((p) => Math.min(p + 1, totalPages)),
    prevPage: () => setCurrentPage((p) => Math.max(p - 1, 1)),
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
    startIndex,
    endIndex,
  };
}
