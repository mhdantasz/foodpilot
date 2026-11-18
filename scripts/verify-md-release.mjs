// Real Auth/API verification against a dedicated release environment.
// Input JSON arrives on hidden stdin; credentials and tokens are never printed or saved.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const queue = [], waiting = [];
let buffer = '';
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  for (;;) {
    const index = buffer.indexOf('\n'); if (index < 0) break;
    const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1);
    if (!line) continue;
    const next = waiting.shift(); if (next) next(line); else queue.push(line);
  }
});
const input = () => queue.length ? Promise.resolve(queue.shift()) : new Promise(resolve => waiting.push(resolve));
console.log('READY_FOR_HIDDEN_RELEASE_CONFIG');
const config = JSON.parse(await input());
const checks = [];
const identifiers = { owner: config.ownerId, sellers: [], users: [], business: null };
const tokenFor = async (email, password) => {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: config.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const data = await response.json(); assert.ok(response.ok && data.access_token, `Auth sign-in status ${response.status}`); return data.access_token;
};
async function rpc(token, name, args = {}, mustSucceed = true) {
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: config.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const data = await response.json(); if (mustSucceed) assert.ok(response.ok, `RPC ${name} status ${response.status}`); else assert.ok(!response.ok, `RPC ${name} unexpectedly allowed`); return data;
}
const operation = (token, action, args = {}, ok = true) => rpc(token, 'seller_operation', { p_action: action, p_input: args }, ok);
async function account(token, action, args = {}, mustSucceed = true) {
  const response = await fetch(`${config.url}/functions/v1/seller-accounts`, { method: 'POST', headers: { apikey: config.key, Authorization: `Bearer ${token || config.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...args }) });
  const data = await response.json(); if (mustSucceed) assert.ok(response.ok && data.ok === true, `Account ${action} status ${response.status}`); else assert.ok(!response.ok || data.ok === false, `Account ${action} unexpectedly allowed`); return data;
}
function passed(message) { checks.push(message); console.log(`OK ${message}`); }
try {
  const owner = await tokenFor(config.email, config.password);
  const business = await rpc(owner, 'complete_onboarding', { p_name: `QA MD ${config.run}`, p_business_type: 'bolos', p_sales_channel: 'escola' }); identifiers.business = business;
  const suffix = config.run.replaceAll('-', '').slice(0, 12);
  const first = await operation(owner, 'create', { name: 'QA Vendedor A', location: 'Ambiente de verificação' });
  const second = await operation(owner, 'create', { name: 'QA Vendedor B', location: 'Ambiente de verificação' });
  identifiers.sellers = [first.id, second.id];
  const loginA = `qa.a.${suffix}`, loginB = `qa.b.${suffix}`;
  await account(owner, 'create', { seller_id: first.id, name: 'QA Vendedor A', username: loginA, password: config.pin });
  await account(owner, 'create', { seller_id: second.id, name: 'QA Vendedor B', username: loginB, password: config.customPassword });
  const a = await account(null, 'login', { username: loginA, password: config.pin });
  const b = await account(null, 'login', { username: loginB, password: config.customPassword });
  for (const session of [a, b]) identifiers.users.push(JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString()).sub);
  passed('Login real com PIN de cinco dígitos e senha própria');
  for (const session of [a, b]) { const portal = await operation(session.access_token, 'portal'); assert.equal(portal.offers.length, 0); assert.equal(portal.sales.length, 0); }
  passed('Primeiro login dos dois vendedores sem produtos ou vendas');
  const product = await rpc(owner, 'save_product', { p_id: null, p_name: 'Produto QA MD', p_description: null, p_category_id: null, p_active: true, p_variants: [{ name: 'Porção de teste', sale_price_cents: 1300, cost_price_cents: 800 }] });
  const variantResponse = await fetch(`${config.url}/rest/v1/product_variants?product_id=eq.${product}&select=id`, { headers: { apikey: config.key, Authorization: `Bearer ${owner}` } });
  const variants = await variantResponse.json(); assert.equal(variants.length, 1);
  const offer = await operation(owner, 'offer', { seller_id: first.id, variant_id: variants[0].id, price_cents: 1200, commission_cents: 200, active: true });
  const portalA = await operation(a.access_token, 'portal'); assert.equal(portalA.offers.length, 1); assert.equal(portalA.offers[0].price_cents, 1200);
  assert.equal((await operation(b.access_token, 'portal')).offers.length, 0);
  assert.ok(!JSON.stringify(portalA).includes('cost_cents'));
  passed('Gerente cadastra produto, define preço e libera apenas ao vendedor escolhido');
  const payload = { request_id: randomUUID(), payment_method: 'pix', items: [{ offer_id: offer.id, quantity: 2 }] };
  const sale = await operation(a.access_token, 'sale', payload); assert.equal((await operation(a.access_token, 'sale', payload)).id, sale.id);
  await operation(b.access_token, 'sale', { ...payload, request_id: randomUUID() }, false);
  const dashboard = await operation(owner, 'team'); assert.equal(dashboard.totals.revenue_cents, 2400); assert.equal(dashboard.totals.commission_cents, 400); assert.equal(dashboard.totals.sale_count, 1);
  passed('Venda real, cálculo servidor, retry sem duplicata e isolamento entre vendedores');
  await account(b.access_token, 'create', { seller_id: first.id, name: 'Não permitido', username: `qa.block.${suffix}`, password: config.pin }, false);
  passed('Vendedor não pode criar usuários pelo endpoint administrativo');
  console.log(JSON.stringify({ stage: 'HISTORY_FIXTURE_REQUIRED', saleId: sale.id, sellerId: first.id, ...identifiers }));
  await input();
  const end = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - 86400000));
  const startDate = new Date(`${end}T12:00:00Z`); startDate.setUTCDate(startDate.getUTCDate() - 6); const start = startDate.toISOString().slice(0, 10);
  const week = await operation(owner, 'close', { seller_id: first.id, starts_on: start, ends_on: end, request_id: randomUUID() });
  await operation(owner, 'pay', { week_id: week.id });
  await operation(owner, 'cancel', { sale_id: sale.id, reason: 'Tentativa QA após fechamento' }, false);
  passed('Fechamento semanal real, registro de pagamento e histórico fechado protegido');
  await account(owner, 'delete', { seller_id: first.id });
  await operation(a.access_token, 'portal', {}, false);
  await account(null, 'login', { username: loginA, password: config.pin }, false);
  assert.equal((await operation(owner, 'team')).totals.sale_count, 1);
  passed('Exclusão bloqueia login e JWT anterior');
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/md-release-real-api.json', JSON.stringify({ complete: true, checks, identifiers, credentialsPersisted: false }, null, 2));
  console.log(JSON.stringify({ complete: true, checks: checks.length, identifiers }));
} catch (error) { console.error(JSON.stringify({ complete: false, error: error.message, checks, identifiers })); process.exitCode = 1; }
finally { if (process.stdin.isTTY) process.stdin.setRawMode(false); process.stdin.pause(); }
