import { chromium,expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile,mkdir } from 'node:fs/promises';
import { integrationConfig } from './test-env.mjs';
const config=integrationConfig();if(!config) throw new Error('Configure as contas de teste.');
const email=process.env.TEST_UI_EMAIL||config.aEmail,password=process.env.TEST_UI_PASSWORD||config.aPassword;
const base=process.env.BASE_URL||'http://localhost:3001',results=[],errors=[],browser=await chromium.launch();
try {
  for(const width of [375,390,430]) {
    const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
    await page.goto(base+'/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/');
    for(const [route,button,label,attribute,value,input] of [
      ['/clientes','Novo cliente','Telefone (opcional)','type','tel','+5592999990000'],
      ['/produtos','Novo produto','Preço de venda 1','inputmode','decimal','12,50'],
    ]) {
      await page.setViewportSize({width,height:844});await page.goto(base+route);await page.getByRole('button',{name:button,exact:true}).click();
      const field=page.getByLabel(label,{exact:true});assert.equal(await field.getAttribute(attribute),value);
      await field.fill(input);await page.setViewportSize({width,height:500});await field.evaluate(el=>el.scrollIntoView({block:'center'}));await field.focus();
      await expect(field).toBeFocused();await expect(field).toHaveValue(input);
      const box=await field.boundingBox();assert.ok(box.y>=0&&box.y+box.height<500-72,'Campo deve permanecer acima da navegação');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      results.push({width,route,reducedHeight:500,focus:true,keyboardHint:value});
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);await mkdir('test-results',{recursive:true});await writeFile('test-results/mobile-keyboard-report.json',JSON.stringify({passed:results.length,results,errors,nativeKeyboardEmulated:false,method:'Viewport reduzido a 500px como espaço disponível com teclado; foco/tel/decimal e conteúdo preservado. Teclado físico não testado.'},null,2));
  console.log('OK: 6 verificações de foco, campos tel/decimal e viewport reduzido em 375/390/430px. Nenhum cadastro persistido neste teste.');
} finally {await browser.close();}
