// Renderiza a marca SVG existente, sem gerar uma nova identidade visual.
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
const svg = await readFile('src/app/icon.svg', 'utf8');
await mkdir('public/icons', { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, size, maskable] of [['icon-192',192,false],['icon-512',512,false],['maskable-512',512,true],['apple-180',180,false]]) {
    const page = await browser.newPage({ viewport: { width:size, height:size }, deviceScaleFactor:1 });
    await page.setContent(`<style>body{margin:0;width:100vw;height:100vh;display:grid;place-items:center;background:${maskable?'#27634b':'transparent'}}svg{width:${maskable?'80':'100'}%;height:${maskable?'80':'100'}%}</style>${svg}`);
    await page.screenshot({ path:`public/icons/${name}.png`, omitBackground:!maskable });await page.close();
  }
} finally { await browser.close(); }
console.log('Ícones 192/512, maskable e Apple gerados a partir da marca existente.');
