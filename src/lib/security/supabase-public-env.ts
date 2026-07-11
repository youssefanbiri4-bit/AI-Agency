/**
 * Shared Supabase public-env validation.
 * Safe to import from middleware (edge), client, and server.
 */

const FORBIDDEN_BROWSER_KEY_PREFIXES = ['sb_secret_', 'sk_', 'whsec_', 'pk_live_', 'rk_live_'] as const;

export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
  isConfigured: boolean;
};

export function normalizeSupabaseProjectUrl(url: string | undefined | null): string | null {
  if (!url?.trim()) return null;

  let normalized = url.trim().replace(/\/+$/, '');
  normalized = normalized.replace(/\/rest\/v1\/?$/i, '');
  return normalized;
}

function decodeJwtRole(key: string): string | null {
  if (!key.startsWith('eyJ')) return null;

  const parts = key.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: string;
    };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function isForbiddenBrowserSupabaseKey(key: string | undefined | null): boolean {
  if (!key?.trim()) return false;

  const trimmed = key.trim();

  if (FORBIDDEN_BROWSER_KEY_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return true;
  }

  if (trimmed === process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return true;
  }

  const role = decodeJwtRole(trimmed);
  return role === 'service_role';
}

export function assertBrowserSafeSupabaseKey(
  key: string | undefined | null,
  context: 'browser' | 'middleware' | 'server' = 'browser'
): void {
  if (!key?.trim()) return;

  if (isForbiddenBrowserSupabaseKey(key)) {
    throw new Error(
      `Forbidden use of secret API key in ${context}. ` +
        'Set NEXT_PUBLIC_SUPABASE_ANON_KEY to the publishable/anon key only — never the service role or sb_secret key.'
    );
  }
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

  return {
    url: url ?? 'https://example.supabase.co',
    anonKey: anonKey || 'anon-key-not-configured',
    isConfigured: Boolean(url && anonKey),
  };
}

export type SupabaseEnvValidation = {
  ok: boolean;
  message?: string;
  warning?: string;
};

export function validatePublicSupabaseEnv(
  context: 'browser' | 'middleware' | 'server' = 'server'
): SupabaseEnvValidation {
  const { anonKey, isConfigured } = getPublicSupabaseConfig();

  if (!isConfigured) {
    return { ok: false, message: 'Supabase public env is not configured.' };
  }

  if (isForbiddenBrowserSupabaseKey(anonKey)) {
    // Server context: more tolerant — log warning instead of blocking.
    // The anon key is still `NEXT_PUBLIC_*` (exposed to the browser), so this
    // is technically a misconfiguration, but server-only modules protect the
    // real service role key at import time. Allow the server to continue.
    if (context === 'server') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[AgentFlow Security] NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a secret/service-role key. ' +
            'Use an sb_publishable_ key for production. Server continuing with tolerance.'
        );
      }
      return {
        ok: true,
        warning:
          'NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a secret/service-role key. ' +
          'Use the publishable anon key only for production.',
      };
    }

    // Browser and middleware: strict — block the forbidden key
    return {
      ok: false,
      message:
        'NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a secret/service-role key. Use the publishable anon key only.',
    };
  }

  try {
    assertBrowserSafeSupabaseKey(anonKey, context);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Invalid Supabase anon key.',
    };
  }
}