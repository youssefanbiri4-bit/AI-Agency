/**
 * Keep this file runtime-compatible with CommonJS project setup,
 * while avoiding @typescript-eslint/no-require-imports.
 */
(async () => {
  try {
    const mod = await import('@sentry/nextjs');
    const Sentry = mod.default ?? mod;

    Sentry.init({
      dsn: process.env.SENTRY_DSN || '',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      debug: process.env.SENTRY_DEBUG === 'true',
    });
  } catch (err) {
    // Sentry init failure must never block page rendering
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[sentry] Failed to initialize client SDK:', err);
    }
  }
})();
