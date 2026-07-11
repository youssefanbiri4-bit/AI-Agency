import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  createSupabaseServerClient,
  isSupabaseServerConfigured,
} from '@/lib/supabase-server';

export type DataSupabaseClient = SupabaseClient<Database>;

export function isDataSupabaseConfigured(): boolean {
  return isSupabaseServerConfigured;
}

export async function resolveDataClient(
  client?: DataSupabaseClient
): Promise<DataSupabaseClient | null> {
  if (client) return client;
  if (!isSupabaseServerConfigured) return null;
  return createSupabaseServerClient();
}