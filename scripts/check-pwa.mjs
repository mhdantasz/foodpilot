import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://localhost:3001',browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.goto(base+'/login');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Page.enable');
 const manifest=await cdp.send('Page.getAppManifest');assert.deepEqual(manifest.errors,[]);assert.ok(manifest.url.endsWith('/manifest.webmanifest'));
 const install=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(install.installabilityErrors,[]);
 await mkdir('test-results',{recursive:true});await writeFile('test-results/pwa-installability-report.json',JSON.stringify({complete:true,base,manifestErrors:manifest.errors,installabilityErrors:install.installabilityErrors,engine:'Chromium CDP',physicalInstallationTested:false},null,2));
 console.log('OK: Chromium não identificou impedimentos de instalação da PWA; instalação física não emulada.');
}finally{await browser.close();}
