'use server';
import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { sellerAccountRequest, type SellerLoginResult } from '@/lib/sellers/accounts';

function value(form: FormData, key: string) { const item = form.get(key); return typeof item === 'string' ? item : ''; }
export async function provisionSellerLoginAction(form: FormData): Promise<SellerLoginResult> {
  try {
    const password = value(form, 'generate_pin') === 'true' ? String(randomInt(0, 100000)).padStart(5, '0') : value(form, 'password');
    if (password.length < 5 || password.length > 128) return { ok: false, message: 'Use uma senha de 5 a 128 caracteres.' };
    const result = await sellerAccountRequest('create', { seller_id: value(form, 'seller_id'), name: value(form, 'name'), username: value(form, 'username'), password });
    revalidatePath('/equipe'); revalidatePath('/vendedor');
    return { ok: true, message: result.message, username: result.username, password };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Não foi possível gerar o acesso.' }; }
}
export async function deleteSellerLoginAction(form: FormData): Promise<SellerLoginResult> {
  try {
    const result = await sellerAccountRequest('delete', { seller_id: value(form, 'seller_id') });
    revalidatePath('/equipe'); revalidatePath('/vendedor');
    return { ok: true, message: result.message };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Não foi possível excluir o acesso.' }; }
}
