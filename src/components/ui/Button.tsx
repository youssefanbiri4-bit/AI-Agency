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
    'border border-[#8B3CDE] bg-[#8B3CDE] text-white shadow-[0_14px_30px_rgba(139,60,222,0.22)] hover:border-[#000000] hover:bg-[#000000] hover:shadow-[0_16px_36px_rgba(0,0,0,0.18)]',
  secondary:
    'border border-[#F55477] bg-[#F55477] text-white shadow-[0_14px_30px_rgba(245,84,119,0.20)] hover:border-[#000000] hover:bg-[#000000] hover:shadow-[0_16px_36px_rgba(0,0,0,0.16)]',
  outline:
    'border border-black/12 bg-white text-black shadow-sm hover:border-[#8B3CDE]/40 hover:bg-[#F0DBEF]/55 hover:text-[#8B3CDE]',
  ghost:
    'border border-transparent bg-transparent text-black/62 hover:bg-[#F0DBEF]/62 hover:text-black',
  danger:
    'border border-[#F55477] bg-[#F55477] text-white shadow-[0_14px_30px_rgba(245,84,119,0.20)] hover:border-black hover:bg-black',
  success:
    'border border-black bg-black text-white shadow-[0_14px_30px_rgba(0,0,0,0.18)] hover:border-[#8B3CDE] hover:bg-[#8B3CDE]',
  soft:
    'border border-[#8B3CDE]/15 bg-[#F0DBEF]/70 text-[#8B3CDE] hover:border-[#8B3CDE]/35 hover:bg-[#F0DBEF]',
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
    'inline-flex max-w-full shrink-0 items-center justify-center gap-2 rounded-lg font-bold tracking-normal transition-all duration-200 ease-out',
    'focus:outline-none focus:ring-4 focus:ring-[#8B3CDE]/18 focus:ring-offset-2 focus:ring-offset-white',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55',
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
