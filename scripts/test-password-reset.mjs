import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { loadTestEnvironment } from './test-env.mjs';

// Apenas a conta dedicada de desenvolvimento A; altera sua senha de teste.
// Não simula recuperação por email: verifica a operação de senha autenticada.
loadTestEnvironment();
const email = process.env.TEST_USER_A_EMAIL;
const oldPassword = process.env.TEST_USER_A_PASSWORD;
assert.ok(email && oldPassword, 'Configure a conta de teste A.');
const base = process.env.BASE_URL || 'http://localhost:3000';
const newPassword = randomBytes(24).toString('base64url') + 'Aa1!';
const browser = await chromium.launch();
const errors = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  async function login(password) {
    await page.goto(base + '/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  }
  await login(oldPassword);
  await page.waitForURL(base + '/');
  await page.goto(base + '/redefinir-senha');
  await page.getByLabel('Nova senha', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar senha').fill(newPassword);
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await page.waitForURL('**/login?senha=alterada');
  // Guarda a senha nova imediatamente após confirmar sucesso, mesmo se um check posterior falhar.
  let local = await readFile('.env.test.local', 'utf8');
  local = local.replace(/^TEST_USER_A_PASSWORD=.*$/m, 'TEST_USER_A_PASSWORD=' + newPassword);
  if (process.env.TEST_SIGNUP_EMAIL === email) local = local.replace(/^TEST_SIGNUP_PASSWORD=.*$/m, 'TEST_SIGNUP_PASSWORD=' + newPassword);
  await writeFile('.env.test.local', local);
  await page.goto(base + '/configuracoes');
  assert.equal(new URL(page.url()).pathname, '/login');
  await login(oldPassword);
  await page.locator('.form-message[role=alert]').filter({ hasText: 'Email ou senha incorretos' }).waitFor();
  await login(newPassword);
  await page.waitForURL(base + '/');
  await page.goto(base + '/configuracoes');
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await page.waitForURL('**/login');
  assert.deepEqual(errors, []);
  await writeFile('test-results/password-report.json', JSON.stringify({
    authenticatedPasswordChange: true, automaticLogout: true, oldPasswordRejected: true,
    newPasswordAccepted: true, privateRouteBlockedAfterChange: true, errors,
    emailDeliveryAndRecoveryCallback: 'Não testados; requer configuração de URL/template no painel',
  }, null, 2));
  console.log('OK: senha alterada com sessão validada; logout automático; senha antiga rejeitada; nova aceita; rota privada protegida. Credenciais atualizadas somente no arquivo local ignorado.');
} finally { await browser.close(); }
