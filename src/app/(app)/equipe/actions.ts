'use server';
import { revalidatePath } from 'next/cache';
import { sellerRPC } from '@/lib/sellers/data';
import type { SellerActionResult } from '@/lib/sellers/types';
async function perform(action: string, input: Record<string, unknown>, message: string): Promise<SellerActionResult> {
  try {
    const result = await sellerRPC<{id?: string; code?: string}>(action, input);
    revalidatePath('/equipe'); revalidatePath('/vendedor');
    return { ok: true, message, id: result?.id, inviteCode: result?.code };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Não foi possível concluir.' }; }
}
export async function createSellerAction(form: FormData) { return perform('create', { name: form.get('name'), location: form.get('location') }, 'Vendedor cadastrado. Gere um convite para vincular a conta.'); }
export async function saveSellerOfferAction(form: FormData) { return perform('offer', { seller_id: form.get('seller_id'), variant_id: form.get('variant_id'), price_cents: form.get('price_cents'), commission_cents: form.get('commission_cents'), active: form.get('active') !== 'false' }, 'Preço e comissão atualizados para as próximas vendas.'); }
export async function createSellerInviteAction(form: FormData) { return perform('invite', { seller_id: form.get('seller_id') }, 'Convite gerado. Expira em 7 dias e pode ser usado uma vez.'); }
export async function closeSellerWeekAction(form: FormData) { return perform('close', { seller_id: form.get('seller_id'), starts_on: form.get('starts_on'), ends_on: form.get('ends_on'), request_id: form.get('request_id') }, 'Semana fechada. O valor foi preservado no histórico.'); }
export async function markSellerWeekPaidAction(form: FormData) { return perform('pay', { week_id: form.get('week_id') }, 'Pagamento registrado. Este registro não transfere dinheiro.'); }
export async function cancelSellerSaleAction(form: FormData) { return perform('cancel', { sale_id: form.get('sale_id'), reason: form.get('reason') }, 'Venda cancelada com registro de auditoria.'); }
export async function toggleSellerAction(form: FormData) { return perform('toggle', { seller_id: form.get('seller_id'), active: form.get('active') === 'true' }, 'Situação do vendedor atualizada.'); }
