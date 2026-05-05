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
        'min-w-0 rounded-lg border border-black/8 bg-white shadow-[0_18px_48px_rgba(0,0,0,0.06)]',
        'ring-1 ring-[#F0DBEF]/40',
        padded && 'p-5 sm:p-6',
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
        'mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="break-words text-base font-bold text-black sm:text-lg">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-black/58">{description}</p>}
      </div>
      {action && <div className="flex w-full max-w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{action}</div>}
    </div>
  );
}
