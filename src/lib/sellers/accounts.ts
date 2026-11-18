import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/env';

export type SellerLoginAccount = { seller_id: string; username: string; deleted: boolean };
export type SellerLoginResult = { ok: boolean; message: string; username?: string; password?: string };

export async function sellerAccountRequest(action: string, input: Record<string, unknown> = {}, anonymous = false) {
  const config = getSupabaseConfig();
  const client = await createClient();
  if (!config || !client) throw new Error('A gestão de acessos ainda precisa ser configurada.');
  let bearer = config.key;
  if (!anonymous) {
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) throw new Error('Entre na conta de gerente.');
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error('Entre na conta de gerente.');
    bearer = session.access_token;
  }
  const result = await fetch(`${config.url}/functions/v1/seller-accounts`, {
    method: 'POST', headers: { apikey: config.key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, action }), cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  const data = await result.json();
  if (!result.ok || data.ok !== true) throw new Error(typeof data.message === 'string' ? data.message : 'Não foi possível concluir a gestão do acesso.');
  return data;
}

export async function listSellerLogins(): Promise<SellerLoginAccount[]> {
  return (await sellerAccountRequest('list')).accounts;
}

export async function sellerSignIn(username: string, password: string): Promise<{ access_token: string; refresh_token: string }> {
  const result = await sellerAccountRequest('login', { username, password }, true);
  return { access_token: result.access_token, refresh_token: result.refresh_token };
}
