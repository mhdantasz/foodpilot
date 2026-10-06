import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
const moneySource = await readFile(new URL('../src/lib/money.ts', import.meta.url), 'utf8');
const moneyJS = ts.transpileModule(moneySource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { brlToCents, centsToBRL, formatMoney, sumCents, profitCents } = await import('data:text/javascript;base64,' + Buffer.from(moneyJS).toString('base64'));
const db = new PGlite(), results = [];
const users = [randomUUID(), randomUUID()];
async function check(name, task) { await task(); results.push(name); console.log('OK '+name); }
async function user(id, task, role='authenticated') {
  await db.exec('begin');
  try { await db.exec(`set local role ${role}`); await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id ?? '']); const value=await task(); await db.exec('commit'); return value; }
  catch(error) { await db.exec('rollback'); throw error; }
}
async function count(table) { return Number((await db.query(`select count(*) from public.${table}`)).rows[0].count); }
async function denied(task, code='42501') { await assert.rejects(task,error=>error.code===code); }
const sale = (items, options={}) => db.query('select public.create_sale($1,$2::jsonb,$3,$4,$5,$6) as id',[options.key ?? randomUUID(),JSON.stringify(items),options.customer ?? null,options.location ?? null,options.payment ?? 'pix',options.notes ?? null]);
try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
  for(const id of users) await db.query('insert into auth.users values($1,$2)',[id,'{}']);
  const tenants=[];
  for(const [i,id] of users.entries()) {
    const b=(await user(id,()=>db.query("select complete_onboarding($1,'doces','escola') as id",['Negócio '+i]))).rows[0].id;
    const fixture=await user(id,async()=> {
      const category=(await db.query('insert into categories(business_id,name) values($1,$2) returning id',[b,'Doces'])).rows[0].id;
      const product=(await db.query('select save_product(null,$1,$2,null,true,$3::jsonb) as id',['Bolo',category,JSON.stringify([{name:'Ninho',sale_price_cents:1200,cost_price_cents:430},{name:'Chocolate',sale_price_cents:700,cost_price_cents:200}])])).rows[0].id;
      const variants=(await db.query('select * from product_variants where product_id=$1 order by name',[product])).rows;
      const customer=(await db.query('insert into customers(business_id,name,phone) values($1,$2,$3) returning id',[b,'Cliente','+5592999990000'])).rows[0].id;
      const location=(await db.query('insert into locations(business_id,name) values($1,$2) returning id',[b,'Escola'])).rows[0].id;
      const sid=(await sale([{variant_id:variants.find(v=>v.name==='Ninho').id,quantity:2}],{customer,location})).rows[0].id;
      return {category,product,variants,customer,location,sid};
    });
    tenants.push({user:id,b,...fixture});
    results.push(`Tenant ${i?'B':'A'} cria categoria, produto, sabores, cliente, local e venda`);
  }
  const [a,b]=tenants, av=a.variants.find(v=>v.name==='Ninho'), bv=b.variants.find(v=>v.name==='Ninho');
  for(const [label,own,foreign] of [['A',a,b],['B',b,a]]) {
    for(const table of ['categories','products','product_variants','customers','locations','sales','sale_items']) {
      await check(`${label} SELECT ${table} próprio e UUID alheio isolados`,()=>user(own.user,async()=> {
        assert.ok((await db.query(`select id from ${table} where business_id=$1`,[own.b])).rows.length);
        assert.equal((await db.query(`select id from ${table} where business_id=$1`,[foreign.b])).rows.length,0);
        assert.ok((await db.query(`select business_id from ${table}`)).rows.every(r=>r.business_id===own.b));
      }));
      await check(`${label} UPDATE ${table} alheio bloqueado`,()=>user(own.user,async()=> {
        if(['sales','sale_items'].includes(table)) await assert.rejects(()=>db.query(`update ${table} set business_id=$1 where business_id=$2`,[own.b,foreign.b]),e=>e.code==='42501');
        else assert.equal((await db.query(`update ${table} set name='Invadido' where business_id=$1 returning id`,[foreign.b])).rows.length,0);
      }));
    }
    for(const table of ['categories','products','customers','locations']) await check(`${label} INSERT ${table} em negócio alheio negado`,()=>denied(()=>user(own.user,()=>db.query(`insert into ${table}(business_id,name) values($1,'Invasão')`,[foreign.b]))));
    for(const field of ['customer','location','variant']) await check(`${label} RPC rejeita ${field} de outro negócio`,()=>denied(()=>user(own.user,()=>sale([{variant_id:field==='variant'?foreign.variants[0].id:own.variants[0].id,quantity:1}],{customer:field==='customer'?foreign.customer:null,location:field==='location'?foreign.location:null})),'22023'));
    await check(`${label} não reatribui business_id nem exclui catálogo`,async()=> {
      await denied(()=>user(own.user,()=>db.query('update products set business_id=$1 where id=$2',[foreign.b,own.product])));
      await denied(()=>user(own.user,()=>db.query('delete from products where id=$1',[own.product])));
    });
  }
  await check('Receita 2400, custo 860, lucro 1540 em inteiros',async()=> {
    const r=(await db.query('select total_cents,cost_total_cents,profit_cents from sales where id=$1',[a.sid])).rows[0];
    assert.deepEqual(r,{total_cents:2400,cost_total_cents:860,profit_cents:1540});
    const money=(await db.query("select data_type from information_schema.columns where table_schema='public' and column_name like '%_cents'")).rows;
    assert.ok(money.length>=10); assert.ok(money.every(r=>r.data_type==='bigint'));
  });
  await check('Múltiplos itens e venda sem cliente/local',()=>user(a.user,async()=> {
    const id=(await sale(a.variants.map(v=>({variant_id:v.id,quantity:1})))).rows[0].id;
    const r=(await db.query('select * from sales where id=$1',[id])).rows[0];
    assert.equal(r.total_cents,1900); assert.equal(r.cost_total_cents,630); assert.equal(r.profit_cents,1270); assert.equal(r.customer_id,null);
  }));
  await check('Preço/custo enviados pelo cliente não são autoridade',()=>user(a.user,async()=> {
    const id=(await sale([{variant_id:av.id,quantity:1,unit_price_cents:1,cost_total_cents:0,business_id:b.b}])).rows[0].id;
    const r=(await db.query('select * from sales where id=$1',[id])).rows[0]; assert.equal(r.business_id,a.b); assert.equal(r.total_cents,1200); assert.equal(r.cost_total_cents,430);
  }));
  await check('Idempotência retorna mesma venda e rejeita payload diferente',async()=> {
    const key=randomUUID(), items=[{variant_id:av.id,quantity:1}];
    const one=(await user(a.user,()=>sale(items,{key}))).rows[0].id;
    const two=(await user(a.user,()=>sale(items,{key}))).rows[0].id; assert.equal(one,two);
    await denied(()=>user(a.user,()=>sale([{variant_id:av.id,quantity:2}],{key})),'22023');
  });
  for(const quantity of [0,-1,10000,1.5,'2',null]) await check(`Quantidade ${JSON.stringify(quantity)} rejeitada`,()=>denied(()=>user(a.user,()=>sale([{variant_id:av.id,quantity}])),'22023'));
  await check('Venda vazia, produto inexistente e pagamento inválido rejeitados',async()=> {
    await denied(()=>user(a.user,()=>sale([])),'22023');
    await denied(()=>user(a.user,()=>sale([{variant_id:randomUUID(),quantity:1}])),'22023');
    await denied(()=>user(a.user,()=>sale([{variant_id:av.id,quantity:1}],{payment:'fiado'})),'22023');
  });
  await check('Erro no segundo item reverte cabeçalho e primeiro item',async()=> {
    const before=[await count('sales'),await count('sale_items')];
    await denied(()=>user(a.user,()=>sale([{variant_id:av.id,quantity:1},{variant_id:bv.id,quantity:1}])),'22023');
    assert.deepEqual([await count('sales'),await count('sale_items')],before);
  });
  await check('Erro no segundo sabor reverte produto e primeiro sabor',async()=> {
    const before=[await count('products'),await count('product_variants')];
    await denied(()=>user(a.user,()=>db.query("select save_product(null,'Inválido',null,null,true,$1::jsonb)",[JSON.stringify([{name:'Bom',sale_price_cents:100,cost_price_cents:0},{name:'Ruim',sale_price_cents:-1,cost_price_cents:0}])])),'23514');
    assert.deepEqual([await count('products'),await count('product_variants')],before);
  });
  await check('FKs compostas bloqueiam referência cruzada mesmo com role privilegiada',async()=> {
    await denied(()=>db.query("insert into products(business_id,name,category_id) values($1,'Cross',$2)",[a.b,b.category]),'23503');
    await denied(()=>db.query("insert into product_variants(business_id,product_id,name,sale_price_cents,cost_price_cents) values($1,$2,'Cross',100,0)",[a.b,b.product]),'23503');
    await denied(()=>db.query('update sales set customer_id=$1 where id=$2',[b.customer,a.sid]),'23503');
    await denied(()=>db.query('update sales set location_id=$1 where id=$2',[b.location,a.sid]),'23503');
    await denied(()=>db.query('update sale_items set product_variant_id=$1 where sale_id=$2',[bv.id,a.sid]),'23503');
    await denied(()=>db.query('update sale_items set sale_id=$1 where sale_id=$2',[b.sid,a.sid]),'23503');
  });
  await check('Nomes duplicados normalizados de categoria/local rejeitados',async()=> {
    await denied(()=>user(a.user,()=>db.query("insert into categories(business_id,name) values($1,'  DOCES  ')",[a.b])),'23505');
    await denied(()=>user(a.user,()=>db.query("insert into locations(business_id,name) values($1,'  escola  ')",[a.b])),'23505');
  });
  await check('Produto/sabor inativos não podem ser vendidos',async()=> {
    await user(a.user,()=>db.query('update product_variants set active=false where id=$1',[av.id]));
    await denied(()=>user(a.user,()=>sale([{variant_id:av.id,quantity:1}])),'22023');
    await user(a.user,()=>db.query('update product_variants set active=true where id=$1',[av.id]));
    await user(a.user,()=>db.query('update products set active=false where id=$1',[a.product]));
    await denied(()=>user(a.user,()=>sale([{variant_id:av.id,quantity:1}])),'22023');
    await user(a.user,()=>db.query('update products set active=true where id=$1',[a.product]));
  });
  await check('Snapshots não mudam após editar nomes, preço e custo',async()=> {
    await user(a.user,async()=> {
      await db.query("update products set name='Bolo atualizado' where id=$1",[a.product]);
      await db.query("update product_variants set name='Ninho novo',sale_price_cents=1300,cost_price_cents=450 where id=$1",[av.id]);
    });
    const r=(await db.query('select * from sale_items where sale_id=$1',[a.sid])).rows[0];
    assert.equal(r.product_name_snapshot,'Bolo'); assert.equal(r.variant_name_snapshot,'Ninho'); assert.equal(r.unit_price_cents,1200); assert.equal(r.unit_cost_cents,430);
  });
  await check('Manaus inclui UTC do dia seguinte antes de 04:00 e exclui após 04:00',async()=> {
    await db.query("update sales set sold_at='2026-03-11T02:00:00Z' where id=$1",[a.sid]);
    const next=(await user(a.user,()=>sale([{variant_id:av.id,quantity:1}]))).rows[0].id;
    await db.query("update sales set sold_at='2026-03-11T04:00:00Z' where id=$1",[next]);
    const result=(await user(a.user,()=>db.query("select sales_metrics('today',null,'2026-03-11T03:00:00Z') as m"))).rows[0].m;
    assert.equal(result.count,1); assert.equal(result.revenue,2400); assert.equal(result.profit,1540);
    const period=(await user(a.user,()=>db.query("select * from sales_period('today','2026-03-11T03:00:00Z')"))).rows[0];
    assert.equal(new Date(period.starts_at).toISOString(),'2026-03-10T04:00:00.000Z');
    assert.equal(new Date(period.ends_at).toISOString(),'2026-03-11T04:00:00.000Z');
    for(const [p,date] of [['yesterday','2026-03-09'],['week','2026-03-09'],['month','2026-03-01'],['7days','2026-03-04'],['30days','2026-02-09']]) {
      const range=(await user(a.user,()=>db.query('select * from sales_period($1,$2)',[p,'2026-03-11T03:00:00Z']))).rows[0];
      assert.equal(new Date(range.starts_at).toISOString(),date+'T04:00:00.000Z');
    }
  });
  await check('Métricas/histórico de cliente são derivados das vendas próprias',()=>user(a.user,async()=> {
    const m=(await db.query("select sales_metrics('all',$1) as m",[a.customer])).rows[0].m;
    assert.equal(m.count,1); assert.equal(m.revenue,2400); assert.equal(m.ticket,2400);
    const summaries=(await db.query('select * from customer_summaries()')).rows; assert.equal(summaries.length,1); assert.equal(summaries[0].customer_id,a.customer);
    assert.equal((await db.query("select sales_metrics('all',$1) as m",[b.customer])).rows[0].m.count,0);
  }));
  await check('Timezone configurável respeita dias de 23/25 horas em DST',async()=> {
    await db.query("update businesses set timezone='America/New_York' where id=$1",[a.b]);
    for(const [anchor,hours] of [['2026-03-08T16:00:00Z',23],['2026-11-01T17:00:00Z',25]]) {
      const r=(await user(a.user,()=>db.query('select * from sales_period($1,$2)',['today',anchor]))).rows[0];
      assert.equal((new Date(r.ends_at)-new Date(r.starts_at))/3600000,hours);
    }
    await db.query("update businesses set timezone='America/Manaus' where id=$1",[a.b]);
  });
  await check('Anônimo e auth.uid ausente não registram venda nem leem dados',async()=> {
    await denied(()=>user(null,()=>sale([{variant_id:av.id,quantity:1}])));
    await denied(()=>user(null,()=>sale([{variant_id:av.id,quantity:1}]),'anon'));
    for(const t of ['categories','products','product_variants','customers','locations','sales','sale_items']) await denied(()=>user(null,()=>db.query(`select * from ${t}`),'anon'));
  });
  await check('Helpers BRL, inteiros, soma, lucro e rejeição de decimais incorretos',async()=> {
    assert.equal(brlToCents('R$ 12,00'),1200); assert.equal(brlToCents('1.234,56'),123456); assert.equal(brlToCents('4,3'),430);
    assert.equal(centsToBRL(1250),'12,50'); assert.equal(formatMoney(-1250),'R$ -12,50'); assert.equal(sumCents([1200,1200]),2400); assert.equal(profitCents(2400,860),1540);
    for(const value of ['12.50','1,234','-1,00','abc','Infinity','']) assert.throws(()=>brlToCents(value));
    assert.throws(()=>sumCents([0.5]));
  });
  await mkdir('test-results',{recursive:true});
  await writeFile('test-results/commerce-rls-report.json',JSON.stringify({passed:results.length,results},null,2));
  console.log(`\n${results.length} verificações comerciais SQL/RLS passaram.`);
} finally { await db.close(); }
