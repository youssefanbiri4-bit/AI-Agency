import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'soft';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'border border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(var(--color-primary),0.25)] hover:bg-primary-hover hover:shadow-[0_4px_12px_rgba(var(--color-primary),0.3)]',
  secondary:
    'border border-border bg-surface text-foreground shadow-sm hover:border-border-strong hover:bg-surface-elevated',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-surface hover:border-border-strong',
  ghost:
    'border border-transparent bg-transparent text-foreground-muted hover:bg-surface hover:text-foreground',
  danger:
    'border border-danger bg-danger text-danger-foreground shadow-[0_2px_8px_rgba(var(--color-danger),0.25)] hover:bg-danger/90 hover:border-danger/90',
  success:
    'border border-success bg-success text-success-foreground shadow-[0_2px_8px_rgba(var(--color-success),0.25)] hover:bg-success/90 hover:border-success/90',
  soft:
    'border border-primary-light bg-primary-light text-primary hover:border-primary hover:bg-primary-light/90',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-10 w-10 p-0',
};

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    'inline-flex max-w-full min-w-0 shrink-0 items-center justify-center gap-2 rounded-lg text-center font-bold leading-5 tracking-normal transition-all duration-200 ease-out text-wrap',
    'whitespace-normal break-words',
    'btn-press',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-foreground-muted disabled:shadow-none',
    variantStyles[variant],
    sizeStyles[size],
    className
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      {...props}
    />
  );
}