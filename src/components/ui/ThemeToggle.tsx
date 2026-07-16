'use client';

import { useTheme } from '@/lib/theme-context';
import { Sun, Moon, Monitor } from 'lucide-react';

const themeOptions = [
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'system' as const, icon: Monitor, label: 'System' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
      {themeOptions.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          aria-label={`${label} mode`}
          title={`${label} mode`}
          className={`
            relative flex h-8 w-8 items-center justify-center rounded-md
            transition-all duration-200 ease-in-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
            ${
              theme === value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground-muted hover:bg-surface-elevated hover:text-foreground'
            }
          `}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
