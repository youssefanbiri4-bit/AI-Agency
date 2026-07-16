/**
 * Sentry client-side configuration.
 *
 * This file is auto-loaded by @sentry/nextjs for browser SDK init.
 * Server/edge init happens in instrumentation.ts (register function).
 *
 * @sentry/nextjs v10+ only loads this config for the client.
 * sentry.server.config.js is NOT loaded automatically — server init is in instrumentation.ts.
 */
(async () => {
  try {
    const mod = await import('@sentry/nextjs');
    const Sentry = mod.default ?? mod;

    const release =
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.SENTRY_RELEASE ||
      `agentflow-ai@${process.env.npm_package_version || 'dev'}`;

    Sentry.init({
      dsn: process.env.SENTRY_DSN || '',
      environment: process.env.NODE_ENV,
      release,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [Sentry.replayIntegration()],
      debug: process.env.NODE_ENV !== 'production',
    });

    // Tag every client event with the deploy commit + app name for filtering
    Sentry.setTag('git_commit', release);
    Sentry.setTag('app', 'agentflow-ai');
  } catch (err) {
    // Sentry init failure must never block page rendering
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[sentry] Failed to initialize client SDK:', err);
    }
  }
})();
