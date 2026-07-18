"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 opacity-0" aria-hidden="true">
        <div className="h-8 w-8" />
        <div className="h-8 w-8" />
        <div className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
      <button
        onClick={() => setTheme("light")}
        aria-label="Light mode"
        title="Light mode"
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          theme === "light"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground-muted hover:bg-surface-elevated hover:text-foreground"
        }`}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        aria-label="Dark mode"
        title="Dark mode"
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          theme === "dark"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground-muted hover:bg-surface-elevated hover:text-foreground"
        }`}
      >
        <Moon className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("system")}
        aria-label="System mode"
        title="System mode"
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          theme === "system"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground-muted hover:bg-surface-elevated hover:text-foreground"
        }`}
      >
        <Monitor className="h-4 w-4" />
      </button>
    </div>
  );
}
