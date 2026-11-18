import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const next = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
console.log('Prévia de desenvolvimento: http://127.0.0.1:3018/preview-vendedores?view=seller');
console.log('Usa dados de exemplo; não configure credenciais de produção para revisar esta demonstração.');
const child = spawn(process.execPath, [next, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3018'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, SELLERS_UI_PREVIEW: '1' },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
