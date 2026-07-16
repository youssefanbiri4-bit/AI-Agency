'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface CTASectionProps {
  eyebrow?: string;
  title: string;
  description: string;
  primaryCTA: {
    label: string;
    href: string;
  };
  secondaryCTA?: {
    label: string;
    href: string;
  };
  variant?: 'default' | 'dark' | 'gradient';
  className?: string;
}

export function CTASection({
  eyebrow,
  title,
  description,
  primaryCTA,
  secondaryCTA,
  variant = 'dark',
  className,
}: CTASectionProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden px-6 py-20 sm:px-12',
        variant === 'dark' && 'bg-[#1a1a2e] text-white',
        variant === 'gradient' && 'bg-gradient-to-br from-primary/90 to-primary text-white',
        variant === 'default' && 'bg-surface text-foreground',
        className
      )}
    >
      {/* Background decoration */}
      {variant !== 'default' && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5" />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        </div>
      )}

      <div className="relative mx-auto max-w-4xl text-center">
        {eyebrow && (
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#F7CBCA]">
            {eyebrow}
          </p>
        )}

        <h2 className="text-3xl font-black tracking-normal sm:text-4xl lg:text-5xl">
          {title}
        </h2>

        <p className={cn(
          'mt-6 text-lg leading-8',
          variant === 'dark' ? 'text-white/70' : variant === 'gradient' ? 'text-white/80' : 'text-foreground-muted'
        )}>
          {description}
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href={primaryCTA.href}>
            <Button
              size="lg"
              variant={variant === 'default' ? 'primary' : 'secondary'}
              className="min-w-[200px]"
            >
              <Sparkles className="h-5 w-5" />
              {primaryCTA.label}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>

          {secondaryCTA && (
            <Link href={secondaryCTA.href}>
              <Button
                size="lg"
                variant="ghost"
                className={cn(
                  'min-w-[200px]',
                  variant === 'dark' && 'text-white hover:bg-white/10',
                  variant === 'gradient' && 'text-white hover:bg-white/10'
                )}
              >
                {secondaryCTA.label}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
