import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { BrandMark } from '@/components/brand/BrandMark';

const navItems = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'Dashboard', href: '/dashboard' },
];

export function MarketingNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#F7CBCA]/10 bg-[#F1F7F7]/40 backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]">
      <nav className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
        <BrandMark href="/" showTagline={false} className="max-w-[58vw]" />

        <div className="hidden items-center rounded-lg border border-[#F7CBCA]/10 bg-white/38 p-1 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3.5 py-2 text-sm font-bold text-black/70 hover:bg-white/55 hover:text-black hover:shadow-sm"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden sm:block">
            <Link
              href="/auth/login"
              className={buttonStyles({ variant: 'ghost', size: 'md' })}
            >
              Sign In
            </Link>
          </div>
          <Link href="/auth/signup" className={buttonStyles({ size: 'md', className: 'px-2.5 sm:px-4' })}>
            <span className="sm:hidden">Start</span>
            <span className="hidden sm:inline">Get Started</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>
    </header>
  );
}
