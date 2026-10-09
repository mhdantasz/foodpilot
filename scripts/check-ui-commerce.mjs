import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { integrationConfig } from './test-env.mjs';
const config=integrationConfig(); if(!config) throw new Error('Configure as contas de teste.');
const email=process.env.TEST_UI_EMAIL||config.aEmail,password=process.env.TEST_UI_PASSWORD||config.aPassword;
const base=process.env.BASE_URL||'http://localhost:3001', widths=[375,390,430,768,1280,1440,1920], results=[], errors=[];
const api=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await api.auth.signInWithPassword({email,password}); assert.equal(login.error,null);
const businessResult=await api.rpc('current_business_id');assert.equal(businessResult.error,null);const business=businessResult.data;
assert.ok(business,'Execute onboarding antes dos testes comerciais.');
const foreignApi=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
assert.equal((await foreignApi.auth.signInWithPassword({email:config.bEmail,password:config.bPassword})).error,null);
const foreignCustomer=(await foreignApi.from('customers').select('id').limit(1)).data?.[0]?.id;
const foreignSale=(await foreignApi.from('sales').select('id').limit(1)).data?.[0]?.id;
assert.ok(foreignCustomer&&foreignSale,'Execute os testes comerciais A/B antes da UI.');
await foreignApi.auth.signOut({scope:'local'});
await mkdir('test-results',{recursive:true});const browser=await chromium.launch();
async function ok(promise) { const {data,error}=await promise;assert.equal(error,null,error?.message);return data; }
async function state(page,width,label) {
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${width}: ${label}`);
  results.push({width,flow:label});
}
async function simple(page,kind,name,extra=false) {
  await page.goto(base+'/'+kind);await page.getByRole('button',{name:kind==='categorias'?'Nova categoria':kind==='locais'?'Novo local':'Novo cliente',exact:true}).click();
  const form=page.getByRole('form',{name:'Cadastro'}); await form.getByLabel('Nome',{exact:true}).fill(name);
  if(extra) { await form.getByLabel('Telefone (opcional)').fill('+55 (92) 99999-0000');await form.getByLabel('Observações (opcional)').fill('Cliente da validação de interface.'); }
  await form.getByRole('button',{name:'Salvar',exact:true}).click(); await form.waitFor({state:'hidden'});await page.getByRole('heading',{name,exact:true}).waitFor();
}
try {
  for(const width of widths) {
    const context=await browser.newContext({viewport:{width,height:width<600?844:1080},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
    const foreignRoutes=[`/clientes/${foreignCustomer}`,`/vendas/${foreignSale}`];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{const expected404=foreignRoutes.some(r=>base+r===m.location().url)&&/status of 404/.test(m.text());if(m.type()==='error'&&!expected404) errors.push(m.text());});
    for(const route of ['/vendas/nova','/categorias','/locais',...foreignRoutes]) { await page.goto(base+route);assert.equal(new URL(page.url()).pathname,'/login');results.push({width,flow:'rota nova sem sessão protegida: '+route.split('/')[1]}); }
    await page.goto(base+'/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/');await page.getByRole('heading',{name:'Hoje',exact:true}).waitFor();
    for(const route of foreignRoutes) { await page.goto(base+route);await page.getByRole('heading',{name:'Essa página não foi encontrada.',exact:true}).waitFor();await state(page,width,'UUID alheio não abre detalhe: '+route.split('/')[1]); }
    const suffix=`${width}-${randomUUID().slice(0,6)}`, product=`Bolo de pote ${width===375?'N'.repeat(40)+' ':''}${suffix}`, customer=`Cliente ${width===375?'C'.repeat(50)+' ':''}${suffix}`, category=`Doces ${suffix}`, location=`Escola ${suffix}`;
    await simple(page,'categorias',category);await state(page,width,'categoria criada');
    await simple(page,'locais',location);await state(page,width,'local criado');
    await simple(page,'clientes',customer,true);await state(page,width,'cliente criado');
    await page.getByRole('searchbox',{name:'Buscar clientes'}).fill(customer);await expect(page.locator('.commerce-record')).toHaveCount(1);await state(page,width,'busca de cliente');
    await page.goto(base+'/produtos');await page.getByRole('button',{name:'Novo produto',exact:true}).click();
    let form=page.getByRole('form',{name:'Produto'});
    await form.getByLabel('Nome do produto',{exact:true}).fill(product);await form.getByLabel('Categoria',{exact:true}).selectOption({label:category});
    await form.getByLabel('Sabor 1',{exact:true}).fill('Ninho');await form.getByLabel('Preço de venda 1',{exact:true}).fill('12,00');await form.getByLabel('Custo 1',{exact:true}).fill('4,30');
    assert.equal(await form.getByLabel('Preço de venda 1',{exact:true}).getAttribute('inputmode'),'decimal');
    await form.getByRole('button',{name:'Adicionar sabor'}).click();await form.getByLabel('Sabor 2',{exact:true}).fill('Chocolate');await form.getByLabel('Preço de venda 2',{exact:true}).fill('7,00');await form.getByLabel('Custo 2',{exact:true}).fill('2,00');
    await state(page,width,'produto com dois sabores e teclado decimal');
    await page.screenshot({path:`test-results/produto-form-${width}.png`,fullPage:true});
    await page.route('**/produtos',async route=>{if(route.request().method()==='POST') await new Promise(r=>setTimeout(r,300));await route.continue();});
    await form.getByRole('button',{name:'Salvar produto',exact:true}).click();await expect(form.getByRole('button',{name:'Salvando…',exact:true})).toBeDisabled();await form.waitFor({state:'hidden'});await page.unroute('**/produtos');
    await page.getByRole('heading',{name:product,exact:true}).waitFor();await page.getByRole('searchbox',{name:'Buscar produtos'}).fill(product);await expect(page.locator('.catalog-card')).toHaveCount(1);await state(page,width,'produto persistido e busca');
    const [p]=await ok(api.from('products').select('*').eq('business_id',business).eq('name',product));
    const vars=await ok(api.from('product_variants').select('*').eq('product_id',p.id));assert.equal(vars.length,2);
    const [cust]=await ok(api.from('customers').select('*').eq('business_id',business).eq('name',customer));assert.equal(cust.phone,'+5592999990000');
    const before=await ok(api.rpc('sales_metrics',{p_period:'today'}));
    await page.goto(base+'/vendas/nova');await page.getByRole('button',{name:'Finalizar venda',exact:true}).isDisabled().then(v=>assert.ok(v));
    await page.getByRole('searchbox',{name:'Buscar produto ou sabor'}).fill(product);
    await page.getByRole('button',{name:`Adicionar ${product} — Ninho`,exact:true}).click();await page.getByRole('button',{name:`Aumentar ${product} — Ninho`,exact:true}).click();
    await expect(page.getByTestId('sale-total')).toHaveText('R$ 24,00');
    await page.getByLabel('Local',{exact:true}).selectOption({label:location});await expect(page.getByLabel('Cliente',{exact:true})).toHaveValue('');
    await state(page,width,'venda rápida sem cliente, quantidade e total');
    if(width<600) { const button=await page.getByRole('button',{name:'Finalizar venda',exact:true}).boundingBox();assert.ok(button.y>=0&&button.y+button.height<=844-72,'Finalizar deve permanecer visível acima da navegação'); }
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/nova-venda-${width}.png`,fullPage:false});
    await page.route('**/vendas/nova',async route=>{if(route.request().method()==='POST') await new Promise(r=>setTimeout(r,300));await route.continue();});
    let posts=0;const countPosts=request=>{if(request.method()==='POST'&&request.url().endsWith('/vendas/nova')) posts++;};page.on('request',countPosts);
    await page.getByRole('button',{name:'Finalizar venda',exact:true}).click();await expect(page.getByRole('button',{name:'Registrando…',exact:true})).toBeDisabled();
    await page.getByRole('heading',{name:'Venda registrada',exact:true}).waitFor();assert.equal(posts,1);page.off('request',countPosts);await page.unroute('**/vendas/nova');
    await state(page,width,'loading e uma única confirmação');
    const firstHref=await page.getByRole('link',{name:'Ver venda',exact:true}).getAttribute('href'), firstId=firstHref.split('/').at(-1);
    const first=await ok(api.from('sales').select('*').eq('id',firstId).single());assert.equal(first.customer_id,null);assert.equal(first.total_cents,2400);assert.equal(first.profit_cents,1540);
    await page.getByRole('button',{name:'Nova venda',exact:true}).click();await page.getByRole('heading',{name:'Nova venda',exact:true}).waitFor();await expect(page.getByTestId('sale-total')).toHaveText('R$ 0,00');
    await page.getByRole('button',{name:`Adicionar ${product} — Ninho`,exact:true}).click();await page.getByRole('button',{name:`Adicionar ${product} — Chocolate`,exact:true}).click();
    await page.getByRole('button',{name:`Aumentar ${product} — Ninho`,exact:true}).click();await page.getByRole('button',{name:`Diminuir ${product} — Ninho`,exact:true}).click();
    await page.getByRole('button',{name:'Dinheiro',exact:true}).click();await page.getByLabel('Pesquisar cliente',{exact:true}).fill(customer);await page.getByLabel('Cliente',{exact:true}).selectOption({label:customer});
    await expect(page.getByTestId('sale-total')).toHaveText('R$ 19,00');await page.getByRole('button',{name:'Finalizar venda',exact:true}).click();await page.getByRole('heading',{name:'Venda registrada',exact:true}).waitFor();
    const secondHref=await page.getByRole('link',{name:'Ver venda',exact:true}).getAttribute('href'), secondId=secondHref.split('/').at(-1);
    const second=await ok(api.from('sales').select('*').eq('id',secondId).single());assert.equal(second.customer_id,cust.id);assert.equal(second.total_cents,1900);assert.equal(second.cost_total_cents,630);assert.equal(second.payment_method,'cash');
    await state(page,width,'venda com cliente e vários itens');
    await page.getByRole('link',{name:'Ver venda',exact:true}).click();await page.getByRole('heading',{name:'Itens da venda'}).waitFor();await expect(page.getByText('R$ 19,00',{exact:true}).first()).toBeVisible();await state(page,width,'detalhe da venda');
    await page.goto(base+'/produtos');await page.getByRole('button',{name:`Editar ${product}`,exact:true}).click();form=page.getByRole('form',{name:'Produto'});
    await form.getByLabel('Nome do produto',{exact:true}).fill(product+' atualizado');
    const ninhoIndex=vars.sort((x,y)=>x.name.localeCompare(y.name)).findIndex(v=>v.name==='Ninho')+1;
    await form.getByLabel(`Preço de venda ${ninhoIndex}`,{exact:true}).fill('13,00');await form.getByLabel(`Custo ${ninhoIndex}`,{exact:true}).fill('4,50');await form.getByRole('button',{name:'Salvar produto',exact:true}).click();await form.waitFor({state:'hidden'});
    await page.goto(base+secondHref);await page.getByRole('heading',{name:'Itens da venda'}).waitFor();await expect(page.getByText(product+' — Ninho',{exact:true})).toBeVisible();
    const old=await ok(api.from('sale_items').select('*').eq('sale_id',secondId));const n=old.find(i=>i.variant_name_snapshot==='Ninho');assert.equal(n.unit_price_cents,1200);assert.equal(n.unit_cost_cents,430);await state(page,width,'edição de preço mantém snapshots');
    await page.goto(base+`/clientes/${cust.id}`);await expect(page.getByRole('heading',{name:customer,exact:true})).toBeVisible();await expect(page.getByText('R$ 19,00',{exact:true}).first()).toBeVisible();await state(page,width,'perfil com compras reais');await page.screenshot({path:`test-results/perfil-cliente-${width}.png`,fullPage:true});
    await page.goto(base+'/vendas?periodo=7days');await expect(page.getByRole('heading',{name:'Vendas',exact:true})).toBeVisible();await page.getByLabel('Cliente',{exact:true}).selectOption(cust.id);await page.getByRole('button',{name:'Filtrar',exact:true}).click();await expect(page.locator('.sale-history-row')).toHaveCount(1);await state(page,width,'histórico e filtros');
    await page.goto(base+'/');const after=await ok(api.rpc('sales_metrics',{p_period:'today'}));assert.equal(after.revenue-before.revenue,4300);assert.equal(after.count-before.count,2);
    await expect(page.locator('.stat-card').first().locator('strong')).toHaveText(`R$ ${Math.trunc(after.revenue/100).toLocaleString('pt-BR')},${String(after.revenue%100).padStart(2,'0')}`);await state(page,width,'dashboard atualizado');
    await page.goto(base+'/vendas/nova');await page.getByRole('searchbox',{name:'Buscar produto ou sabor'}).fill(product+' atualizado');await page.getByRole('button',{name:`Adicionar ${product} atualizado — Ninho`,exact:true}).click();
    await page.getByRole('button',{name:'+ Criar cliente',exact:true}).click();const quick=page.getByRole('form',{name:'Cadastro'});await quick.getByLabel('Nome',{exact:true}).fill('Cadastro rápido '+suffix);await quick.getByRole('button',{name:'Salvar',exact:true}).click();await quick.waitFor({state:'hidden'});await expect(page.getByTestId('sale-total')).toHaveText('R$ 13,00');assert.notEqual(await page.getByLabel('Cliente',{exact:true}).inputValue(),'');await state(page,width,'cliente rápido preserva carrinho');
    await page.getByRole('button',{name:`Remover ${product} atualizado — Ninho`,exact:true}).click();await expect(page.getByRole('button',{name:'Finalizar venda',exact:true})).toBeDisabled();await state(page,width,'remoção do carrinho');
    await page.goto(base+'/clientes');await page.getByRole('button',{name:`Editar ${customer}`,exact:true}).click();const edit=page.getByRole('form',{name:'Cadastro'});await edit.getByLabel('Cadastro ativo',{exact:true}).uncheck();await edit.getByRole('button',{name:'Salvar',exact:true}).click();await edit.waitFor({state:'hidden'});await page.getByLabel('Status',{exact:true}).selectOption('inactive');await expect(page.getByRole('heading',{name:customer,exact:true})).toBeVisible();await state(page,width,'cliente desativado sem perder histórico');
    await page.goto(base+'/produtos');await page.getByRole('searchbox',{name:'Buscar produtos'}).fill(product+' atualizado');await page.getByRole('button',{name:'Desativar',exact:true}).click();await expect(page.getByRole('heading',{name:'Nenhum resultado encontrado.'})).toBeVisible();await state(page,width,'produto desativado');
    await context.close();console.log(`OK fluxos comerciais em ${width}px`);
  }
  const statusContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const statusPage=await statusContext.newPage();statusPage.on('pageerror',e=>errors.push(e.message));statusPage.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  await statusPage.goto(base+'/login');await statusPage.getByLabel('Email',{exact:true}).fill(email);await statusPage.getByLabel('Senha',{exact:true}).fill(password);await statusPage.getByRole('button',{name:'Entrar',exact:true}).click();await statusPage.waitForURL(base+'/');
  for(const [route,button,table] of [['categorias','Nova categoria','categories'],['locais','Novo local','locations']]) {
    const name=`Cadastro inativo ${randomUUID().slice(0,8)}`;
    await statusPage.goto(base+'/'+route);await statusPage.getByRole('button',{name:button,exact:true}).click();
    const form=statusPage.getByRole('form',{name:'Cadastro'});await form.getByLabel('Nome',{exact:true}).fill(name);await form.getByLabel('Cadastro ativo',{exact:true}).uncheck();await form.getByRole('button',{name:'Salvar',exact:true}).click();await form.waitFor({state:'hidden'});
    await statusPage.getByLabel('Status',{exact:true}).selectOption('inactive');await statusPage.getByRole('heading',{name,exact:true}).waitFor();
    const record=await ok(api.from(table).select('active').eq('business_id',business).eq('name',name).single());assert.equal(record.active,false);
    await state(statusPage,390,'criar cadastro já inativo: '+route);
  }
  await statusContext.close();
  assert.deepEqual(errors,[]);await writeFile('test-results/commerce-ui-report.json',JSON.stringify({complete:true,widths,checks:results.length,results,errors,mobileKeyboard:'inputmode decimal/tel, foco e controles touch verificados; teclado nativo não emulado'},null,2));
  console.log(`${results.length} verificações de UI comercial passaram.`);
} finally { await api.auth.signOut({scope:'local'});await browser.close(); }

