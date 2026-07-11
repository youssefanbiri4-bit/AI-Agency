/**
 * Production Gate
 *
 * Central security layer that must be passed before any sensitive production
 * operations (task execution, publishing, image generation, paid ads, etc.).
 *
 * Green = fully ready for production
 * Yellow = warnings but some operations may proceed (internal use)
 * Red = blocked - operations must be halted
 */

import 'server-only';

import { getProductionReadiness, type ProductionReadinessResult } from '@/lib/production-readiness';
import { getIntegrationSettings } from '@/lib/data/workspaces';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

const gateLog = logger.child('production:gate');

export type GateStatus = 'green' | 'yellow' | 'red';

export interface GateCheck {
  key: string;
  label: string;
  status: 'ready' | 'warning' | 'blocked';
  message: string;
}

export interface GateResult {
  passed: boolean;
  status: GateStatus;
  issues: string[];
  checks: GateCheck[];
  lightweight: {
    envOk: boolean;
    n8nOk: boolean;
    supabaseOk: boolean;
  };
  productionReadiness?: ProductionReadinessResult;
  quotas?: {
    maxDailyAdSpend: number | null;
    paidAdsEnabled: boolean;
  };
  domainOk: boolean;
  checkedAt: string;
}

const CRITICAL_ENV_VARS = [
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

function checkEnvVars(): { ok: boolean; missing: string[] } {
  const missing = CRITICAL_ENV_VARS.filter((key) => !process.env[key] || process.env[key]!.trim() === '');
  return { ok: missing.length === 0, missing };
}

async function checkN8nLight(): Promise<boolean> {
  // Lightweight: presence of webhook / base url
  const hasWebhook = !!process.env.N8N_WEBHOOK_URL || !!process.env.N8N_TASK_WEBHOOK;
  const hasBase = !!process.env.N8N_BASE_URL || !!process.env.N8N_URL;
  return hasWebhook || hasBase;
}

async function checkSupabaseLight(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    // simple health: try to read a public table or just assume if client created
    const { error } = await supabase.from('profiles').select('id').limit(1);
    return !error || error.code === 'PGRST116'; // table may not exist but connection ok
  } catch {
    return false;
  }
}

export async function checkLightweightGate(): Promise<{
  passed: boolean;
  envOk: boolean;
  n8nOk: boolean;
  supabaseOk: boolean;
  issues: string[];
}> {
  const envCheck = checkEnvVars();
  const n8nOk = await checkN8nLight();
  const supabaseOk = await checkSupabaseLight();

  const issues: string[] = [];
  if (!envCheck.ok) issues.push(`Missing critical env vars: ${envCheck.missing.join(', ')}`);
  if (!n8nOk) issues.push('n8n not configured (missing N8N_WEBHOOK_URL or N8N_BASE_URL)');
  if (!supabaseOk) issues.push('Supabase server client not healthy');

  const passed = issues.length === 0;

  return {
    passed,
    envOk: envCheck.ok,
    n8nOk,
    supabaseOk,
    issues,
  };
}

export async function checkProductionGate(
  workspaceId: string,
  supabase?: SupabaseClient<Database>
): Promise<GateResult> {
  const lightweight = await checkLightweightGate();
  const checks: GateCheck[] = [];

  // Lightweight checks
  checks.push({
    key: 'lightweight:env',
    label: 'Environment Variables',
    status: lightweight.envOk ? 'ready' : 'blocked',
    message: lightweight.envOk ? 'All critical environment variables present' : lightweight.issues.filter(i => i.includes('env')).join('; '),
  });
  checks.push({
    key: 'lightweight:n8n',
    label: 'n8n Configuration',
    status: lightweight.n8nOk ? 'ready' : 'blocked',
    message: lightweight.n8nOk ? 'n8n endpoints detected' : 'n8n webhook/base URL missing',
  });
  checks.push({
    key: 'lightweight:supabase',
    label: 'Supabase Connectivity',
    status: lightweight.supabaseOk ? 'ready' : 'blocked',
    message: lightweight.supabaseOk ? 'Supabase server client responding' : 'Supabase server connection issue',
  });

  let prodReadiness: ProductionReadinessResult | undefined;
  let domainOk = true;
  let quotas = { maxDailyAdSpend: null as number | null, paidAdsEnabled: false };

  try {
    // Full production readiness
    const readinessClient = supabase || (await createSupabaseServerClient());
    const {
      data: { user: readinessUser },
    } = await readinessClient.auth.getUser();
    prodReadiness = await getProductionReadiness({
      supabase: readinessClient,
      workspaceId,
      userId: readinessUser?.id ?? workspaceId,
    });

    // Map some checks
    const hasBlockers = prodReadiness.blockers.length > 0;
    checks.push({
      key: 'full:production-readiness',
      label: 'Production Readiness',
      status: hasBlockers ? 'blocked' : (prodReadiness.overallStatus === 'warning' ? 'warning' : 'ready'),
      message: hasBlockers 
        ? `Blockers: ${prodReadiness.blockers.slice(0, 3).join(', ')}` 
        : 'Production readiness checks passed',
    });

    // Domain check
    const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || '';
    domainOk = !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1') && !baseUrl.includes('vercel.app') || baseUrl.length > 0;
    if (!domainOk) {
      checks.push({
        key: 'domain',
        label: 'Custom Domain',
        status: 'warning',
        message: 'APP_BASE_URL appears to be localhost or default Vercel domain. Use a production custom domain.',
      });
    } else {
      checks.push({
        key: 'domain',
        label: 'Custom Domain',
        status: 'ready',
        message: 'Production domain detected',
      });
    }

    // Quotas / spend controls from integration settings
    const client = supabase || (await createSupabaseServerClient());
    const settingsRes = await getIntegrationSettings(client, workspaceId);
    const prodOps = (settingsRes.data?.settings?.production_operations ?? {}) as Record<string, unknown>;
    quotas = {
      maxDailyAdSpend: typeof prodOps.max_daily_ad_spend === 'number' ? prodOps.max_daily_ad_spend : null,
      paidAdsEnabled: Boolean(prodOps.paid_ads_enabled),
    };

    const launchMode = typeof prodOps.launch_mode === 'string' ? prodOps.launch_mode : 'blocked';
    if (launchMode === 'blocked') {
      checks.push({
        key: 'launch-mode',
        label: 'Launch Mode',
        status: 'blocked',
        message: 'launch_mode is "blocked". Production operations are disabled.',
      });
    } else if (launchMode === 'internal') {
      checks.push({
        key: 'launch-mode',
        label: 'Launch Mode',
        status: 'warning',
        message: 'Running in internal mode (safe for testing, limited for real clients).',
      });
    } else {
      checks.push({
        key: 'launch-mode',
        label: 'Launch Mode',
        status: 'ready',
        message: 'Production launch mode enabled.',
      });
    }
  } catch (err) {
    gateLog.warn('Error fetching full production readiness', { workspaceId, error: (err as Error).message });
    checks.push({
      key: 'full:production-readiness',
      label: 'Production Readiness',
      status: 'blocked',
      message: 'Failed to load full production checks. ' + (err as Error).message,
    });
  }

  const allIssues = [
    ...lightweight.issues,
    ...checks.filter(c => c.status === 'blocked').map(c => c.message),
  ];

  let status: GateStatus = 'green';
  if (allIssues.length > 0) {
    status = checks.some(c => c.status === 'blocked') ? 'red' : 'yellow';
  }

  const passed = status !== 'red';

  const result: GateResult = {
    passed,
    status,
    issues: allIssues,
    checks,
    lightweight: {
      envOk: lightweight.envOk,
      n8nOk: lightweight.n8nOk,
      supabaseOk: lightweight.supabaseOk,
    },
    productionReadiness: prodReadiness,
    quotas,
    domainOk,
    checkedAt: new Date().toISOString(),
  };

  gateLog.info('Production gate evaluated', {
    workspaceId,
    status: result.status,
    passed: result.passed,
    issueCount: result.issues.length,
  });

  return result;
}

export async function assertProductionGate(workspaceId: string): Promise<void> {
  const gate = await checkProductionGate(workspaceId);
  if (!gate.passed) {
    const errorMsg = `Production Gate blocked operation: ${gate.issues.join(' | ')}`;
    gateLog.error(errorMsg, { workspaceId, status: gate.status });
    throw new Error(errorMsg);
  }
}

export async function getGateStatusForUI(workspaceId: string): Promise<{
  status: GateStatus;
  summary: string;
  issues: string[];
  color: string;
}> {
  const gate = await checkProductionGate(workspaceId);
  let summary = 'Production ready';
  let color = 'green';

  if (gate.status === 'red') {
    summary = 'Production blocked';
    color = 'red';
  } else if (gate.status === 'yellow') {
    summary = 'Production ready with warnings';
    color = 'yellow';
  }

  return {
    status: gate.status,
    summary,
    issues: gate.issues,
    color,
  };
}
