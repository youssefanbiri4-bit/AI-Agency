import { type ReactNode } from 'react';
import { Inbox, SearchX, AlertTriangle, Lock, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EmptyStateVariant = 'first-visit' | 'no-results' | 'error' | 'permission-denied';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  variant?: EmptyStateVariant;
  className?: string;
  hint?: string;
  helper?: string;
  action?: ReactNode;
}

const variantConfig: Record<
  EmptyStateVariant,
  { icon: LucideIcon; title: string; description: string }
> = {
  'first-visit': {
    icon: Inbox,
    title: 'Nothing here yet',
    description: 'Get started by adding your first item.',
  },
  'no-results': {
    icon: SearchX,
    title: 'No results found',
    description: 'Try adjusting your search or filters.',
  },
  error: {
    icon: AlertTriangle,
    title: 'Something went wrong',
    description: 'We could not load this content. Try again shortly.',
  },
  'permission-denied': {
    icon: Lock,
    title: 'Access restricted',
    description: 'You do not have permission to view this content.',
  },
};

export function EmptyState({
  title,
  description,
  icon,
  variant = 'first-visit',
  className,
  hint,
  helper,
  action,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const resolvedIcon = icon ?? <config.icon className="h-6 w-6" />;
  const resolvedTitle = title ?? config.title;
  const resolvedDescription = description ?? config.description;
  const resolvedHint = hint ?? helper;

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 px-6 py-12 text-center',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-elevated text-foreground-muted">
        {resolvedIcon}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">{resolvedTitle}</h3>
        <p className="max-w-md text-sm text-foreground-muted">{resolvedDescription}</p>
        {resolvedHint ? <p className="mt-1 max-w-md text-xs text-foreground-muted/80">{resolvedHint}</p> : null}
      </div>
      {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
