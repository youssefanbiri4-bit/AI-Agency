'use client';

import { useEffect } from 'react';
import { getBrowserSupabaseEnvStatus } from '@/lib/supabase-client';

/**
 * Dev/runtime guard: surfaces misconfigured NEXT_PUBLIC_SUPABASE_ANON_KEY in the browser.
 * Secret/service-role keys must never be exposed via NEXT_PUBLIC_* variables.
 */
export function BrowserSecretGuard() {
  useEffect(() => {
    const status = getBrowserSupabaseEnvStatus();
    if (!status.ok && status.message) {
      console.error(`[AgentFlow Security] ${status.message}`);
    }
  }, []);

  return null;
}