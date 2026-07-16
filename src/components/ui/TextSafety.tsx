import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function CodeInline({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <code
      dir="ltr"
      className={cn(
        'inline-block max-w-full rounded-md border border-border bg-surface px-1.5 py-0.5 align-baseline font-mono text-[0.82em] font-bold leading-5 text-foreground-muted',
        '[overflow-wrap:anywhere] [word-break:normal]',
        className
      )}
      {...props}
    />
  );
}

export function SafeText({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('min-w-0 whitespace-normal break-words [word-break:normal]', className)}
      {...props}
    />
  );
}
