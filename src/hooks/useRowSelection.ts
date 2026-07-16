'use client';

import { useCallback, useState } from 'react';

export interface UseRowSelectionResult {
  selectedIds: Set<string>;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  /** Toggle a single row. */
  toggle: (id: string) => void;
  /** Toggle a contiguous range (inclusive) within `ids` based on the anchor. */
  toggleRange: (ids: string[], fromIndex: number, toIndex: number, anchorId: string) => void;
  /** Set every id in the list to `selected`. */
  setMany: (ids: string[], selected: boolean) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
  isAllSelected: (ids: string[]) => boolean;
  isSomeSelected: (ids: string[]) => boolean;
}

/**
 * Row-selection state for data tables, shared by the TaskTable bulk foundation
 * and (optionally) Content Studio tables. Supports single toggle, shift+click
 * range selection, select-all, and clear.
 */
export function useRowSelection(): UseRowSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setMany = useCallback((ids: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => setMany(ids, true), [setMany]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const toggleRange = useCallback(
    (ids: string[], fromIndex: number, toIndex: number, anchorId: string) => {
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        // Anchor decides whether the range is being turned on or off.
        const shouldAdd = !next.has(anchorId);
        for (let i = start; i <= end; i += 1) {
          const rowId = ids[i];
          if (!rowId) continue;
          if (shouldAdd) next.add(rowId);
          else next.delete(rowId);
        }
        return next;
      });
    },
    []
  );

  const isAllSelected = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every((id) => selectedIds.has(id)),
    [selectedIds]
  );

  const isSomeSelected = useCallback(
    (ids: string[]) => ids.some((id) => selectedIds.has(id)) && !isAllSelected(ids),
    [selectedIds, isAllSelected]
  );

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggle,
    toggleRange,
    setMany,
    selectAll,
    clear,
    isAllSelected,
    isSomeSelected,
  };
}
