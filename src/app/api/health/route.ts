import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getN8nReadiness } from '@/lib/n8n';
import { reportAppError } from '@/lib/logger';
import { getRequestId, createApiSuccess, createApiError } from '@/lib/api-response';
import { checkRateLimit } from '@/lib/rate-limit';

type ServiceStatus = 'unknown' | 'ok' | 'error';

type ServiceState = {
  status: ServiceStatus;
  message?: string;
};

type HealthStatus = {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  services: {
    database: ServiceState;
    supabase: ServiceState;
    n8n: ServiceState;
    storage: ServiceState;
    env: ServiceState;
  };
};

async function canWriteTmp(): Promise<boolean> {
  const fs = await import('node:fs');
  fs.accessSync('/tmp', fs.constants.W_OK);
  return true;
}

/** Check whether the incoming request carries a valid user session. */
async function isAuthenticated(req: Request): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return !!data?.user;
  } catch {
    return false;
  }
}

/** Build the full detailed health status (may leak internal details — behind auth). */
async function buildDetailedHealth(): Promise<HealthStatus> {
  const status: HealthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown' },
      supabase: { status: 'unknown' },
      n8n: { status: 'unknown' },
      storage: { status: 'unknown' },
      env: { status: 'unknown' },
    },
  };

  const requiredEnvVars = ['N8N_WEBHOOK_URL', 'N8N_CALLBACK_SECRET'] as const;

  const missingEnvVars = requiredEnvVars.filter(
    (varName) => !process.env[varName] || process.env[varName]?.trim() === ''
  );

  status.services.env.status = missingEnvVars.length === 0 ? 'ok' : 'error';
  if (missingEnvVars.length > 0) {
    status.services.env.message = `Missing environment variables: ${missingEnvVars.join(', ')}`;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('workspaces').select('count').limit(1);

    if (error) throw error;

    status.services.supabase.status = 'ok';
  } catch (caughtError) {
    reportAppError('Health check: Supabase connection failed', caughtError);
    status.services.supabase.status = 'error';
    status.services.supabase.message =
      caughtError instanceof Error ? caughtError.message : 'Unknown error';
  }

  status.services.database.status = status.services.supabase.status;

  try {
    const n8nReadiness = await getN8nReadiness();

    if (!n8nReadiness.canExecute) {
      status.services.n8n.status = 'error';
      status.services.n8n.message = n8nReadiness.message;
    } else {
      status.services.n8n.status = 'ok';
    }
  } catch (caughtError) {
    reportAppError('Health check: n8n readiness check failed', caughtError);
    status.services.n8n.status = 'error';
    status.services.n8n.message =
      caughtError instanceof Error ? caughtError.message : 'Unknown error';
  }

  try {
    await canWriteTmp();
    status.services.storage.status = 'ok';
  } catch (caughtError) {
    status.services.storage.status = 'error';
    status.services.storage.message =
      caughtError instanceof Error ? caughtError.message : 'Unknown error';
  }

  const allServicesOk = Object.values(status.services).every(
    (service) => service.status === 'ok'
  );

  status.status = allServicesOk ? 'ok' : 'degraded';
  return status;
}

export async function GET(req: Request) {
  const startTime = Date.now();
  const requestId = getRequestId(req);

  // Lightweight rate limiting: 60 req/min per IP
  const clientIp =
    req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  const rateLimitResult = await checkRateLimit({
    key: `api:health:${clientIp}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimitResult.allowed) {
    return createApiError('Rate limit exceeded', {
      status: 429,
      requestId,
      extra: {
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      },
    });
  }

  const timestamp = new Date().toISOString();

  try {
    const authenticated = await isAuthenticated(req);

    if (authenticated) {
      // Authenticated: return full detailed health including service statuses
      const detailed = await buildDetailedHealth();
      const allOk = detailed.status === 'ok';

      return createApiSuccess(detailed, {
        requestId,
        status: allOk ? 200 : 503,
        headers: { 'X-Response-Time': `${Date.now() - startTime}ms` },
      });
    }

    // Public: return minimal safe status (no internal details)
    return createApiSuccess(
      { status: 'ok', timestamp },
      {
        requestId,
        status: 200,
        headers: { 'X-Response-Time': `${Date.now() - startTime}ms` },
      }
    );
  } catch (caughtError) {
    reportAppError('Health check endpoint failed', caughtError);

    // Never leak internal details to any caller
    return createApiError('Health check failed', {
      status: 500,
      requestId,
      extra: {
        status: 'error',
        timestamp,
      },
    });
  }
}
