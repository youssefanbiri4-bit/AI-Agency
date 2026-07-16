'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  width?: 'auto' | 'trigger' | number;
}

export function Dropdown({
  trigger,
  children,
  align = 'left',
  className,
  width = 'auto',
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const widthStyle =
    typeof width === 'number'
      ? { width }
      : {};

  const alignStyles: Record<string, string> = {
    left: 'left-0',
    right: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  };

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute z-[var(--z-index-dropdown)] mt-1 min-w-[12rem] overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-lg',
            alignStyles[align],
            'animate-in fade-in slide-in-from-top-2 duration-150',
            className
          )}
          style={widthStyle}
          role="menu"
        >
          {typeof children === 'function'
            ? (children as (props: { close: () => void }) => ReactNode)({ close: handleClose })
            : children}
        </div>
      )}
    </div>
  );
}

// ─── Dropdown Item ──────────────────────────────────────────────────

interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DropdownItem({
  children,
  onClick,
  href,
  danger = false,
  disabled = false,
  className,
}: DropdownItemProps) {
  const base = cn(
    'flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
    'hover:bg-surface-overlay focus:bg-surface-overlay focus:outline-none',
    danger
      ? 'text-danger hover:text-danger'
      : 'text-foreground hover:text-foreground',
    disabled && 'pointer-events-none opacity-50',
    className
  );

  if (href) {
    return (
      <a href={href} className={base} role="menuitem">
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={base} onClick={onClick} disabled={disabled} role="menuitem">
      {children}
    </button>
  );
}

// ─── Dropdown Separator ─────────────────────────────────────────────

export function DropdownSeparator({ className }: { className?: string }) {
  return <div className={cn('my-1 border-t border-border', className)} role="separator" />;
}

// ─── Dropdown Trigger (pre-built) ───────────────────────────────────

interface DropdownTriggerProps {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
  showChevron?: boolean;
  className?: string;
}

export function DropdownTrigger({
  children,
  variant = 'default',
  showChevron = true,
  className,
}: DropdownTriggerProps) {
  const variantStyles: Record<string, string> = {
    default: 'border border-border bg-surface-elevated hover:bg-surface-overlay',
    outline: 'border border-border bg-transparent hover:bg-surface',
    ghost: 'border border-transparent bg-transparent hover:bg-surface',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors',
        variantStyles[variant],
        className
      )}
    >
      {children}
      {showChevron && <ChevronDown className="h-4 w-4 text-foreground-muted" />}
    </span>
  );
}
