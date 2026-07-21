import * as Sentry from '@sentry/nextjs';
import { registerGracefulShutdown, registerShutdownable, asShutdownable } from '@/lib/graceful-shutdown';
import { redis } from '@/lib/queue/redis';
import { stopTaskQueueEvents } from '@/lib/queue/events';
import { logger } from '@/lib/logger';
import { setGauge } from '@/lib/monitoring/metrics';
import { INSTANCE_ID } from '@/lib/scaling/instance';

const startupLog = logger.child('startup');

const release =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.SENTRY_RELEASE ||
  `agentflow-ai@${process.env.npm_package_version || 'dev'}`;

function getSentryConfig() {
  return {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: process.env.NODE_ENV !== 'production',
  };
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init(getSentryConfig());
    // Tag every event/transaction with the deploy commit for release tracking.
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      Sentry.setTag('git_commit', process.env.VERCEL_GIT_COMMIT_SHA);
    }
    Sentry.setTag('app', 'agentflow-ai');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init(getSentryConfig());
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      Sentry.setTag('git_commit', process.env.VERCEL_GIT_COMMIT_SHA);
    }
    Sentry.setTag('app', 'agentflow-ai');
  }

  // Run startup environment validation (nodejs only)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { validateStartupEnvironment } = await import('@/lib/startup-validation');
      const result = validateStartupEnvironment();

      startupLog.info('Startup validation complete', {
        status: result.status,
        failures: result.failures,
        warnings: result.warnings,
      });

      // Tag Sentry with startup validation results
      Sentry.setTag('startup_validation', result.status);
      Sentry.setTag('startup_failures', result.failures);
    } catch (err) {
      startupLog.error('Startup validation threw', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Runtime secrets scan at boot: fails loudly in production if a secret is
    // misconfigured (e.g. a service-role key leaked to a NEXT_PUBLIC_ var).
    try {
      const { runSecretsScan } = await import('@/lib/secrets-scanning');
      const scan = runSecretsScan();
      if (!scan.passed) {
        startupLog.error('Runtime secrets scan found issues', {
          critical: scan.counts.critical,
          high: scan.counts.high,
          findings: scan.findings.map((f) => `${f.severity}:${f.source}`),
        });
        Sentry.captureMessage('Runtime secrets scan found critical/high issues', 'warning');
      } else {
        startupLog.info('Runtime secrets scan passed', { findings: scan.findings.length });
      }
    } catch (err) {
      startupLog.error('Runtime secrets scan threw', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Register graceful shutdown handlers for production
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Expose a per-instance uptime/identity gauge for the metrics endpoint.
    setGauge('app_instance_up', 1, { instance: INSTANCE_ID });
    setGauge(
      'app_build_info',
      1,
      {
        version: process.env.npm_package_version ?? 'dev',
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
        environment: process.env.NODE_ENV ?? 'development',
      }
    );

    registerGracefulShutdown();

    registerShutdownable(
      asShutdownable('redis', async () => {
        await redis.quit();
      })
    );

    registerShutdownable(
      asShutdownable('task-queue-events', async () => {
        await stopTaskQueueEvents();
      })
    );

    // Flush any pending Sentry events before process exit
    registerShutdownable(
      asShutdownable('sentry', async () => {
        await Sentry.flush(2000);
      })
    );
  }
}

export function onRequestError(
  error: unknown,
  request: { url: string; method: string; headers: Record<string, string> },
  context?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    scope.setExtra('request', request);
    if (context) {
      scope.setExtra('context', context);
    }
    Sentry.captureException(error);
  });
}
