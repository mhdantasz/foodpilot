import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {integrationConfig} from './test-env.mjs';
const cfg=integrationConfig();if(!cfg)throw Error('Configure as contas dedicadas A/B.');
const results=[],tenants=[],run=randomUUID().slice(0,8);
const ok=async p=>{const r=await p;assert.equal(r.error,null,r.error?.message);return r.data;};
const deny=async p=>assert.ok((await p).error);
async function check(name,fn){await fn();results.push(name);console.log('OK '+name);}
try{
 for(const [email,password,label] of [[cfg.aEmail,cfg.aPassword,'A'],[cfg.bEmail,cfg.bPassword,'B']]){
  const c=createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false}});await ok(c.auth.signInWithPassword({email,password}));const business=await ok(c.rpc('current_business_id'));
  const customer=await ok(c.from('customers').insert({business_id:business,name:`V1 ${label} ${run}`}).select('*').single());
  const product=await ok(c.rpc('save_product',{p_id:null,p_name:`V1 ${label} ${run}`,p_category_id:null,p_description:null,p_active:true,p_variants:[{name:'Único',sale_price_cents:5000,cost_price_cents:2000}]}));
  const variant=await ok(c.from('product_variants').select('id').eq('product_id',product).single());
  const sale=await ok(c.rpc('create_sale',{p_request_id:randomUUID(),p_items:[{variant_id:variant.id,quantity:1}],p_customer_id:customer.id,p_payment_method:'credit'}));
  tenants.push({c,business,customer,sale});
 }
 const [a,b]=tenants,reason='Registro incorreto de teste '+run;
 const balance=t=>ok(t.c.from('sale_balances').select('*').eq('id',t.sale).single());
 const cancel=(t,id=t.sale,confirmed=true)=>t.c.rpc('cancel_sale',{p_id:id,p_reason:reason,p_refund_confirmed:confirmed});
 const payment=(t,amount)=>t.c.rpc('record_payment',{p_request_id:randomUUID(),p_customer_id:t.customer.id,p_sale_id:t.sale,p_amount_cents:amount,p_method:'pix'});
 await check('A/B não cancelam UUID alheio',async()=>{await deny(cancel(a,b.sale));await deny(cancel(b,a.sale));assert.equal((await balance(a)).status,'active');assert.equal((await balance(b)).status,'active');});
 await ok(payment(a,2000));
 await check('Recebimento parcial exige confirmação de devolução',async()=>{await deny(cancel(a,a.sale,false));assert.equal((await balance(a)).status,'active');});
 const before=await ok(a.c.rpc('operational_metrics',{p_period:'today'}));
 const cancellations=await Promise.all(Array.from({length:4},()=>ok(cancel(a))));
 await check('Quatro cancelamentos concorrentes preservam um único estorno',async()=>{assert.ok(cancellations.every(id=>id===a.sale));const s=await balance(a);assert.equal(s.status,'cancelled');assert.equal(s.refunded_cents,2000);assert.equal(s.paid_cents,2000);assert.equal(s.balance_cents,0);assert.ok(s.cancelled_by&&s.cancelled_at);assert.equal(s.cancellation_reason,reason);assert.equal((await ok(a.c.from('payments').select('*').eq('sale_id',a.sale))).length,1);assert.equal((await ok(a.c.from('sale_items').select('*').eq('sale_id',a.sale))).length,1);});
 await check('Faturamento/lucro/fiado/caixa corrigidos sem apagar recibos',async()=>{const after=await ok(a.c.rpc('operational_metrics',{p_period:'today'}));assert.equal(after.revenue-before.revenue,-5000);assert.equal(after.profit-before.profit,-3000);assert.equal(after.receivable-before.receivable,-3000);assert.equal(after.received-before.received,-2000);});
 await check('Venda cancelada não aceita novo pagamento nem motivo reescrito',async()=>{await deny(payment(a,1));await deny(a.c.rpc('cancel_sale',{p_id:a.sale,p_reason:'Outro motivo divergente',p_refund_confirmed:true}));assert.equal((await balance(a)).refunded_cents,2000);});
 await check('A/B continuam isolados em SELECT e UPDATE direto',async()=>{for(const [own,foreign] of [[a,b],[b,a]]){assert.deepEqual(await ok(own.c.from('sale_balances').select('*').eq('id',foreign.sale)),[]);await deny(own.c.from('sales').update({status:'cancelled'}).eq('id',foreign.sale));await deny(own.c.from('sales').update({status:'active'}).eq('id',own.sale));}});
 await check('Corrida pagamento/cancelamento termina sem saldo ou recibo perdido',async()=>{const raced=await Promise.all([payment(b,1000),cancel(b)]);assert.equal(raced[1].error,null);const s=await balance(b);assert.equal(s.status,'cancelled');assert.equal(s.balance_cents,0);const receipts=await ok(b.c.from('payments').select('amount_cents').eq('sale_id',b.sale));assert.equal(s.refunded_cents,receipts.reduce((n,p)=>n+p.amount_cents,0));assert.ok([0,1000].includes(s.refunded_cents));});
 await mkdir('test-results',{recursive:true});await writeFile('test-results/v1-integration-report.json',JSON.stringify({complete:true,checks:results.length,results,developmentOnly:true},null,2));
}finally{await Promise.all(tenants.map(t=>t.c.auth.signOut({scope:'local'})));}
