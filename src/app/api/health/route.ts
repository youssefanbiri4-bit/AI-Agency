import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getN8nReadiness } from '@/lib/n8n';
import { reportAppError } from '@/lib/logger';

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
  // ESM-safe dynamic import instead of require()
  const fs = await import('node:fs');
  fs.accessSync('/tmp', fs.constants.W_OK);
  return true;
}

export async function GET() {
  const startTime = Date.now();

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

  try {
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
      const n8nReadiness = getN8nReadiness();

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

    const responseTime = Date.now() - startTime;
    return NextResponse.json(status, {
      status: allServicesOk ? 200 : 503,
      headers: {
        'X-Response-Time': `${responseTime}ms`,
      },
    });
  } catch (caughtError) {
    reportAppError('Health check endpoint failed', caughtError);

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        services: status.services,
      },
      { status: 500 }
    );
  }
}
