import 'server-only';
import { cache } from 'react';
import { allPages, commerceContext } from '@/features/commerce/data';
import type { Analytics, OperationalMetrics } from '@/types/database';

export const finances = cache(async () => {
 const { client } = await commerceContext();
 return allPages((from,to) => client.rpc('customer_finances').order('customer_id').range(from,to));
});
export async function operationalMetrics(period='today') {
 const { client } = await commerceContext();
 const r = await client.rpc('operational_metrics',{ p_period:period });
 if(r.error) throw new Error('Não foi possível carregar os resultados financeiros.');
 return r.data as OperationalMetrics;
}
export async function analytics(period='30days') {
 const { client } = await commerceContext();
 const r=await client.rpc('operational_analytics',{p_period:period});
 if(r.error)throw new Error('Não foi possível carregar as análises.');
 return r.data as Analytics;
}
export async function customerDebts(id:string,page=0) {
 const {client,business}=await commerceContext();
 const r=await client.from('sale_balances').select('*',{count:'exact'}).eq('business_id',business.id).eq('customer_id',id).gt('balance_cents',0).order('sold_at').order('id').range(page*50,page*50+49);
 if(r.error)throw new Error('Não foi possível carregar as pendências.');
 const sales=r.data!;
 const items=sales.length?await allPages((from,to)=>client.from('sale_items').select('*').eq('business_id',business.id).in('sale_id',sales.map(s=>s.id)).order('id').range(from,to)):[];
 const payments=await client.from('payments').select('*',{count:'exact'}).eq('business_id',business.id).eq('customer_id',id).order('paid_at',{ascending:false}).order('id').range(page*50,page*50+49);
 if(payments.error)throw new Error('Não foi possível carregar os pagamentos.');
 return {sales,items,count:r.count??0,payments:payments.data!,paymentCount:payments.count??0};
}
export async function reservations(period='today',page=0) {
 const {client,business}=await commerceContext();
 const bounds=await client.rpc('sales_period',{p_period:'today'});
 if(bounds.error||!bounds.data?.[0])throw new Error('Data indisponível.');
 const {starts_at,ends_at}=bounds.data[0];
 let q=client.from('reservations').select('*',{count:'exact'}).eq('business_id',business.id).order('scheduled_for').order('id').range(page*50,page*50+49);
 if(period==='today')q=q.gte('scheduled_for',starts_at).lt('scheduled_for',ends_at);
 else if(period==='tomorrow'){
  // Resolve the next local day through PostgreSQL; adding 24h would break configurable DST timezones.
  const next=await client.rpc('sales_period',{p_period:'today',p_anchor:ends_at});
  if(next.error||!next.data?.[0])throw new Error('Data indisponível.');
  q=q.gte('scheduled_for',next.data[0].starts_at).lt('scheduled_for',next.data[0].ends_at);
 } else if(period==='upcoming')q=q.gte('scheduled_for',ends_at);
 const r=await q;if(r.error)throw new Error('Não foi possível carregar as reservas.');
 const records=r.data!;
 const items=records.length?await allPages((from,to)=>client.from('reservation_items').select('*').eq('business_id',business.id).in('reservation_id',records.map(r=>r.id)).order('id').range(from,to)):[];
 return {records,items,count:r.count??0};
}
export async function expenses(period='month',page=0){
 const {client,business}=await commerceContext();
 const bounds=await client.rpc('sales_period',{p_period:period});
 if(bounds.error||!bounds.data?.[0])throw new Error('Período indisponível.');
 const r=await client.from('expenses').select('*',{count:'exact'}).eq('business_id',business.id).gte('incurred_at',bounds.data[0].starts_at).lt('incurred_at',bounds.data[0].ends_at).order('incurred_at',{ascending:false}).order('id').range(page*50,page*50+49);
 if(r.error)throw new Error('Não foi possível carregar as despesas.');
 return {records:r.data!,count:r.count??0};
}
