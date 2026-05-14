import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('mx-auto min-w-0 max-w-3xl', align === 'center' && 'text-center', className)}>
      {eyebrow && (
        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#F7CBCA]">
          {eyebrow}
        </p>
      )}
      <h2 className="break-words text-3xl font-black tracking-normal text-black sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-black/62 sm:text-lg">{description}</p>
    </div>
  );
}
