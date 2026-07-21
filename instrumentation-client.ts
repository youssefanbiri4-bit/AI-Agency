import * as Sentry from '@sentry/nextjs';

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

Sentry.setTag('git_commit', release);
Sentry.setTag('app', 'agentflow-ai');
