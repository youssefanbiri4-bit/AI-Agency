'use server';

import { revalidatePath } from 'next/cache';
import type { JsonObject } from '@/types';
import {
  getRBACContext,
  hasPermission,
} from '@/lib/auth/rbac';
import {
  PRODUCTION_OPERATIONS_SETTINGS_KEY,
  clearProductionReadinessCache,
  defaultSpendControlSettings,
  getProductionReadiness,
  normalizeSpendControlSettings,
  serializeSpendControlSettings,
  type LaunchMode,
  type PaidProvider,
  type SpendControlSettings,
} from '@/lib/production-readiness';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';

export interface ProductionSettingsState {
  ok: boolean;
  message: string | null;
  error: string | null;
}

function readLaunchMode(value: FormDataEntryValue | null): LaunchMode {
  return value === 'internal' || value === 'production' ? value : 'blocked';
}

function readPaidProviders(formData: FormData): PaidProvider[] {
  return formData
    .getAll('allowed_providers')
    .filter((value): value is PaidProvider =>
      value === 'meta' || value === 'google_ads' || value === 'pinterest'
    );
}

function readSpendLimit(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function hasBlockingChecks(checks: Array<{ status: string }>) {
  return checks.some((check) => check.status !== 'ready');
}

function validateSettingsUpdate({
  requested,
  readiness,
}: {
  requested: SpendControlSettings;
  readiness: Awaited<ReturnType<typeof getProductionReadiness>>;
}) {
  const errors: string[] = [];
  const coreChecks = [
    ...readiness.env,
    ...readiness.migrations,
    ...readiness.security,
    ...readiness.rateLimits,
    ...readiness.providers,
    ...readiness.backups,
    ...readiness.monitoring,
  ];

  if (requested.launch_mode === 'production' && hasBlockingChecks(coreChecks)) {
    errors.push('لا يمكن تفعيل وضع الإنتاج حتى تصبح env/migrations/security/rate limits/providers/backups/monitoring كلها جاهزة.');
  }

  if (requested.paid_ads_enabled) {
    if (requested.launch_mode !== 'production') {
      errors.push('Paid ads require launch_mode=production.');
    }

    if (!requested.max_daily_ad_spend || requested.max_daily_ad_spend <= 0) {
      errors.push('Paid ads require a positive max_daily_ad_spend.');
    }

    if (!requested.require_manual_confirmation) {
      errors.push('Paid ads require manual confirmation.');
    }

    if (requested.allowed_providers.length === 0) {
      errors.push('Paid ads require at least one allowed provider.');
    }

    if (hasBlockingChecks(readiness.rateLimits)) {
      errors.push('Paid ads require persistent Upstash/Redis rate limits.');
    }

    if (hasBlockingChecks(readiness.providers)) {
      errors.push('Paid ads require all provider readiness checks to be green.');
    }

    if (hasBlockingChecks(readiness.backups)) {
      errors.push('Paid ads require a latest successful backup.');
    }
  }

  return errors;
}

export async function updateProductionOperationsSettingsAction(
  _state: ProductionSettingsState,
  formData: FormData
): Promise<ProductionSettingsState> {
  const access = await getRBACContext();

  if (access.error || !access.data) {
    return {
      ok: false,
      message: null,
      error: 'Authentication and an active workspace are required. خاص تسجيل الدخول ومساحة عمل نشطة.',
    };
  }

  if (!hasPermission(access.data.role, 'admin')) {
    await logSecurityAuditEvent({
      supabase: access.data.supabase,
      workspaceId: access.data.workspace.id,
      userId: access.data.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'production_settings',
      message: 'Blocked Production Operations settings update.',
      metadata: { role: access.data.role },
    });

    return {
      ok: false,
      message: null,
      error: 'Only owner/admin can update production operations settings. فقط المالك أو المدير.',
    };
  }

  const requested = normalizeSpendControlSettings({
    launch_mode: readLaunchMode(formData.get('launch_mode')),
    paid_ads_enabled: formData.get('paid_ads_enabled') === 'on',
    max_daily_ad_spend: readSpendLimit(formData.get('max_daily_ad_spend')),
    require_manual_confirmation: formData.get('require_manual_confirmation') === 'on',
    allowed_providers: readPaidProviders(formData),
  });
  const readiness = await getProductionReadiness({
    supabase: access.data.supabase,
    workspaceId: access.data.workspace.id,
    userId: access.data.user.id,
  });
  const validationErrors = validateSettingsUpdate({ requested, readiness });

  if (validationErrors.length > 0) {
    await logSecurityAuditEvent({
      supabase: access.data.supabase,
      workspaceId: access.data.workspace.id,
      userId: access.data.user.id,
      eventType: 'production_settings_update_blocked',
      severity: 'warning',
      entityType: 'production_settings',
      message: 'Production settings update blocked by launch gate.',
      metadata: {
        requested_launch_mode: requested.launch_mode,
        requested_paid_ads_enabled: requested.paid_ads_enabled,
        error_count: validationErrors.length,
      },
    });

    return {
      ok: false,
      message: null,
      error: validationErrors.join(' '),
    };
  }

  const { data: existing, error: readError } = await access.data.supabase
    .from('integration_settings')
    .select('settings')
    .eq('workspace_id', access.data.workspace.id)
    .maybeSingle();

  if (readError) {
    return {
      ok: false,
      message: null,
      error: 'Production settings could not be loaded.',
    };
  }

  const existingSettings = readObject(existing?.settings);
  const mergedSettings: JsonObject = {
    ...existingSettings,
    [PRODUCTION_OPERATIONS_SETTINGS_KEY]: serializeSpendControlSettings({
      ...defaultSpendControlSettings,
      ...requested,
    }),
  };
  const { error: writeError } = await access.data.supabase.from('integration_settings').upsert({
    workspace_id: access.data.workspace.id,
    settings: mergedSettings,
    updated_by: access.data.user.id,
  });

  if (writeError) {
    return {
      ok: false,
      message: null,
      error: 'Production settings could not be saved.',
    };
  }

  await logSecurityAuditEvent({
    supabase: access.data.supabase,
    workspaceId: access.data.workspace.id,
    userId: access.data.user.id,
    eventType: 'production_settings_updated',
    severity: 'info',
    entityType: 'production_settings',
    message: 'Production Operations settings updated.',
    metadata: {
      launch_mode: requested.launch_mode,
      paid_ads_enabled: requested.paid_ads_enabled,
      allowed_provider_count: requested.allowed_providers.length,
      has_daily_spend_limit: typeof requested.max_daily_ad_spend === 'number',
    },
  });

  revalidatePath('/dashboard/production');
  revalidatePath('/dashboard', 'layout');
  clearProductionReadinessCache(access.data.workspace.id);

  return {
    ok: true,
    message: 'Production Operations settings saved. تم حفظ إعدادات الإنتاج.',
    error: null,
  };
}

export async function refreshProductionReadinessAction() {
  const access = await getRBACContext();

  if (access.data) {
    clearProductionReadinessCache(access.data.workspace.id, access.data.user.id);
  }

  revalidatePath('/dashboard/production');
}
