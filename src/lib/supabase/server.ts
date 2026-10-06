import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './env';
import type { Database } from '@/types/database';
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.key, { cookies: {
    getAll() { return cookieStore.getAll(); },
    setAll(items) {
      // Proxy renova cookies antes da renderização; Actions e Route Handlers podem escrevê-los.
      try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* somente leitura durante renderização */ }
    },
  } });
}
