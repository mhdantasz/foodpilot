'use client';
import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from './env';
import type { Database } from '@/types/database';
export function createClient() {
  const config = getSupabaseConfig();
  return config ? createBrowserClient<Database>(config.url, config.key) : null;
}
