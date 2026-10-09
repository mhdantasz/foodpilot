import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {integrationConfig} from './test-env.mjs';
const cfg=integrationConfig();if(!cfg)throw Error('Configure as contas dedicadas.');
const base=process.env.BASE_URL||'http://localhost:3001',browser=await chromium.launch(),results=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'/login');await page.getByLabel('Email',{exact:true}).fill(process.env.TEST_UI_EMAIL||cfg.aEmail);await page.getByLabel('Senha',{exact:true}).fill(process.env.TEST_UI_PASSWORD||cfg.aPassword);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/');
 const cdp=await context.newCDPSession(page);
 await mkdir('test-results',{recursive:true});
 for(const [width,height,insets] of [[390,844,{top:44,bottom:34,left:0,right:0}],[844,390,{top:0,bottom:21,left:44,right:44}]]){
  await page.setViewportSize({width,height});await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets});await page.goto(base+'/');await page.getByRole('heading',{name:'Hoje',exact:true}).waitFor();
  // CDP não altera display-mode. Aplicamos as regras reais de standalone à página
  // de teste, preservando suas outras media queries; não simulamos uma instalação.
  const standalone=await page.evaluate(()=>[...document.styleSheets].flatMap(sheet=>[...sheet.cssRules]).filter(rule=>rule instanceof CSSMediaRule&&rule.conditionText.includes('display-mode')).map(rule=>rule.cssText.replace(/\(display-mode\s*:\s*standalone\)/g,'(min-width: 0px)')).join('\n'));assert.ok(standalone);await page.addStyleTag({content:standalone});
  const geometry=await page.evaluate(()=>{const main=document.querySelector('.responsive-container'),header=document.querySelector('.topbar'),nav=document.querySelector('.mobile-navigation'),action=document.querySelector('.quick-sale');return {overflow:document.documentElement.scrollWidth>innerWidth,main:main.getBoundingClientRect().toJSON(),paddingLeft:parseFloat(getComputedStyle(main).paddingLeft),paddingRight:parseFloat(getComputedStyle(main).paddingRight),headerHeight:header.getBoundingClientRect().height,navPaddingLeft:parseFloat(getComputedStyle(nav).paddingLeft),navPaddingRight:parseFloat(getComputedStyle(nav).paddingRight),navPaddingBottom:parseFloat(getComputedStyle(nav).paddingBottom),action:action.getBoundingClientRect().toJSON()};});
  assert.equal(geometry.overflow,false);assert.ok(geometry.paddingLeft>=17+insets.left&&geometry.paddingRight>=17+insets.right);assert.ok(geometry.headerHeight>=65+insets.top);assert.ok(geometry.navPaddingLeft>=6+insets.left&&geometry.navPaddingRight>=6+insets.right&&geometry.navPaddingBottom>=6+insets.bottom);assert.ok(geometry.action.right<=width-insets.right&&geometry.action.bottom<=height-insets.bottom-72);
  await page.screenshot({path:`test-results/safe-areas-${width}.png`,fullPage:false});await page.goto(base+'/configuracoes');await expect(page.getByRole('heading',{name:'Exportar dados'})).toBeVisible();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);results.push({width,height,insets,geometry});
 }
 assert.deepEqual(errors,[]);await writeFile('test-results/safe-area-ui-report.json',JSON.stringify({complete:true,checks:results.length,results,errors,physicalInstallationTested:false,emulation:'Actual standalone CSS rules applied explicitly; Chromium CDP safe-area-insets in portrait/landscape. No installation or display-mode override.',writes:false},null,2));console.log('OK: CSS standalone com recortes/safe areas e Nova venda em retrato/paisagem; instalação física não testada, nenhum dado gravado.');
}finally{await browser.close();}
