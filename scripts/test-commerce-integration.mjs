import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { integrationConfig } from './test-env.mjs';
const config=integrationConfig();
if(!config) throw new Error('Configure as duas contas dedicadas A/B em .env.test.local.');
const client=()=>createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
const a=client(), b=client(), anon=client(), results=[];
const runId=randomUUID().slice(0,8);
async function check(name,task) { await task(); results.push(name); console.log('OK '+name); }
async function ok(result) { const {data,error}=await result; assert.equal(error,null,error?.message); return data; }
const create=(c,items,options={})=>c.rpc('create_sale',{p_request_id:options.key??randomUUID(),p_items:items,p_customer_id:options.customer??null,p_location_id:options.location??null,p_payment_method:options.payment??'pix',p_notes:`Integração Fase 3 ${runId}`});
const tenants=[];
try {
  for(const [c,email,password,label] of [[a,config.aEmail,config.aPassword,'A'],[b,config.bEmail,config.bPassword,'B']]) {
    await ok(c.auth.signInWithPassword({email,password}));
    const business=await ok(c.rpc('complete_onboarding',{p_name:`Teste ${label}`,p_business_type:'doces',p_sales_channel:'escola'}));
    const category=(await ok(c.from('categories').insert({business_id:business,name:`Teste ${label} ${runId}`}).select('*').single()));
    const product=await ok(c.rpc('save_product',{p_id:null,p_name:`Bolo teste ${label} ${runId}`,p_category_id:category.id,p_description:null,p_active:true,p_variants:[{name:'Ninho',sale_price_cents:1200,cost_price_cents:430},{name:'Chocolate',sale_price_cents:700,cost_price_cents:200}]}));
    const variants=await ok(c.from('product_variants').select('*').eq('product_id',product).order('name'));
    const customer=await ok(c.from('customers').insert({business_id:business,name:`Cliente teste ${label} ${runId}`,phone:'+5592999990000'}).select('*').single());
    const location=await ok(c.from('locations').insert({business_id:business,name:`Escola teste ${label} ${runId}`}).select('*').single());
    const ninho=variants.find(v=>v.name==='Ninho'),chocolate=variants.find(v=>v.name==='Chocolate');
    const sid=await ok(create(c,[{variant_id:ninho.id,quantity:2}],{customer:customer.id,location:location.id}));
    tenants.push({c,business,category,product,variants,ninho,chocolate,customer,location,sid});
    results.push(`${label} persiste catálogo, cliente, local e venda pelo Supabase real`);
  }
  const [ta,tb]=tenants;
  for(const [label,own,foreign] of [['A',ta,tb],['B',tb,ta]]) {
    for(const table of ['categories','products','product_variants','customers','locations','sales','sale_items']) {
      await check(`${label} SELECT ${table} isolado por UUID e consulta sem filtro`,async()=> {
        assert.deepEqual(await ok(own.c.from(table).select('id').eq('business_id',foreign.business)),[]);
        const rows=await ok(own.c.from(table).select('business_id')); assert.ok(rows.every(r=>r.business_id===own.business));
        assert.ok((await ok(own.c.from(table).select('id').eq('business_id',own.business))).length);
      });
      await check(`${label} UPDATE ${table} alheio bloqueado`,async()=> {
        if(['sales','sale_items'].includes(table)) { const {error}=await own.c.from(table).update({business_id:own.business}).eq('business_id',foreign.business); assert.equal(error?.code,'42501'); }
        else assert.deepEqual(await ok(own.c.from(table).update({name:'INVASÃO'}).eq('business_id',foreign.business).select('id')),[]);
      });
    }
    for(const kind of ['customer','location','variant']) await check(`${label} venda não aceita ${kind} do outro tenant`,async()=> {
      const {error}=await create(own.c,[{variant_id:kind==='variant'?foreign.ninho.id:own.ninho.id,quantity:1}],{customer:kind==='customer'?foreign.customer.id:null,location:kind==='location'?foreign.location.id:null}); assert.equal(error?.code,'22023');
    });
    for(const table of ['categories','products','customers','locations']) await check(`${label} INSERT ${table} alheio negado`,async()=> {
      const {error}=await own.c.from(table).insert({business_id:foreign.business,name:'INVASÃO'}); assert.equal(error?.code,'42501');
    });
    await check(`${label} FKs compostas de categoria e produto bloqueiam referências cruzadas`,async()=> {
      let result=await own.c.from('products').insert({business_id:own.business,name:'Cross',category_id:foreign.category.id}); assert.equal(result.error?.code,'23503');
      result=await own.c.from('product_variants').insert({business_id:own.business,product_id:foreign.product,name:'Cross',sale_price_cents:1,cost_price_cents:0}); assert.equal(result.error?.code,'23503');
    });
  }
  await check('R$12 × 2, custo R$4,30: 2400/860/1540 persistidos',async()=> {
    const s=await ok(a.from('sales').select('*').eq('id',ta.sid).single()); assert.equal(s.total_cents,2400);assert.equal(s.cost_total_cents,860);assert.equal(s.profit_cents,1540);
  });
  await check('Múltiplos itens, cliente opcional e PIX/dinheiro/cartão/outro',async()=> {
    for(const payment of ['pix','cash','card','other']) {
      const id=await ok(create(a,[{variant_id:ta.ninho.id,quantity:2},{variant_id:ta.chocolate.id,quantity:1}],{payment}));
      const s=await ok(a.from('sales').select('*').eq('id',id).single()); assert.equal(s.total_cents,3100);assert.equal(s.cost_total_cents,1060);assert.equal(s.profit_cents,2040);assert.equal(s.customer_id,null);assert.equal(s.payment_status,'paid');
      assert.equal((await ok(a.from('sale_items').select('*').eq('sale_id',id))).length,2);
    }
  });
  await check('Quatro requisições concorrentes e retry geram apenas uma venda',async()=> {
    const key=randomUUID(),items=[{variant_id:ta.ninho.id,quantity:1}];
    const ids=await Promise.all(Array.from({length:4},()=>ok(create(a,items,{key}))));assert.ok(ids.every(id=>id===ids[0]));
    const rows=await ok(a.from('sales').select('id').eq('request_id',key));assert.equal(rows.length,1);
    const result=await create(a,[{variant_id:ta.ninho.id,quantity:2}],{key});assert.equal(result.error?.code,'22023');
  });
  await check('Erro no segundo item reverte todos os registros',async()=> {
    const key=randomUUID();const {error}=await create(a,[{variant_id:ta.ninho.id,quantity:1},{variant_id:tb.ninho.id,quantity:1}],{key});assert.equal(error?.code,'22023');assert.deepEqual(await ok(a.from('sales').select('id').eq('request_id',key)),[]);
  });
  await check('Payload manipulado não altera preço, custo ou negócio',async()=> {
    const id=await ok(create(a,[{variant_id:ta.ninho.id,quantity:1,unit_price_cents:1,cost_total_cents:0,business_id:tb.business}]));
    const s=await ok(a.from('sales').select('*').eq('id',id).single());assert.equal(s.business_id,ta.business);assert.equal(s.total_cents,1200);assert.equal(s.cost_total_cents,430);
  });
  await check('Vazio, zero, negativo, fracionário, excessivo e UUID inexistente rejeitados',async()=> {
    for(const quantity of [0,-1,1.5,10000]) assert.equal((await create(a,[{variant_id:ta.ninho.id,quantity}])).error?.code,'22023');
    assert.equal((await create(a,[])).error?.code,'22023');assert.equal((await create(a,[{variant_id:randomUUID(),quantity:1}])).error?.code,'22023');
  });
  await check('Snapshots permanecem após edição real de produto e sabor',async()=> {
    await ok(a.from('products').update({name:'Nome novo '+runId}).eq('id',ta.product));
    await ok(a.from('product_variants').update({name:'Ninho novo',sale_price_cents:1300,cost_price_cents:450}).eq('id',ta.ninho.id));
    const items=await ok(a.from('sale_items').select('*').eq('sale_id',ta.sid)); assert.equal(items[0].unit_price_cents,1200);assert.equal(items[0].unit_cost_cents,430);assert.equal(items[0].variant_name_snapshot,'Ninho');assert.ok(items[0].product_name_snapshot.startsWith('Bolo teste'));
  });
  await check('Banco real calcula limites do dia em America/Manaus',async()=> {
    const [range]=await ok(a.rpc('sales_period',{p_period:'today',p_anchor:'2026-03-11T03:00:00Z'}));assert.equal(new Date(range.starts_at).toISOString(),'2026-03-10T04:00:00.000Z');assert.equal(new Date(range.ends_at).toISOString(),'2026-03-11T04:00:00.000Z');
  });
  await check('Resumo do cliente usa somente suas compras reais',async()=> {
    const m=await ok(a.rpc('sales_metrics',{p_period:'all',p_customer_id:ta.customer.id}));assert.equal(m.revenue,2400);assert.equal(m.count,1);assert.equal(m.ticket,2400);
    const foreign=await ok(b.rpc('sales_metrics',{p_period:'all',p_customer_id:ta.customer.id}));assert.equal(foreign.count,0);
  });
  await check('Catálogo inativo e alterações/exclusões históricas não permitidos',async()=> {
    await ok(a.from('products').update({active:false}).eq('id',ta.product));assert.equal((await create(a,[{variant_id:ta.ninho.id,quantity:1}])).error?.code,'22023');
    assert.equal((await a.from('sales').update({total_cents:1}).eq('id',ta.sid)).error?.code,'42501');
    assert.equal((await a.from('sale_items').delete().eq('sale_id',ta.sid)).error?.code,'42501');
  });
  await check('Anônimo não lê novas tabelas nem executa criação de venda',async()=> {
    for(const table of ['categories','products','product_variants','customers','locations','sales','sale_items']) assert.equal((await anon.from(table).select('id')).error?.code,'42501');
    assert.equal((await create(anon,[{variant_id:ta.ninho.id,quantity:1}])).error?.code,'42501');
  });
  await check('Schema privilegiado não é exposto na API REST',async()=> {
    const result=await a.schema('commerce_private').rpc('create_sale',{p_request_id:randomUUID(),p_items:[{variant_id:ta.ninho.id,quantity:1}],p_customer_id:null,p_location_id:null,p_payment_method:'pix',p_notes:null});
    assert.equal(result.error?.code,'PGRST106');
  });
  await mkdir('test-results',{recursive:true});await writeFile('test-results/commerce-integration-report.json',JSON.stringify({project:'hbkrcznikmrelkxxcjfq',runId,passed:results.length,results},null,2));
  console.log(`\n${results.length} testes comerciais no Supabase real passaram.`);
} finally { await Promise.all([a.auth.signOut({scope:'local'}),b.auth.signOut({scope:'local'})]); }
