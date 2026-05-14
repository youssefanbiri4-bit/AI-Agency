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
        'min-w-0 rounded-lg border border-[#F7CBCA]/10 bg-white/90 shadow-[0_18px_42px_rgba(93,107,107,0.07)] backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]',
        'ring-1 ring-white/58',
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
        'mb-5 flex min-w-0 flex-col gap-3 border-b border-black/6 pb-4 lg:flex-row lg:items-start lg:justify-between',
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="text-base font-black leading-snug tracking-normal text-black sm:text-lg">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-black/58">{description}</p>}
      </div>
      {action && <div className="flex w-full max-w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:justify-end">{action}</div>}
    </div>
  );
}
