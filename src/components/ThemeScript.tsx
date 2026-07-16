// Prevents flash of unstyled content (FOUC) for dark mode.
// This script runs inline in <head> before React hydrates.
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('agentflow-theme') || 'system';
        var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.add(dark ? 'dark' : 'light');
        document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
      } catch(e) {}
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
