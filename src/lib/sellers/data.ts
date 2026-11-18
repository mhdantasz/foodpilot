import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SellerAccess, SellerPortal, TeamDashboard } from './types';

type RPCClient = { rpc: (name: 'seller_operation', args: { p_action: string; p_input: Record<string, unknown> }) => PromiseLike<{ data: unknown; error: { message: string; code?: string }|null }> };
// Narrow additive RPC contract; existing generated schema is deliberately untouched.
export async function sellerRPC<T>(action: string, input: Record<string, unknown> = {}): Promise<T> {
  const client = await createClient();
  if (!client) throw new Error('Conexão indisponível. Configure o Supabase para usar a equipe.');
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Entre na sua conta para continuar.');
  const result = await (client as unknown as RPCClient).rpc('seller_operation', { p_action: action, p_input: input });
  if (result.error) {
    if (result.error.code === '22023' || result.error.code === '42501') throw new Error(result.error.message);
    if (['PGRST202','42883','42P01'].includes(result.error.code ?? '')) throw new Error('O módulo de equipe ainda precisa da atualização do banco.');
    throw new Error('Não foi possível concluir a operação da equipe. Revise os dados e tente novamente.');
  }
  return result.data as T;
}
export async function getSellerAccess(): Promise<SellerAccess|null> {
  const client = await createClient();
  if (!client) return null;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const result = await (client as unknown as RPCClient).rpc('seller_operation', { p_action: 'access', p_input: {} });
  if (result.error) {
    // Existing personal app remains usable before the additive migration is deployed.
    if (['PGRST202','42883','42P01'].includes(result.error.code ?? '')) return null;
    throw new Error('Não foi possível verificar seu acesso à equipe. Tente novamente.');
  }
  return result.data as SellerAccess|null;
}
export async function getTeamDashboard(from?: string, to?: string): Promise<TeamDashboard> { return sellerRPC('team', { from, to }); }
export async function getSellerPortal(from?: string, to?: string): Promise<SellerPortal> { return sellerRPC('portal', { from, to }); }
