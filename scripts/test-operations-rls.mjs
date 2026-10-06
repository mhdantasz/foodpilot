import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile,readdir,mkdir,writeFile } from 'node:fs/promises';
const db=new PGlite(), results=[];
async function check(name,task){await task();results.push(name);console.log('OK '+name);}
async function as(id,task,role='authenticated'){await db.exec('begin');try{await db.exec(`set local role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id??'']);const r=await task();await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}}
const call=async(name,args)=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;
const reject=task=>assert.rejects(task,e=>['22023','42501','23503','23514'].includes(e.code));
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 const tenants=[];
 for(let i=0;i<2;i++){
  const user=randomUUID();await db.query('insert into auth.users values($1,$2)',[user,'{}']);
  const b=await as(user,()=>call('complete_onboarding',['Operação '+i,'doces','escola']));
  const fixture=await as(user,async()=>{
   const customer=(await db.query("insert into customers(business_id,name,phone) values($1,'Lucas','+5592999990000') returning id",[b])).rows[0].id;
   const location=(await db.query("insert into locations(business_id,name) values($1,'Escola') returning id",[b])).rows[0].id;
   const product=await call('save_product',[null,'Bolo',null,null,true,JSON.stringify([{name:'Ninho',sale_price_cents:2500,cost_price_cents:1000},{name:'Coxinha',sale_price_cents:700,cost_price_cents:200}])]);
   const variants=(await db.query('select * from product_variants where product_id=$1 order by sale_price_cents desc',[product])).rows;
   return {customer,location,product,variants};
  });tenants.push({user,b,...fixture});
 }
 const [a,b]=tenants;
 const sale=(t,key=randomUUID(),items=[{variant_id:t.variants[0].id,quantity:2}],customer=t.customer)=>as(t.user,()=>call('create_sale',[key,JSON.stringify(items),customer,t.location,'credit',null]));
 const pay=(t,sid,amount,key=randomUUID())=>as(t.user,()=>call('record_payment',[key,t.customer,sid,amount,'pix',null]));
 const reserve=(t,key=randomUUID(),items=t.variants.map((v,i)=>({variant_id:v.id,quantity:i?1:2})))=>as(t.user,()=>call('create_reservation',[key,JSON.stringify(items),t.customer,t.location,'2026-10-06 12:00:00',null]));
 const bal=async(sid)=>(await db.query('select * from sale_balances where id=$1',[sid])).rows[0];
 const sa=await sale(a),sb=await sale(b);
 await check('Fiado 5000, saldo 5000, pendente',async()=>{const s=await bal(sa);assert.equal(s.total_cents,5000);assert.equal(s.balance_cents,5000);assert.equal(s.payment_status,'pending');});
 const key=randomUUID();await pay(a,sa,2000,key);
 await check('Pagamento parcial 2000, saldo 3000 e status parcial',async()=>{const s=await bal(sa);assert.equal(s.paid_cents,2000);assert.equal(s.balance_cents,3000);assert.equal(s.payment_status,'partially_paid');});
 await check('Retry de pagamento não duplica, payload diferente recusado',async()=>{await pay(a,sa,2000,key);assert.equal((await bal(sa)).paid_cents,2000);await reject(()=>pay(a,sa,1000,key));});
 await check('Pagamentos zero/negativo/excessivo recusados sem escrita',async()=>{for(const v of [0,-1,3001])await reject(()=>pay(a,sa,v));assert.equal((await bal(sa)).paid_cents,2000);});
 await pay(a,sa,3000);
 await check('Pagamento final 3000, saldo zero e status pago',async()=>{const s=await bal(sa);assert.equal(s.paid_cents,5000);assert.equal(s.balance_cents,0);assert.equal(s.payment_status,'paid');});
 await check('Fiado sem cliente e cliente alheio recusados',async()=>{await reject(()=>sale(a,randomUUID(),undefined,null));await reject(()=>sale(a,randomUUID(),undefined,b.customer));});
 const extra1=await sale(a),extra2=await sale(a);const allKey=randomUUID();await pay(a,null,10000,allKey);
 await check('Quitar tudo aloca em vendas reais e preserva recibos',async()=>{await pay(a,null,10000,allKey);assert.equal((await bal(extra1)).balance_cents,0);assert.equal((await bal(extra2)).balance_cents,0);assert.equal((await db.query('select count(*) as n from payments where request_id=$1',[allKey])).rows[0].n,2);});
 const ra=await reserve(a),rb=await reserve(b);
 await db.query('update product_variants set sale_price_cents=9000,cost_price_cents=8000 where id=$1',[a.variants[0].id]);
 const converted=await as(a.user,()=>call('change_reservation',[ra,'converted','credit']));
 await check('Reserva 2 Ninho + 1 Coxinha converte usando snapshots',async()=>{const s=await bal(converted);assert.equal(s.total_cents,5700);assert.equal(s.cost_total_cents,2200);assert.equal(s.customer_id,a.customer);const items=(await db.query('select quantity,unit_price_cents from sale_items where sale_id=$1 order by unit_price_cents desc',[converted])).rows;assert.deepEqual(items,[{quantity:2,unit_price_cents:2500},{quantity:1,unit_price_cents:700}]);assert.equal((await db.query('select status,converted_sale_id from reservations where id=$1',[ra])).rows[0].converted_sale_id,converted);});
 await check('Segunda conversão retorna venda existente, sem duplicação',async()=>{assert.equal(await as(a.user,()=>call('change_reservation',[ra,'converted','credit'])),converted);await reject(()=>as(a.user,()=>call('change_reservation',[ra,'converted','pix'])));assert.equal((await db.query('select count(*) as n from sales where request_id=$1',[ra])).rows[0].n,1);});
 const ea=await as(a.user,()=>call('save_expense',[randomUUID(),null,'Ingredientes','ingredients',1000,'2026-10-06',null]));
 const eb=await as(b.user,()=>call('save_expense',[randomUUID(),null,'Embalagens','packaging',500,'2026-10-06',null]));
 for(const [label,own,foreign,reservation,expense,foreignSale] of [['A',a,b,rb,eb,sb],['B',b,a,ra,ea,sa]]){
  for(const table of ['payments','reservations','reservation_items','expenses']){
   await check(`${label} SELECT ${table} alheio bloqueado`,()=>as(own.user,async()=>{assert.equal((await db.query(`select * from ${table} where business_id=$1`,[foreign.b])).rows.length,0);assert.ok((await db.query(`select business_id from ${table}`)).rows.every(r=>r.business_id===own.b));}));
   await check(`${label} escrita direta ${table} negada`,async()=>{await reject(()=>as(own.user,()=>db.query(`update ${table} set business_id=$1 where business_id=$2`,[own.b,foreign.b])));await reject(()=>as(own.user,()=>db.query(`insert into ${table}(business_id) values($1)`,[foreign.b])));});
  }
  await check(`${label} pagar/quitar/converter/editar outro tenant negado`,async()=>{await reject(()=>as(own.user,()=>call('record_payment',[randomUUID(),foreign.customer,foreignSale,1,'pix',null])));await reject(()=>as(own.user,()=>call('record_payment',[randomUUID(),foreign.customer,null,1,'pix',null])));await reject(()=>as(own.user,()=>call('change_reservation',[reservation,'converted','pix'])));await reject(()=>as(own.user,()=>call('save_expense',[randomUUID(),expense,'Invasão','other',1,'2026-10-06',null])));});
  for(const [field,value] of [['customer',foreign.customer],['location',foreign.location],['variant',foreign.variants[0].id]]) await check(`${label} reserva recusa ${field} alheio`,()=>reject(()=>as(own.user,()=>call('create_reservation',[randomUUID(),JSON.stringify([{variant_id:field==='variant'?value:own.variants[0].id,quantity:1}]),field==='customer'?value:own.customer,field==='location'?value:own.location,'2026-10-06 12:00',null]))));
 }
 await check('FKs compostas também barram referências com role administrativa',async()=>{
  await reject(()=>db.query('update payments set customer_id=$1 where sale_id=$2',[b.customer,sa]));
  await reject(()=>db.query('update payments set sale_id=$1 where sale_id=$2',[sb,sa]));
  await reject(()=>db.query('update reservations set customer_id=$1 where id=$2',[b.customer,ra]));
  await reject(()=>db.query('update reservations set location_id=$1 where id=$2',[b.location,ra]));
  await reject(()=>db.query('update reservation_items set product_variant_id=$1 where reservation_id=$2',[b.variants[0].id,ra]));
  await reject(()=>db.query('update reservation_items set reservation_id=$1 where reservation_id=$2',[rb,ra]));
 });
 await check('Rollback em item inválido da reserva',async()=>{const before=(await db.query('select count(*) n from reservations')).rows[0].n;await reject(()=>reserve(a,randomUUID(),[{variant_id:a.variants[0].id,quantity:1},{variant_id:randomUUID(),quantity:1}]));assert.equal((await db.query('select count(*) n from reservations')).rows[0].n,before);});
 await db.query("update sales set sold_at='2026-10-06 12:00Z' where business_id=$1",[a.b]);await db.query("update payments set paid_at='2026-10-06 12:00Z' where business_id=$1",[a.b]);
 await check('Métricas separam competência, caixa, CPV, despesas e saldo',()=>as(a.user,async()=>{const m=await call('operational_metrics',['today','2026-10-06T16:00:00Z']);assert.equal(m.revenue,20700);assert.equal(m.cost,8200);assert.equal(m.profit,12500);assert.equal(m.expenses,1000);assert.equal(m.result,11500);assert.equal(m.received,15000);assert.equal(m.receivable,5700);assert.equal(m.ticket,5175);assert.equal(m.forecast,null);const f=(await db.query('select * from customer_finances($1)', ['2026-10-06T16:00:00Z'])).rows[0];assert.equal(f.weekly_frequency,null);assert.equal(Number(f.balance_cents),5700);}));
 await db.query("update sales set sold_at='2026-09-23 12:00Z' where id=$1",[extra1]);
 await check('Frequência e gasto semanal incluem dias sem compras',()=>as(a.user,async()=>{const f=(await db.query('select * from customer_finances($1)',['2026-10-06T16:00:00Z'])).rows[0];assert.equal(Number(f.weekly_frequency),2);assert.equal(Number(f.weekly_spend_cents),10350);const an=await call('operational_analytics',['30days','2026-10-06T16:00:00Z']);assert.equal(an.financial.days,30);assert.equal(an.variants.find(v=>v.name==='Ninho').units,8);assert.equal(an.products_by_revenue[0].revenue,20700);}));
 await check('Despesas editáveis só no próprio negócio e dia local Manaus',()=>as(a.user,async()=>{await call('save_expense',[randomUUID(),ea,'Ingredientes revistos','ingredients',2000,'2026-10-06',null]);const e=(await db.query('select * from expenses where id=$1',[ea])).rows[0];assert.equal(e.amount_cents,2000);assert.equal(e.incurred_at.toISOString(),'2026-10-06T04:00:00.000Z');}));
 await check('Previsão mensal inclui dias zerados e exige histórico suficiente',async()=>{
  await db.query("update sales set sold_at='2026-10-01 12:00Z' where id=$1",[sa]);await db.query("update sales set sold_at='2026-10-03 12:00Z' where id=$1",[extra1]);
  await as(a.user,async()=>{const m=await call('operational_metrics',['month','2026-10-07T16:00:00Z']);assert.equal(m.forecast,91700);assert.equal(m.forecast_observed_days,7);assert.equal(m.forecast_month_days,31);assert.equal((await call('operational_metrics',['month','2026-10-06T16:00:00Z'])).forecast,null);});
 });
 await check('Idempotência de despesa e reserva rejeita payload diferente',async()=>{
  const key=randomUUID();const eid=await as(a.user,()=>call('save_expense',[key,null,'Transporte','transport',100,'2026-10-06',null]));assert.equal(await as(a.user,()=>call('save_expense',[key,null,'Transporte','transport',100,'2026-10-06',null])),eid);await reject(()=>as(a.user,()=>call('save_expense',[key,null,'Transporte','transport',200,'2026-10-06',null])));
  const rk=randomUUID(),rid=await reserve(a,rk);assert.equal(await reserve(a,rk),rid);await reject(()=>reserve(a,rk,[{variant_id:a.variants[0].id,quantity:1}]));
  await as(a.user,()=>call('change_reservation',[rid,'cancelled',null]));await reject(()=>as(a.user,()=>call('change_reservation',[rid,'converted','pix'])));
 });
 await check('Faturamento 100000 − CPV 40000 − despesa 10000 = resultado 50000',async()=>{
  const uid=randomUUID();await db.query('insert into auth.users values($1,$2)',[uid,'{}']);
  await as(uid,async()=>{const biz=await call('complete_onboarding',['Métricas controladas','doces','escola']);const p=await call('save_product',[null,'Kit',null,null,true,JSON.stringify([{name:'Tradicional',sale_price_cents:50000,cost_price_cents:20000}])]);const v=(await db.query('select id from product_variants where product_id=$1',[p])).rows[0].id;
   const sid=await call('create_sale',[randomUUID(),JSON.stringify([{variant_id:v,quantity:2}]),null,null,'pix',null]);
   await call('save_expense',[randomUUID(),null,'Embalagens','packaging',10000,'2026-10-06',null]);
   // The clock is controlled in the isolated test, not by the application's financial writer.
   await db.exec('reset role');await db.query("update sales set sold_at='2026-10-06 12:00Z' where id=$1",[sid]);await db.exec('set local role authenticated');
   const m=await call('operational_metrics',['today','2026-10-06T16:00:00Z']);assert.deepEqual([m.revenue,m.cost,m.profit,m.expenses,m.result,m.ticket],[100000,40000,60000,10000,50000,100000]);
   assert.equal(m.receivable,0);assert.equal(m.debtors,0);assert.equal((await db.query('select business_id from sales')).rows.every(r=>r.business_id===biz),true);
  });
 });
 await check('Anon não lê tabelas/view nem executa operações',async()=>{for(const table of ['payments','reservations','reservation_items','expenses','sale_balances'])await reject(()=>as(null,()=>db.query(`select * from ${table}`),'anon'));await reject(()=>as(null,()=>call('record_payment',[randomUUID(),a.customer,sa,1,'pix',null]),'anon'));});
 await mkdir('test-results',{recursive:true});await writeFile('test-results/operations-rls-report.json',JSON.stringify({complete:true,checks:results.length,results},null,2));console.log(`${results.length} testes operacionais SQL/RLS passaram.`);
}finally{await db.close();}

