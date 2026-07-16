import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function Card({ className, padded = true, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border border-border bg-surface-elevated shadow-sm card-hover',
        'ring-1 ring-foreground/8',
        padded && 'p-6',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex min-w-0 flex-col gap-2 border-b border-divider pb-4 lg:flex-row lg:items-start lg:justify-between',
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="text-base font-bold leading-snug tracking-normal text-foreground sm:text-lg">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-foreground-muted">{description}</p>}
      </div>
      {action && <div className="flex w-full max-w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:justify-end">{action}</div>}
    </div>
  );
}