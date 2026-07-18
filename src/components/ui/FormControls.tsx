'use client';

import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const controlBase =
  'w-full min-w-0 rounded-lg border border-border bg-surface-elevated px-3.5 py-2.5 text-sm font-medium leading-5 text-foreground shadow-sm transition-all placeholder:text-foreground-muted focus:border-ring focus:outline-none focus:ring-4 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-surface disabled:text-foreground-muted';

export function inputStyles(className?: string) {
  return cn(controlBase, className);
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={inputStyles(className)} {...props} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={inputStyles(cn('appearance-none pe-9', className))}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={inputStyles(cn('resize-none leading-6', className))}
      {...props}
    />
  );
});

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-2 block text-sm font-bold text-foreground', className)}
      {...props}
    />
  );
}
