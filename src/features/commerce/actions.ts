'use server';
import { revalidatePath } from 'next/cache';
import { commerceContext } from './data';
import { brlToCents } from '@/lib/money';
import type { PostgrestError } from '@supabase/supabase-js';
export type Result = { error?: string; id?: string; total?: number };
const uuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function name(value: string) { const normalized = value.trim().replace(/\s+/g, ' '); if (!normalized || normalized.length > 100) throw new Error('Informe um nome de até 100 caracteres.'); return normalized; }
function optional(value: string, max = 2000) { const text = value.trim(); if (text.length > max) throw new Error(`Use até ${max} caracteres.`); return text || null; }
function failure(error: PostgrestError): Result {
  if (error.code === '23505') return { error: 'Esse nome já está cadastrado. Escolha outro nome ou reative o cadastro existente.' };
  if (error.code === '22023') return { error: error.message };
  if (error.code === '23503') return { error: 'Um dos cadastros selecionados não está disponível no seu negócio.' };
  return { error: 'Não foi possível salvar. Revise os dados e tente novamente.' };
}
function changed() { revalidatePath('/', 'layout'); }
export async function saveSimple(kind: 'customers' | 'categories' | 'locations', input: { id?: string; name: string; phone?: string; notes?: string; active?: boolean }): Promise<Result> {
  const { client, business } = await commerceContext();
  if (!['customers', 'categories', 'locations'].includes(kind)) return { error: 'Cadastro inválido.' };
  try {
    if (input.id && !uuid(input.id)) throw new Error('Cadastro inválido.');
    const common = { name: name(input.name), active: input.active ?? true };
    let result;
    if (kind === 'customers') {
      const phone = optional(input.phone ?? '', 30)?.replace(/[\s().-]/g, '') ?? null;
      if (phone && !/^\+?\d{6,20}$/.test(phone)) throw new Error('Informe um telefone válido, com DDD quando necessário.');
      const values = { ...common, phone, notes: optional(input.notes ?? '') };
      result = input.id ? await client.from('customers').update(values).eq('id', input.id).eq('business_id', business.id).select('id').single() : await client.from('customers').insert({ ...values, business_id: business.id }).select('id').single();
    } else {
      result = input.id ? await client.from(kind).update(common).eq('id', input.id).eq('business_id', business.id).select('id').single() : await client.from(kind).insert({ ...common, business_id: business.id }).select('id').single();
    }
    if (result.error) return failure(result.error);
    changed(); return { id: result.data!.id };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Revise os dados.' }; }
}
export async function saveProduct(input: { id?: string; name: string; categoryId: string; description: string; active: boolean; variants: { id?: string; name: string; price: string; cost: string; active: boolean }[] }): Promise<Result> {
  const { client } = await commerceContext();
  try {
    if ((input.id && !uuid(input.id)) || (input.categoryId && !uuid(input.categoryId)) || !input.variants.length || input.variants.length > 50) throw new Error('Revise o produto e seus sabores.');
    const variants = input.variants.map(v => {
      if (v.id && !uuid(v.id)) throw new Error('Sabor inválido.');
      const price = brlToCents(v.price), cost = brlToCents(v.cost);
      if (price > 1_000_000_000 || cost > 1_000_000_000) throw new Error('Preço acima do limite permitido.');
      return { id: v.id ?? null, name: name(v.name), sale_price_cents: price, cost_price_cents: cost, active: v.active };
    });
    const result = await client.rpc('save_product', { p_id: input.id ?? null, p_name: name(input.name), p_category_id: input.categoryId || null, p_description: optional(input.description), p_active: input.active, p_variants: variants });
    if (result.error) return failure(result.error);
    changed(); return { id: result.data! };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Revise os dados.' }; }
}
export async function toggleProduct(id: string, active: boolean): Promise<Result> {
  const { client, business } = await commerceContext();
  if (!uuid(id) || typeof active !== 'boolean') return { error: 'Produto inválido.' };
  const result = await client.from('products').update({ active }).eq('business_id', business.id).eq('id', id).select('id').single();
  if (result.error) return failure(result.error);
  changed(); return { id };
}
export async function createSale(input: { requestId: string; items: { variant_id: string; quantity: number }[]; customerId: string; locationId: string; payment: string; notes: string }): Promise<Result> {
  const { client } = await commerceContext();
  if (!uuid(input.requestId) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100 || input.items.some(i => !uuid(i.variant_id) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 9999) || !['pix', 'cash', 'card', 'credit', 'other'].includes(input.payment) || (input.customerId && !uuid(input.customerId)) || (input.locationId && !uuid(input.locationId))) return { error: 'Revise o carrinho e o pagamento.' };
  if(input.payment==='credit'&&!input.customerId)return {error:'Escolha um cliente para registrar fiado.'};
  try {
    const result = await client.rpc('create_sale', { p_request_id: input.requestId, p_items: input.items.map(i => ({ variant_id: i.variant_id, quantity: i.quantity })), p_customer_id: input.customerId || null, p_location_id: input.locationId || null, p_payment_method: input.payment, p_notes: optional(input.notes) });
    if (result.error) return failure(result.error);
    const saved = await client.from('sales').select('total_cents').eq('id', result.data!).single();
    if (saved.error) return { error: 'A confirmação não chegou. Tente novamente para verificar a mesma venda.' };
    changed(); return { id: result.data!, total: saved.data.total_cents };
  } catch { return { error: 'Não foi possível confirmar a venda. Tente novamente; a mesma tentativa não duplica a venda.' }; }
}
