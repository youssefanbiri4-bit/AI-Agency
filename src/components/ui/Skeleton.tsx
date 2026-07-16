'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Base Skeleton
// ---------------------------------------------------------------------------

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Render as a circle (equal width/height, full rounded) */
  circle?: boolean;
  /** Animation variant. Default: pulse */
  animation?: 'pulse' | 'sheen' | 'none';
}

export function Skeleton({
  className,
  circle,
  animation = 'pulse',
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-foreground/6',
        circle ? 'rounded-full' : 'rounded-xl',
        animation === 'pulse' && 'animate-pulse',
        animation === 'sheen' && 'skeleton-block',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// TableSkeleton — renders skeleton rows matching typical .data-table column layout
// ---------------------------------------------------------------------------

interface TableSkeletonProps {
  rows?: number;
  /** Number of columns (default: 7 for tasks table). Controls column count. */
  columns?: number;
  className?: string;
  /** Show header row skeleton */
  showHeader?: boolean;
}

export function TableSkeleton({
  rows = 5,
  columns: columnCount = 7,
  className,
  showHeader = true,
}: TableSkeletonProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-primary-light/20 bg-background/82 shadow-sm',
        className
      )}
      aria-busy="true"
      aria-label="Loading table data"
    >
      {/* Hidden label for screen readers */}
      <span className="sr-only" role="status">
        Table is loading
      </span>

      {/* Header skeleton */}
      {showHeader && (
        <div className="flex gap-6 border-b border-divider bg-surface px-5 py-3.5">
          {Array.from({ length: columnCount }).map((_, i) => (
            <Skeleton
              key={`h-${i}`}
              className={cn(
                'h-3.5',
                i === 0 ? 'w-32' : i === 1 ? 'w-24' : i === columnCount - 1 ? 'w-16' : 'w-20'
              )}
            />
          ))}
        </div>
      )}

      {/* Body rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`r-${rowIndex}`}
          className={cn(
            'flex items-center gap-6 border-b border-divider px-5 py-4',
            rowIndex % 2 === 0 ? 'bg-surface-elevated/40' : 'bg-transparent'
          )}
          style={{
            animationDelay: `${rowIndex * 60}ms`,
            animation: 'section-fade 0.4s ease-out both',
          }}
        >
          {Array.from({ length: columnCount }).map((_, colIndex) => (
            <Skeleton
              key={`c-${colIndex}`}
              className={cn(
                'h-4',
                colIndex === 0
                  ? 'w-1/3 max-w-[200px]'
                  : colIndex === 1
                    ? 'w-20'
                    : colIndex === 2
                      ? 'w-24'
                      : colIndex === columnCount - 1
                        ? 'w-10'
                        : 'w-16'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardSkeleton — renders a skeleton card with icon/avatar, title, and content blocks
// ---------------------------------------------------------------------------

interface CardSkeletonProps {
  /** Number of content lines to render */
  lines?: number;
  /** Show an icon/avatar block on the left */
  showIcon?: boolean;
  /** Compact variant for small cards */
  compact?: boolean;
  className?: string;
  /** Action area (e.g., button skeleton) at the bottom */
  showAction?: boolean;
  /** Badge/chip skeleton */
  showBadge?: boolean;
}

export function CardSkeleton({
  lines = 3,
  showIcon = true,
  compact = false,
  className,
  showAction = false,
  showBadge = false,
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-primary-light/20 bg-background/88 p-5 shadow-sm',
        className
      )}
      aria-busy="true"
      aria-label="Loading card content"
    >
      <span className="sr-only" role="status">Card is loading</span>

      {/* Header row: icon + title */}
      <div className="flex items-start gap-3">
        {showIcon && <Skeleton circle className="h-10 w-10 shrink-0" />}
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className={cn('h-5', compact ? 'w-2/3' : 'w-3/4')} />
          {!compact && <Skeleton className="h-3.5 w-1/2" />}
        </div>
        {showBadge && <Skeleton className="h-6 w-16 shrink-0 rounded-full" />}
      </div>

      {/* Content lines */}
      <div className={cn('space-y-2', showIcon ? 'mt-4' : 'mt-2')}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={`l-${i}`}
            className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')}
          />
        ))}
      </div>

      {/* Action skeleton */}
      {showAction && (
        <Skeleton className="mt-4 h-9 w-full rounded-lg" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCardSkeleton — skeleton for dashboard stat/metric cards
// ---------------------------------------------------------------------------

interface StatCardSkeletonProps {
  className?: string;
}

export function StatCardSkeleton({ className }: StatCardSkeletonProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border border-border bg-surface-elevated p-4 shadow-sm',
        className
      )}
      aria-busy="true"
      aria-label="Loading statistics"
    >
      <span className="sr-only" role="status">Statistic is loading</span>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-3.5 w-32" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardContentSkeleton — full dashboard skeleton matching the command center layout
// ---------------------------------------------------------------------------

interface DashboardContentSkeletonProps {
  className?: string;
}

export function DashboardContentSkeleton({ className }: DashboardContentSkeletonProps) {
  return (
    <div className={cn('space-y-8', className)} aria-busy="true" aria-label="Dashboard loading">
      <span className="sr-only" role="status">Dashboard content is loading</span>

      {/* Hero section skeleton */}
      <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[1fr_360px] xl:items-center">
          <div className="space-y-4">
            <Skeleton className="h-5 w-44 rounded-full" />
            <Skeleton className="h-10 w-3/4 max-w-lg" />
            <Skeleton className="h-5 w-full max-w-2xl" />
            <div className="flex flex-wrap gap-2 pt-2">
              <Skeleton className="h-11 w-32 rounded-lg" />
              <Skeleton className="h-11 w-36 rounded-lg" />
              <Skeleton className="h-11 w-28 rounded-lg" />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <Skeleton className="aspect-[11/9] w-full max-w-[13rem] mx-auto rounded-lg" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Health scorecard skeleton */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-5 border-b border-divider pb-4 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={`stat-${i}`} />
          ))}
        </div>
      </div>

      {/* My Work skeleton */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-6 border-b border-divider pb-4 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`col-${i}`} className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={`r-${i}-${j}`} className="h-16 w-full rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid skeleton for bottom sections */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-72" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={`left-${i}`} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-56" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={`right-${i}`} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ListSkeleton — skeleton for vertical lists (notifications, tasks, etc.)
// ---------------------------------------------------------------------------

interface ListSkeletonProps {
  items?: number;
  className?: string;
  /** Show avatar/icon per row */
  showAvatar?: boolean;
}

export function ListSkeleton({
  items = 4,
  className,
  showAvatar = true,
}: ListSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label="Loading list">
      <span className="sr-only" role="status">List is loading</span>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface-elevated p-4"
          style={{ animationDelay: `${i * 80}ms`, animation: 'section-fade 0.35s ease-out both' }}
        >
          {showAvatar && <Skeleton circle className="h-10 w-10 shrink-0" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressSkeleton — skeleton for a progress/loading bar display
// ---------------------------------------------------------------------------

interface ProgressSkeletonProps {
  bars?: number;
  className?: string;
}

export function ProgressSkeleton({ bars = 4, className }: ProgressSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)} aria-busy="true">
      <span className="sr-only" role="status">Progress data is loading</span>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
