import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary'
  // Legacy tones (deprecated - for migration only)
  | 'brand'
  | 'accent'
  | 'dark'
  | 'slate'
  | 'blue'
  | 'violet'
  | 'cyan'
  | 'emerald'
  | 'amber';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
  success: 'border-status-success-bg bg-status-success-bg text-status-success-text',
  warning: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
  danger: 'border-status-danger-bg bg-status-danger-bg text-status-danger-text',
  info: 'border-status-info-bg bg-status-info-bg text-status-info-text',
  primary: 'border-primary-light bg-primary-light text-primary',
  // Legacy tones (map to closest new semantic)
  brand: 'border-primary-light bg-primary-light text-primary',
  accent: 'border-primary-light bg-primary-light text-primary',
  dark: 'border-foreground bg-foreground text-background',
  slate: 'border-status-neutral-bg bg-status-neutral-bg text-status-neutral-text',
  blue: 'border-status-info-bg bg-status-info-bg text-status-info-text',
  violet: 'border-primary-light bg-primary-light text-primary',
  cyan: 'border-status-info-bg bg-status-info-bg text-status-info-text',
  emerald: 'border-status-success-bg bg-status-success-bg text-status-success-text',
  amber: 'border-status-warning-bg bg-status-warning-bg text-status-warning-text',
};

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex w-fit max-w-full min-w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold leading-5',
        'whitespace-normal break-words text-start',
        toneStyles[tone],
        className
      )}
      {...props}
    />
  );
}