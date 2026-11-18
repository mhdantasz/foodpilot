import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { invitationReturnTo, invitationPath, confirmationReturnTo, authConfirmationUrl } from '../src/lib/auth/return-to.ts';

const code = 'a'.repeat(64);
test('invitation survives a same-origin login return without carrying arbitrary parameters', () => {
  assert.equal(invitationReturnTo(`/convite?code=${code}&role=owner&next=https://evil.test`), `/convite?code=${code}`);
  assert.equal(invitationPath(code), `/convite?code=${code}`);
});
test('reject external, protocol-relative and disguised external return destinations', () => {
  for (const value of [`https://evil.test/convite?code=${code}`, `//evil.test/convite?code=${code}`, `\\evil.test/convite?code=${code}`, `javascript:alert(1)`, `/convite?code=${code}#fragment`]) assert.equal(invitationReturnTo(value), null, value);
});
test('reject administrative and malformed destinations', () => {
  for (const value of [`/equipe?code=${code}`, `/onboarding`, '/convite', '/convite?code=short', `/convite?code=${'x'.repeat(129)}`, '/convite?code=%3Cscript%3E', null, {}, ['code']]) assert.equal(invitationReturnTo(value), null);
});
test('opaque code is preserved exactly and UUID tokens remain supported', () => {
  for (const token of [code, '6787b6ce-799a-43a6-a0de-05d2c8c70872', 'Ab_cD-012345678901234567890']) assert.equal(invitationPath(token), `/convite?code=${token}`);
});
test('password recovery always takes precedence over a pending team invitation', () => {
  assert.equal(confirmationReturnTo(true, `/convite?code=${code}`, '/'), '/redefinir-senha');
});
test('confirmation on another device falls back safely and original invitation can be reopened', () => {
  assert.equal(confirmationReturnTo(false, undefined, '/onboarding'), '/onboarding');
  assert.equal(confirmationReturnTo(false, 'https://evil.test', '/'), '/');
  assert.equal(confirmationReturnTo(false, `/convite?code=${code}`, '/onboarding'), `/convite?code=${code}`);
});
test('existing signup email template receives a query-free callback and a separately parseable token_hash', async () => {
  const template = await readFile(new URL('../supabase/templates/confirmation.html', import.meta.url), 'utf8');
  const rendered = template.replaceAll('{{ .RedirectTo }}', authConfirmationUrl('https://app.example/')).replaceAll('{{ .TokenHash }}', 'synthetic-token');
  const href = rendered.match(/href="([^"]+)"/)?.[1];
  assert.ok(href);
  const url = new URL(href.replaceAll('&amp;', '&'));
  assert.equal(url.pathname, '/auth/confirm');
  assert.equal(url.searchParams.get('token_hash'), 'synthetic-token');
  assert.equal(url.searchParams.get('type'), 'signup');
  assert.throws(() => authConfirmationUrl('https://name:password@app.example/'));
});
