import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { checkAuthenticatedUI } from './check-ui-authenticated.mjs';
const base = process.env.BASE_URL || 'http://localhost:3000';
const publicOnly = process.argv.includes('--public-only');
const widths = [375,390,430,1280,1440,1920];
const privateRoutes = ['/','/vendas','/clientes','/produtos','/fiados','/reservas','/despesas','/analises','/configuracoes','/onboarding'];
const errors = []; const results = [];
await mkdir('test-results',{ recursive:true });
const browser = await chromium.launch();
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport:{ width,height:width < 600 ? 844 : 1080 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      const expected404 = message.location().url === base+'/pagina-inexistente' && /status of 404/.test(message.text());
      if (message.type()==='error' && !expected404) errors.push(message.text());
    });
    for (const route of ['/login','/cadastro','/esqueci-senha']) {
      const response = await page.goto(base+route); assert.ok(response.ok()); await page.locator('h1').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,`${width} ${route}`);
      assert.equal(await page.getByRole('navigation').count(),0,'Nenhuma navegação privada em telas públicas');
      await page.screenshot({ path:`test-results/${route.slice(1)}-${width}.png`,fullPage:true,caret:'initial' });
      results.push({ width,route });
    }
    for (const route of privateRoutes) { await page.goto(base+route); assert.equal(new URL(page.url()).pathname,'/login',`Rota privada exposta: ${route}`); }
    await page.goto(base+'/redefinir-senha'); assert.equal(new URL(page.url()).pathname,'/esqueci-senha');
    await page.goto(base+'/auth/confirm?token_hash=invalido&type=owner&next=https://example.com');
    assert.equal(new URL(page.url()).pathname,'/login','Callback não deve aceitar tipo/redirect arbitrário');
    await page.goto(base+'/auth/confirm?token_hash=invalido&type=recovery');
    assert.equal(new URL(page.url()).pathname,'/login','Token de recuperação inválido não deve criar sessão');
    await page.goto(base+'/cadastro');
    await page.getByLabel('Nome',{ exact:true }).fill('Pessoa de teste');
    await page.getByLabel('Email',{ exact:true }).fill('invalido');
    await page.getByRole('button',{ name:'Criar conta' }).click(); await expect(page.locator('.form-message[role=alert]')).toHaveText('Digite um email válido.');
    await page.getByLabel('Email',{ exact:true }).fill('teste@example.com');
    await page.getByLabel('Senha',{ exact:true }).fill('curta'); await page.getByLabel('Confirmar senha').fill('curta');
    await page.getByRole('button',{ name:'Criar conta' }).click(); await expect(page.locator('.form-message[role=alert]')).toHaveText('Use uma senha entre 8 e 128 caracteres.');
    await page.getByLabel('Senha',{ exact:true }).fill('SenhaDeTeste123!'); await page.getByLabel('Confirmar senha').fill('OutraSenha123!');
    await page.getByRole('button',{ name:'Criar conta' }).click(); await expect(page.locator('.form-message[role=alert]')).toHaveText('As senhas precisam ser iguais.');
    await page.goto(base+'/login'); await page.getByLabel('Email',{ exact:true }).fill('invalido');
    await page.getByRole('button',{ name:'Entrar',exact:true }).click(); await expect(page.locator('.form-message[role=alert]')).toHaveText('Digite um email válido.');
    await page.getByRole('link',{ name:'Esqueci minha senha' }).click(); await page.waitForURL('**/esqueci-senha');
    await page.getByRole('link',{ name:'Voltar para entrar' }).click(); await page.waitForURL('**/login');
    await page.getByRole('link',{ name:'Criar conta',exact:true }).click(); await page.waitForURL('**/cadastro');
    await page.getByLabel('Nome',{ exact:true }).fill('');
    // Atrasa apenas o transporte real, sem inventar respostas ou sessão.
    await page.route('**/cadastro', async route => {
      if (route.request().method()==='POST') await new Promise(resolve => setTimeout(resolve,250));
      await route.continue();
    });
    await page.getByRole('button',{ name:'Criar conta' }).click();
    await expect(page.getByRole('button',{ name:'Criando conta…' })).toBeDisabled();
    await expect(page.locator('.form-message[role=alert]')).toHaveText('Informe seu nome, entre 2 e 100 caracteres.');
    const response = await page.goto(base+'/pagina-inexistente'); assert.equal(response.status(),404);
    await page.getByRole('link',{ name:'Voltar ao início' }).click(); await page.waitForURL('**/login');
    await page.close();
  }
  const authenticated = publicOnly ? { complete:false, reason:'Modo público solicitado; fluxos reais não executados.' } : await checkAuthenticatedUI(browser,base,widths,errors);
  assert.deepEqual(errors,[],'Erros no navegador');
  await writeFile(publicOnly ? 'test-results/ui-public-report.json' : 'test-results/ui-report.json',JSON.stringify({ publicChecks:results, anonymousRedirects:widths.length*privateRoutes.length, errors, authenticated, complete:authenticated.complete },null,2));
  console.log(`OK: telas públicas em ${widths.length} larguras, validações, carregamento, 60 redirecionamentos privados e 404.`);
  if (!authenticated.complete) {
    console.log(`PENDENTE: ${authenticated.reason}`);
    if (!publicOnly) process.exitCode=1;
  } else console.log('OK: sessão real, reload, nova aba, logout, dashboard, configurações, cadastro e onboarding.');
} finally { await browser.close(); }
