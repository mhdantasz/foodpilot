import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import { integrationConfig } from './test-env.mjs';
const config=integrationConfig();if(!config)throw new Error('Configure as contas dedicadas A/B.');
const client=()=>createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}}),results=[],tenants=[],run=randomUUID().slice(0,8);
const ok=async promise=>{const r=await promise;assert.equal(r.error,null,r.error?.message);return r.data;};
const denied=async promise=>{const r=await promise;assert.ok(r.error,'A operação alheia ou inválida foi aceita');return r.error;};
async function check(name,task){await task();results.push(name);console.log('OK '+name);}
const items=t=>[{variant_id:t.ninho.id,quantity:2},{variant_id:t.coxinha.id,quantity:1}];
const credit=t=>t.c.rpc('create_sale',{p_request_id:randomUUID(),p_items:[{variant_id:t.ninho.id,quantity:2}],p_customer_id:t.customer.id,p_location_id:t.location.id,p_payment_method:'credit'});
const payment=(t,sale,amount,key=randomUUID(),customer=t.customer.id)=>t.c.rpc('record_payment',{p_request_id:key,p_customer_id:customer,p_sale_id:sale,p_amount_cents:amount,p_method:'pix'});
const balance=(t,sid)=>ok(t.c.from('sale_balances').select('*').eq('id',sid).single());
try{
 for(const [email,password,label] of [[config.aEmail,config.aPassword,'A'],[config.bEmail,config.bPassword,'B']]){
  const c=client();await ok(c.auth.signInWithPassword({email,password}));const business=await ok(c.rpc('complete_onboarding',{p_name:'Operação '+label,p_business_type:'doces',p_sales_channel:'escola'}));
  const customer=await ok(c.from('customers').insert({business_id:business,name:`Operação ${label} ${run}`,phone:'+5592999990000'}).select('*').single());
  const location=await ok(c.from('locations').insert({business_id:business,name:`Local ${label} ${run}`}).select('*').single());
  const product=await ok(c.rpc('save_product',{p_id:null,p_name:`Operação ${label} ${run}`,p_category_id:null,p_description:null,p_active:true,p_variants:[{name:'Ninho',sale_price_cents:2500,cost_price_cents:1000},{name:'Coxinha',sale_price_cents:700,cost_price_cents:200}]}));
  const variants=await ok(c.from('product_variants').select('*').eq('product_id',product));
  const t={c,business,customer,location,product,ninho:variants.find(v=>v.name==='Ninho'),coxinha:variants.find(v=>v.name==='Coxinha')};
  t.sale=await ok(credit(t));
  const timezone=(await ok(c.from('businesses').select('timezone').eq('id',business).single())).timezone;
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  t.reservation=await ok(c.rpc('create_reservation',{p_request_id:randomUUID(),p_items:items(t),p_customer_id:customer.id,p_location_id:location.id,p_scheduled_local:day+'T12:00'}));
  t.expense=await ok(c.rpc('save_expense',{p_request_id:randomUUID(),p_id:null,p_description:'Ingredientes '+run,p_category:'ingredients',p_amount_cents:1000,p_day:day}));
  t.day=day;tenants.push(t);
 }
 const [a,b]=tenants;
 await check('Fiado 5000 pendente com saldo integral no Supabase',async()=>{const s=await balance(a,a.sale);assert.equal(s.balance_cents,5000);assert.equal(s.payment_status,'pending');});
 const key=randomUUID();await Promise.all(Array.from({length:4},()=>ok(payment(a,a.sale,2000,key))));
 await check('Quatro pagamentos concorrentes com mesma chave geram um recibo',async()=>{const s=await balance(a,a.sale);assert.equal(s.paid_cents,2000);assert.equal(s.balance_cents,3000);assert.equal(s.payment_status,'partially_paid');assert.equal((await ok(a.c.from('payments').select('id').eq('request_id',key))).length,1);});
 await check('Payload diferente, zero, negativo e acima do saldo recusados',async()=>{await denied(payment(a,a.sale,1000,key));for(const amount of [0,-1,3001])await denied(payment(a,a.sale,amount));assert.equal((await balance(a,a.sale)).paid_cents,2000);});
 const competing=await Promise.all([payment(a,a.sale,3000),payment(a,a.sale,3000)]);
 await check('Pagamentos concorrentes distintos não ultrapassam o saldo',async()=>{assert.equal(competing.filter(r=>r.error===null).length,1);const s=await balance(a,a.sale);assert.equal(s.paid_cents,5000);assert.equal(s.balance_cents,0);assert.equal(s.payment_status,'paid');});
 const open1=await ok(credit(a)),open2=await ok(credit(a)),allKey=randomUUID();await Promise.all([ok(payment(a,null,10000,allKey)),ok(payment(a,null,10000,allKey))]);
 await check('Quitar tudo cria recibos para as vendas e retry não repete',async()=>{assert.equal((await balance(a,open1)).balance_cents,0);assert.equal((await balance(a,open2)).balance_cents,0);assert.equal((await ok(a.c.from('payments').select('*').eq('request_id',allKey))).length,2);});
 await ok(a.c.from('product_variants').update({sale_price_cents:9000,cost_price_cents:8000}).eq('id',a.ninho.id));
 const conversions=await Promise.all(Array.from({length:4},()=>ok(a.c.rpc('change_reservation',{p_id:a.reservation,p_status:'converted',p_method:'credit'}))));
 await check('Quatro conversões geram uma venda e usam snapshots 2 Ninho + 1 Coxinha',async()=>{assert.ok(conversions.every(id=>id===conversions[0]));const s=await balance(a,conversions[0]);assert.equal(s.total_cents,5700);assert.equal(s.cost_total_cents,2200);assert.equal(s.customer_id,a.customer.id);const lines=await ok(a.c.from('sale_items').select('*').eq('sale_id',s.id));assert.equal(lines.length,2);assert.equal(lines.find(i=>i.variant_name_snapshot==='Ninho').quantity,2);assert.equal(lines.find(i=>i.variant_name_snapshot==='Ninho').unit_price_cents,2500);assert.equal(lines.find(i=>i.variant_name_snapshot==='Coxinha').quantity,1);const r=await ok(a.c.from('reservations').select('*').eq('id',a.reservation).single());assert.equal(r.status,'converted');assert.equal(r.converted_sale_id,s.id);await denied(a.c.rpc('change_reservation',{p_id:a.reservation,p_status:'converted',p_method:'pix'}));});
 for(const [label,own,foreign] of [['A',a,b],['B',b,a]]){
  for(const table of ['payments','reservations','reservation_items','expenses','sale_balances']){
   await check(`${label} SELECT ${table} alheio por UUID e sem filtro isolados`,async()=>{assert.deepEqual(await ok(own.c.from(table).select('id').eq('business_id',foreign.business)),[]);assert.ok((await ok(own.c.from(table).select('business_id'))).every(r=>r.business_id===own.business));});
   if(table!=='sale_balances')await check(`${label} UPDATE/INSERT direto ${table} negados`,async()=>{await denied(own.c.from(table).update({business_id:own.business}).eq('business_id',foreign.business));await denied(own.c.from(table).insert({business_id:foreign.business}));});
  }
  await check(`${label} pagar/quitar/converter/editar dados alheios negados`,async()=>{await denied(payment(own,foreign.sale,1,randomUUID(),foreign.customer.id));await denied(payment(own,null,1,randomUUID(),foreign.customer.id));await denied(payment(own,foreign.sale,1));await denied(own.c.rpc('change_reservation',{p_id:foreign.reservation,p_status:'converted',p_method:'pix'}));await denied(own.c.rpc('save_expense',{p_request_id:randomUUID(),p_id:foreign.expense,p_description:'Invasão',p_category:'other',p_amount_cents:1,p_day:own.day}));});
  for(const field of ['customer','location','variant'])await check(`${label} reserva rejeita referência ${field} alheia`,()=>denied(own.c.rpc('create_reservation',{p_request_id:randomUUID(),p_items:field==='variant'?[{variant_id:foreign.ninho.id,quantity:1}]:items(own),p_customer_id:field==='customer'?foreign.customer.id:own.customer.id,p_location_id:field==='location'?foreign.location.id:own.location.id,p_scheduled_local:own.day+'T12:00'})));
 }
 await check('Dados financeiros do cliente agregados sem confundir caixa e faturamento',async()=>{const f=(await ok(a.c.rpc('customer_finances'))).find(f=>f.customer_id===a.customer.id);assert.equal(f.purchased_cents,20700);assert.equal(f.paid_cents,15000);assert.equal(f.balance_cents,5700);assert.equal(f.purchase_count,4);assert.equal(f.weekly_frequency,null);const analytics=await ok(a.c.rpc('operational_analytics',{p_period:'30days'}));assert.ok(analytics.financial.revenue>=20700);assert.ok(analytics.financial.receivable>=5700);assert.equal(analytics.financial.result,analytics.financial.profit-analytics.financial.expenses);assert.ok(analytics.variants.some(v=>v.id===a.ninho.id&&v.units===8));});
 await check('Anon não lê novas tabelas nem chama RPCs financeiras',async()=>{const anon=client();for(const table of ['payments','reservations','reservation_items','expenses','sale_balances'])await denied(anon.from(table).select('*'));await denied(anon.rpc('record_payment',{p_request_id:randomUUID(),p_customer_id:a.customer.id,p_sale_id:a.sale,p_amount_cents:1,p_method:'pix'}));});
 await mkdir('test-results',{recursive:true});await writeFile('test-results/operations-integration-report.json',JSON.stringify({complete:true,checks:results.length,results,fixtures:tenants.map(t=>({business:t.business,customer:t.customer.id,reservation:t.reservation,sale:t.sale}))},null,2));console.log(`${results.length} testes operacionais reais passaram.`);
}finally{for(const t of tenants)await t.c.auth.signOut({scope:'local'});}
