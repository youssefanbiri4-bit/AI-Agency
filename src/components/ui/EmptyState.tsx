import type { ComponentType, ReactNode } from 'react';
import { createElement } from 'react';
import { Inbox, SearchX, AlertTriangle, Lock, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EmptyStateVariant = 'first-visit' | 'no-results' | 'error' | 'permission-denied';

/**
 * The `icon` prop accepts either a LucideIcon component reference (e.g.
 * `icon={CheckCircle2}`) OR an already-rendered ReactNode (e.g.
 * `icon={<CheckCircle2 className="h-6 w-6" />}`). Accepting a component
 * reference is safe only while EmptyState renders on the server; to keep the
 * component boundary-agnostic (usable from Client Components without leaking a
 * function across the RSC boundary) callers should prefer passing a rendered
 * element. `resolveIcon` normalizes both forms.
 */
interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon | ComponentType<{ className?: string }> | ReactNode;
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

function resolveIcon(
  iconProp: EmptyStateProps['icon'],
  fallback: LucideIcon
): ReactNode {
  if (iconProp == null) {
    return createElement(fallback, { className: 'h-6 w-6' });
  }
  // Already-rendered element (ReactNode) — safe across any boundary.
  if (typeof iconProp !== 'function' && typeof iconProp !== 'object') {
    return iconProp as ReactNode;
  }
  if (typeof iconProp !== 'function') {
    // React element (object with $$typeof) — render as-is.
    return iconProp as ReactNode;
  }
  // Component reference — render it here so callers never pass a function
  // across an RSC boundary when EmptyState is consumed from a Client Component.
  return createElement(iconProp as ComponentType<{ className?: string }>, {
    className: 'h-6 w-6',
  });
}

export function EmptyState({
  title,
  description,
  icon: IconProp,
  variant = 'first-visit',
  className,
  hint,
  helper,
  action,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const Icon = resolveIcon(IconProp, config.icon);
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
        {Icon}
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
