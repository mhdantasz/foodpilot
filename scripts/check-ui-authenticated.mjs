import assert from 'node:assert/strict';
import { loadTestEnvironment } from './test-env.mjs';
import { createClient } from '@supabase/supabase-js';
export async function checkAuthenticatedUI(browser, base, widths, errors) {
  loadTestEnvironment();
  const config = process.env.TEST_UI_EMAIL && process.env.TEST_UI_PASSWORD ? { aEmail:process.env.TEST_UI_EMAIL,aPassword:process.env.TEST_UI_PASSWORD } : process.env.TEST_USER_A_EMAIL && process.env.TEST_USER_A_PASSWORD ? { aEmail:process.env.TEST_USER_A_EMAIL,aPassword:process.env.TEST_USER_A_PASSWORD } : null;
  if (!config) return { complete:false, reason:'Supabase e contas de teste A/B não configurados; fluxos autenticados pendentes.' };
  const signupResult=await checkSignup(browser,base,widths,errors);
  if(!signupResult.complete) return signupResult;
  const routes = ['/','/vendas','/clientes','/produtos','/fiados','/reservas','/despesas','/analises','/configuracoes'];
  const results = [];
  for (const width of widths) {
    const context = await browser.newContext({ viewport:{ width,height:width < 600 ? 844 : 1080 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type()==='error') errors.push(message.text()); });
    await page.goto(`${base}/login`);
    await page.getByLabel('Email',{ exact:true }).fill(config.aEmail);
    await page.getByLabel('Senha',{ exact:true }).fill('senha-incorreta-teste');
    await page.getByRole('button',{ name:'Entrar',exact:true }).click();
    await page.getByRole('alert').filter({ hasText:'Email ou senha incorretos' }).waitFor();
    await page.getByLabel('Email',{ exact:true }).fill(config.aEmail);
    await page.getByLabel('Senha',{ exact:true }).fill(config.aPassword);
    await page.getByRole('button',{ name:'Entrar',exact:true }).click();
    await page.waitForURL(base+'/');
    for (const route of routes) {
      const response = await page.goto(base+route); assert.ok(response.ok());
      assert.equal(new URL(page.url()).pathname,route);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,`Overflow ${width} ${route}`);
      await page.locator('h1').waitFor();
      results.push({ width,route });
    }
    await page.goto(base);
    await page.reload(); assert.equal(new URL(page.url()).pathname,'/');
    const newTab = await context.newPage(); await newTab.goto(base); assert.equal(new URL(newTab.url()).pathname,'/'); await newTab.close();
    await page.screenshot({ path:`test-results/dashboard-${width}.png`,fullPage:true });
    await page.getByRole('link',{ name:'Nova venda',exact:true }).first().click(); await page.waitForURL('**/vendas/nova');
    await page.getByRole('heading',{ name:'Cadastre seu primeiro produto' }).waitFor();
    await page.getByRole('link',{ name:'Cadastrar produto',exact:true }).click();
    await page.getByRole('searchbox',{ name:'Buscar produtos' }).fill('teste-inexistente'); await page.getByRole('heading',{ name:'Nenhum resultado encontrado.' }).waitFor();
    if (width < 1024) {
      await page.getByRole('button',{ name:'Mais',exact:true }).click();
      await page.getByRole('region',{ name:'Mais páginas' }).getByRole('link',{ name:'Configurações' }).click();
      await page.waitForURL('**/configuracoes'); assert.equal(await page.locator('#more-menu').count(),0);
    } else {
      await page.getByRole('link',{ name:'Configurações',exact:true }).click(); await page.waitForURL('**/configuracoes');
    }
    await page.getByText(config.aEmail,{ exact:true }).waitFor();
    await page.screenshot({ path:`test-results/configuracoes-${width}.png`,fullPage:true });
    await page.getByRole('button',{ name:'Sair da conta' }).click(); await page.waitForURL('**/login');
    for (const route of routes) { await page.goto(base+route); assert.equal(new URL(page.url()).pathname,'/login'); }
    await context.close();
  }
  return { complete:true, results, signup:signupResult };
}

async function checkSignup(browser,base,widths,errors) {
  const signupEmail = process.env.TEST_SIGNUP_EMAIL;
  const signupPassword = process.env.TEST_SIGNUP_PASSWORD;
  if (!signupEmail || !signupPassword) return { complete:false, reason:'Login, sessão, logout e páginas privadas testados; configure uma conta nova TEST_SIGNUP_EMAIL/PASSWORD para cadastro e onboarding.' };
  // Confirmação permanece habilitada. Uma fixture importada pode testar a UI
  // sem testar novamente entrega SMTP; esse modo é explícito no relatório.
  const context = await browser.newContext({ viewport:{ width:390,height:844 } }); const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if(message.type()==='error') errors.push(message.text()); });
  await page.goto(base+'/cadastro');
  await page.getByLabel('Nome',{ exact:true }).fill('Pessoa de teste'); await page.getByLabel('Email',{ exact:true }).fill(signupEmail);
  await page.getByLabel('Senha',{ exact:true }).fill(signupPassword); await page.getByLabel('Confirmar senha').fill(signupPassword);
  await page.getByRole('button',{ name:'Criar conta' }).click();
  await Promise.race([
    page.waitForURL('**/onboarding'),
    page.getByRole('status').filter({ hasText:'Confira sua caixa de entrada' }).waitFor(),
    page.locator('.form-message[role=alert]').waitFor().then(async () => { throw new Error(await page.locator('.form-message[role=alert]').textContent()); }),
  ]);
  if (new URL(page.url()).pathname !== '/onboarding') {
    console.log(process.env.TEST_SIGNUP_PRECONFIRMED === '1' ? 'Fixture Auth confirmada: cadastro pela UI e onboarding real; entrega SMTP não repetida.' : 'CADASTRO REAL: confirme o email recebido para prosseguir. A confirmação permanece habilitada.');
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{ auth:{ persistSession:false,autoRefreshToken:false } });
    const deadline=Date.now()+10*60*1000;
    let confirmed=false;
    while(Date.now()<deadline) {
      const { data,error }=await client.auth.signInWithPassword({ email:signupEmail,password:signupPassword });
      if (!error && data.user) { confirmed=true; await client.auth.signOut({scope:'local'}); break; }
      if (error?.code !== 'email_not_confirmed') throw new Error('Não foi possível validar a conta de teste: '+error?.code);
      await new Promise(resolve=>setTimeout(resolve,5000));
    }
    assert.ok(confirmed,'Confirmação de email pendente após dez minutos');
    await page.goto(base+'/login');
    await page.getByLabel('Email',{exact:true}).fill(signupEmail);
    await page.getByLabel('Senha',{exact:true}).fill(signupPassword);
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.waitForURL('**/onboarding');
  }
  await page.goto(base+'/produtos'); await page.waitForURL('**/onboarding');
  for (const width of widths) {
    await page.setViewportSize({ width,height:width < 600 ? 844 : 1080 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.screenshot({ path:`test-results/onboarding-${width}.png`,fullPage:true });
  }
  await page.getByLabel('Nome do negócio',{ exact:true }).fill('Doces de teste');
  await page.getByRole('button',{ name:'Continuar' }).click(); await page.getByLabel('Doces',{ exact:true }).check();
  await page.getByRole('button',{ name:'Continuar' }).click(); await page.getByLabel('Encomendas',{ exact:true }).check();
  await page.getByRole('button',{ name:'Preparar meu negócio' }).click(); await page.getByRole('heading',{ name:'Seu negócio está pronto.' }).waitFor();
  await page.getByRole('button',{ name:'Começar' }).click(); await page.waitForURL(base+'/');
  await page.getByRole('heading',{ name:'Doces de teste',exact:true }).waitFor();
  await page.goto(base+'/onboarding'); await page.waitForURL(base+'/');
  await context.close();
  return { complete:true, authFixture:process.env.TEST_SIGNUP_PRECONFIRMED === '1', emailDeliveryRetested:process.env.TEST_SIGNUP_PRECONFIRMED !== '1' };
}
