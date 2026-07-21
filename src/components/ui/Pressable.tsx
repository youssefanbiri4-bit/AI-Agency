'use client';

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { forwardRef, useCallback, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Pressable — adds hover lift + active press scale to any element
// ---------------------------------------------------------------------------

interface PressableProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Scale amount on press. Default: 0.97 */
  pressScale?: number;
  /** Whether to show the hover lift effect. Default: true */
  lift?: boolean;
  /** Slot for success icon to appear after action completes */
  showSuccess?: boolean;
  /** Children can be a render function that receives pressed state */
  children?: ReactNode | ((props: { pressed: boolean }) => ReactNode);
}

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(
  (
    {
      className,
      pressScale = 0.97,
      lift = true,
      showSuccess = false,
      onClick,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const [pressed, setPressed] = useState(false);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;
        setPressed(true);
        // Reset pressed state after animation completes
        setTimeout(() => setPressed(false), 200);
        onClick?.(e);
      },
      [disabled, onClick]
    );

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          // Base transition
          'select-none transition-all duration-150 ease-out',
          // Hover lift
          lift && !disabled && 'hover:-translate-y-0.5 hover:shadow-md',
          // Press scale
          pressed && !disabled && 'scale-[var(--press-scale,0.97)]',
          // Disabled
          disabled && 'cursor-not-allowed opacity-50',
          showSuccess && 'relative',
          className
        )}
        style={{
          ['--press-scale' as string]: pressScale,
        }}
        {...props}
      >
        {typeof children === 'function'
          ? (children as (props: { pressed: boolean }) => ReactNode)({ pressed })
          : children}
      </button>
    );
  }
);
Pressable.displayName = 'Pressable';

// ---------------------------------------------------------------------------
// PressableCard — card with lift + press interaction built in
// ---------------------------------------------------------------------------

interface PressableCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Click handler */
  onPress?: () => void;
  /** Show as interactive (clickable) */
  interactive?: boolean;
}

export function PressableCard({
  className,
  children,
  onPress,
  interactive = true,
  ...props
}: PressableCardProps) {
  return (
    <div
      role={interactive && onPress ? 'button' : undefined}
      tabIndex={interactive && onPress ? 0 : undefined}
      onClick={interactive ? onPress : undefined}
      onKeyDown={
        interactive && onPress
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPress();
              }
            }
          : undefined
      }
      className={cn(
        'card-lift rounded-lg border border-primary-light/20 bg-background/88 p-5 shadow-sm transition-all duration-150',
        interactive &&
          onPress &&
          'cursor-pointer hover:border-primary-light/30 hover:shadow-md active:scale-[0.98]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuccessIcon — animated checkmark that appears on successful action
// ---------------------------------------------------------------------------

interface SuccessIconProps {
  show: boolean;
  className?: string;
  /** Size in pixels (h/w). Default: 20 */
  size?: number;
}

export function SuccessIcon({ show, className, size = 20 }: SuccessIconProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center transition-all duration-300',
        show
          ? 'scale-100 opacity-100'
          : 'pointer-events-none scale-50 opacity-0',
        className
      )}
      aria-hidden={!show}
      aria-label={show ? 'Completed successfully' : undefined}
    >
      <CheckCircle2
        className="text-success"
        style={{ width: size, height: size }}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// AnimatedList — wraps children with staggered fade-in on mount
// ---------------------------------------------------------------------------

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay between items in ms. Default: 80 */
  staggerDelay?: number;
  /** Base animation delay offset in ms. Default: 0 */
  baseDelay?: number;
  /** Element type. Default: div */
  as?: 'div' | 'ul' | 'ol';
  /** Unique key to trigger re-animation (e.g., when items change) */
  animationKey?: string;
}

export function AnimatedList({
  children,
  className,
  staggerDelay: _staggerDelay = 80,
  baseDelay: _baseDelay = 0,
  as: Tag = 'div',
  animationKey,
}: AnimatedListProps) {
  return (
    <Tag className={className} key={animationKey}>
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// AnimatedItem — single item in an animated list with staggered fade-in
// ---------------------------------------------------------------------------

interface AnimatedItemProps {
  children: ReactNode;
  index: number;
  className?: string;
  staggerDelay?: number;
  baseDelay?: number;
}

export function AnimatedItem({
  children,
  index,
  className,
  staggerDelay = 80,
  baseDelay = 0,
}: AnimatedItemProps) {
  const delay = baseDelay + index * staggerDelay;

  return (
    <div
      className={cn('section-fade', className)}
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StaggerGrid — wraps grid children with staggered fade-in
// ---------------------------------------------------------------------------

interface StaggerGridProps {
  children: ReactNode;
  className?: string;
  /** Number of columns for the grid */
  columns?: number;
  staggerDelay?: number;
  baseDelay?: number;
}

export function StaggerGrid({
  children,
  className,
  columns,
  staggerDelay: _staggerDelay = 60,
  baseDelay: _baseDelay = 0,
}: StaggerGridProps) {
  return (
    <div
      className={className}
      style={
        columns
          ? {
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: '1rem',
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// useButtonPress — hook for button press animation state
// ---------------------------------------------------------------------------

export function useButtonPress() {
  const [isPressed, setIsPressed] = useState(false);

  const pressHandlers = {
    onMouseDown: () => setIsPressed(true),
    onMouseUp: () => setIsPressed(false),
    onMouseLeave: () => setIsPressed(false),
    onTouchStart: () => setIsPressed(true),
    onTouchEnd: () => setIsPressed(false),
    style: {
      transform: isPressed ? 'scale(0.97)' : 'scale(1)',
      transition: 'transform 100ms ease-out',
    } as React.CSSProperties,
  };

  return { isPressed, pressHandlers };
}
