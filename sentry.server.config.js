/**
 * Keep this file runtime-compatible with CommonJS project setup,
 * while avoiding @typescript-eslint/no-require-imports.
 */
(async () => {
  const mod = await import('@sentry/nextjs');
  const Sentry = mod.default ?? mod;

  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: process.env.SENTRY_DEBUG === 'true',
  });
})();
