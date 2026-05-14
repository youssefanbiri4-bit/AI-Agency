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
    'border border-[var(--theme-primary,#F7CBCA)] bg-gradient-to-r from-[var(--theme-primary,#F7CBCA)] to-[var(--theme-secondary,#F7CBCA)] text-white shadow-[0_14px_30px_rgba(202,40,81,0.24)] hover:border-[var(--theme-secondary,#F7CBCA)] hover:shadow-[0_16px_36px_rgba(255,103,102,0.20)]',
  secondary:
    'border border-[#F7CBCA]/15 bg-white/78 text-[#5D6B6B] shadow-sm backdrop-blur-[16px] hover:border-[#F7CBCA]/35 hover:bg-white hover:text-[#F7CBCA]',
  outline:
    'border border-[#F7CBCA]/15 bg-white/78 text-black shadow-sm backdrop-blur-[16px] hover:border-[#F7CBCA]/40 hover:bg-[#D5E5E5]/55 hover:text-[#F7CBCA]',
  ghost:
    'border border-transparent bg-transparent text-black/62 hover:bg-[#D5E5E5]/62 hover:text-black',
  danger:
    'border border-[#F7CBCA] bg-[#F7CBCA] text-white shadow-[0_14px_30px_rgba(255,103,102,0.20)] hover:border-black hover:bg-black',
  success:
    'border border-black bg-black text-white shadow-[0_14px_30px_rgba(0,0,0,0.18)] hover:border-[#F7CBCA] hover:bg-[#F7CBCA]',
  soft:
    'border border-[#F7CBCA]/15 bg-[#D5E5E5]/70 text-[#F7CBCA] hover:border-[#F7CBCA]/35 hover:bg-[#D5E5E5]',
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
    'focus:outline-none focus:ring-4 focus:ring-[#F7CBCA]/18 focus:ring-offset-2 focus:ring-offset-white',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-black/[0.06] disabled:bg-none disabled:text-black/38 disabled:shadow-none',
    'hover:-translate-y-0.5 active:translate-y-px',
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
