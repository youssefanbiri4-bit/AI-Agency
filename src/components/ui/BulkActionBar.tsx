'use client';

import type { ComponentType } from 'react';
import { X } from 'lucide-react';
import { buttonStyles } from './Button';
import { cn } from '@/lib/utils';

export type BulkActionVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export interface BulkActionConfig {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: BulkActionVariant;
  disabled?: boolean;
  disabledTooltip?: string;
  className?: string;
}

export interface BulkActionBarProps {
  count: number;
  actions: BulkActionConfig[];
  onClear: () => void;
  /** Singular noun for the selected entity, e.g. "task". */
  label?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Floating bulk-action bar shown only when at least one row is selected.
 * Visibility is controlled by the caller (returns null when count === 0).
 */
export function BulkActionBar({
  count,
  actions,
  onClear,
  label = 'item',
  className,
  'aria-label': ariaLabel = 'Bulk actions',
}: BulkActionBarProps) {
  if (count === 0) return null;

  const noun = count === 1 ? label : `${label}s`;

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={cn(
        'fixed inset-x-0 bottom-4 z-40 flex justify-center px-4',
        className,
      )}
    >
      <div className="flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-primary-light/20 bg-background/95 px-3 py-2.5 shadow-[0_18px_42px_rgba(61,90,90,0.18)] backdrop-blur-md sm:px-4 sm:py-3">
        <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground">
          <span aria-live="polite" className="rounded-full bg-primary-light/15 px-2.5 py-1 text-primary-light">
            {count}
          </span>
          <span className="hidden sm:inline">{noun} selected</span>
        </div>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <div className="flex flex-1 flex-wrap items-center gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.disabled ? action.disabledTooltip ?? action.label : action.label}
                aria-label={action.label}
                aria-disabled={action.disabled || undefined}
                className={buttonStyles({
                  variant: action.variant ?? 'outline',
                  size: 'sm',
                  className: cn('gap-1.5', action.className),
                })}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                <span className="hidden md:inline">{action.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          title="Clear selection"
          className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'gap-1 shrink-0' })}
        >
          <X className="h-4 w-4" />
          <span className="hidden md:inline">Clear</span>
        </button>
      </div>
    </div>
  );
}
