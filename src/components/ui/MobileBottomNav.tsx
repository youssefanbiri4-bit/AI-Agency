'use client';

import { BarChart3, FileText, Home, Menu, PenSquare, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onMoreClick: () => void;
}

const navItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: FileText, label: 'Tasks', href: '/dashboard/tasks' },
  { icon: PenSquare, label: 'Content', href: '/dashboard/content-studio' },
  { icon: BarChart3, label: 'Reports', href: '/dashboard/reports' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

function triggerHaptic(pattern?: 'light' | 'medium') {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern === 'medium' ? 10 : 5);
  }
}

export function MobileBottomNav({ onMoreClick }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-lg safe-area-bottom lg:hidden"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-1 py-1 sm:px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/dashboard'
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => triggerHaptic()}
              className={cn(
                'relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-bold leading-tight',
                'transition-all duration-200 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]/50',
                'active:scale-95',
                isActive
                  ? 'text-primary'
                  : 'text-foreground-muted/70 hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute inset-x-1 -top-0.5 h-[3px] rounded-full bg-primary transition-all duration-300 ease-out" />
              )}
              <Icon
                className={cn(
                  'h-5 w-5 transition-transform duration-200',
                  isActive && 'scale-110'
                )}
              />
              <span className={cn('truncate transition-colors duration-200', isActive && 'text-primary')}>
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => {
            triggerHaptic('medium');
            onMoreClick();
          }}
          aria-label="Open navigation menu"
          className={cn(
            'relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-bold leading-tight',
            'transition-all duration-200 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]/50',
            'active:scale-95',
            'text-foreground-muted/70 hover:text-foreground'
          )}
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
