import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

const controlBase =
  'w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm text-black shadow-sm transition-all placeholder:text-black/32 focus:border-[#8B3CDE]/45 focus:outline-none focus:ring-4 focus:ring-[#8B3CDE]/14 disabled:cursor-not-allowed disabled:bg-[#F0DBEF]/35 disabled:text-black/45';

export function inputStyles(className?: string) {
  return cn(controlBase, className);
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputStyles(className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={inputStyles(cn('appearance-none pr-9', className))} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={inputStyles(cn('resize-none leading-6', className))} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-2 block text-sm font-bold text-black/72', className)}
      {...props}
    />
  );
}
