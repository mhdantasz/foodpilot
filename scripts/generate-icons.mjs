// Deterministic app sizes from the official MD cloche artwork selected by the owner.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [require.resolve('next/package.json')] }));
await mkdir('public/icons', { recursive: true });
for (const [name, size] of [['icon-192',192],['icon-512',512],['maskable-512',512],['apple-180',180]]) await sharp('public/brand/md-logo.png').resize(size,size).png().toFile(`public/icons/${name}.png`);
await sharp('public/brand/md-logo.png').resize(64,64).png().toFile('src/app/icon.png');
console.log('Ícones MD atualizados a partir da logo oficial.');
