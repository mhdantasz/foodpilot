'use server';
import { revalidatePath } from 'next/cache';
import { sellerRPC } from '@/lib/sellers/data';
import type { SellerActionResult } from '@/lib/sellers/types';
export async function recordSellerSaleAction(form: FormData): Promise<SellerActionResult> {
  try {
    const raw = form.get('items');
    if (typeof raw !== 'string' || raw.length > 20000) throw new Error('Revise os produtos da venda.');
    const items: unknown = JSON.parse(raw);
    const result = await sellerRPC<{id: string}>('sale', { request_id: form.get('request_id'), payment_method: form.get('payment_method'), items });
    revalidatePath('/vendedor'); revalidatePath('/equipe');
    return { ok: true, id: result.id, message: 'Venda registrada. Confirme o recebimento na maquininha.' };
  } catch (error) { return { ok: false, message: error instanceof SyntaxError ? 'Revise os produtos da venda.' : error instanceof Error ? error.message : 'Não foi possível registrar.' }; }
}
export async function acceptSellerInviteAction(form: FormData): Promise<SellerActionResult> {
  try {
    await sellerRPC('accept', { code: form.get('code') });
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Conta vinculada. Você já pode abrir seu painel de vendedor.' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Não foi possível aceitar o convite.' }; }
}
