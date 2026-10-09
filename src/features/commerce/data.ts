import 'server-only';
import { requireBusiness } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import type { Metrics } from '@/types/database';
import { cache } from 'react';

export async function allPages<T>(fetch: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const result = await fetch(offset, offset + 999);
    if (result.error || !result.data) throw new Error('Não foi possível carregar os cadastros. Tente novamente.');
    rows.push(...result.data);
    if (result.data.length < 1000) return rows;
  }
  throw new Error('Este catálogo precisa de paginação adicional. Entre em contato com o suporte.');
}

export const commerceContext = cache(async () => {
  const context = await requireBusiness();
  const client = await createClient();
  if (!client) throw new Error('Conexão indisponível.');
  return { ...context, client };
});
export const catalogData = cache(async () => {
  const { client, business } = await commerceContext();
  const results = await Promise.all([
    allPages((from, to) => client.from('products').select('*').eq('business_id', business.id).order('name').order('id').range(from, to)),
    allPages((from, to) => client.from('product_variants').select('*').eq('business_id', business.id).order('name').order('id').range(from, to)),
    allPages((from, to) => client.from('categories').select('*').eq('business_id', business.id).order('sort_order').order('name').order('id').range(from, to)),
  ]);
  return { products: results[0], variants: results[1], categories: results[2] };
});
export const peopleData = cache(async () => {
  const { client, business } = await commerceContext();
  const [customers, locations, summaries] = await Promise.all([
    allPages((from, to) => client.from('customers').select('*').eq('business_id', business.id).order('name').order('id').range(from, to)),
    allPages((from, to) => client.from('locations').select('*').eq('business_id', business.id).order('name').order('id').range(from, to)),
    allPages((from, to) => client.rpc('customer_summaries').order('customer_id').range(from, to)),
  ]);
  return { customers, locations, summaries };
});
export const salesPeople = cache(async () => {
  const {client,business}=await commerceContext();
  const [customers,locations]=await Promise.all([
    allPages((from,to)=>client.from('customers').select('id,name').eq('business_id',business.id).order('id').range(from,to)),
    allPages((from,to)=>client.from('locations').select('id,name').eq('business_id',business.id).order('id').range(from,to)),
  ]);
  return {customers,locations};
});
export async function metrics(period = 'today', customerId: string | null = null) {
  const { client } = await commerceContext();
  const result = await client.rpc('sales_metrics', { p_period: period, p_customer_id: customerId });
  if (result.error) throw new Error('Não foi possível carregar os resultados.');
  return result.data as Metrics;
}
export async function salesData(period: string, customerId?: string, page = 0, limit = 50) {
  const { client, business } = await commerceContext();
  let query = client.from('sales').select('*', { count: 'exact' }).eq('business_id', business.id).order('sold_at', { ascending: false }).order('id').range(page * limit, page * limit + limit - 1);
  if (customerId) query = query.eq('customer_id', customerId);
  if (period !== 'all') {
    const { data, error } = await client.rpc('sales_period', { p_period: period });
    if (error || !data?.[0]) throw new Error('Período indisponível.');
    query = query.gte('sold_at', data[0].starts_at).lt('sold_at', data[0].ends_at);
  }
  const result = await query;
  if (result.error) throw new Error('Não foi possível carregar as vendas.');
  const sales = result.data!;
  const items = sales.length ? await allPages((from, to) => client.from('sale_items').select('*').eq('business_id', business.id).in('sale_id', sales.map(s => s.id)).order('created_at').order('id').range(from, to)) : [];
  return { sales, items, count: result.count ?? 0, timezone: business.timezone };
}
