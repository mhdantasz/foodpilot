import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';

const db = new PGlite(), results = [];
async function as(uid, task, role = 'authenticated') {
  await db.exec('begin');
  try { await db.exec(`set local role ${role}`); await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid || '']); const value = await task(); await db.exec('commit'); return value; }
  catch (error) { await db.exec('rollback'); throw error; }
}
const seller = async (action, input = {}) => (await db.query('select public.seller_operation($1,$2::jsonb) value', [action, JSON.stringify(input)])).rows[0].value;
const service = async (action, actor = null, input = {}) => (await db.query('select public.seller_account_service($1,$2,$3::jsonb) value', [action, actor, JSON.stringify(input)])).rows[0].value;
const svc = (action, actor, input) => as(null, () => service(action, actor, input), 'service_role');
const denied = task => assert.rejects(task, error => ['42501', '22023', '23505'].includes(error.code));
async function check(name, task) { await task(); results.push(name); console.log('OK ' + name); }
async function user() { const id = randomUUID(); await db.query('insert into auth.users values($1,$2)', [id, '{}']); return id; }
try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of (await readdir('supabase/migrations')).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile('supabase/migrations/' + file, 'utf8'));
  const owner = await user(), other = await user(), sellerUser = await user();
  const onboarding = uid => as(uid, () => db.query("select public.complete_onboarding('Teste contas','doces','escola')"));
  await onboarding(owner); await onboarding(other);
  const sid = (await as(owner, () => seller('create', { name: 'Vendedor teste' }))).id;
  let prepared;
  await check('RPC de credenciais e pepper não admite anon nem authenticated', async () => {
    for (const role of ['anon', 'authenticated']) {
      await denied(() => as(owner, () => service('prepare', owner, { seller_id: sid, name: 'Teste', username: 'tester' }), role));
      await denied(() => as(owner, () => db.query('select * from commerce_private.seller_login_secret'), role));
      await denied(() => as(owner, () => db.query('select * from commerce_private.seller_accounts'), role));
    }
  });
  await check('Serviço também valida gerente e tenant em prepare/bind', async () => {
    await denied(() => svc('prepare', sellerUser, { seller_id: sid, name: 'Teste', username: 'tester' }));
    await denied(() => svc('prepare', other, { seller_id: sid, name: 'Teste', username: 'tester' }));
    prepared = await svc('prepare', owner, { seller_id: sid, name: 'Teste', username: 'tester' });
    assert.match(prepared.secret, /^[0-9a-f]{64}$/);
  });
  await check('PIN de cinco dígitos vira senha Auth forte e determinística', async () => {
    const material = 'tester\u000000123';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(prepared.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(material))).toString('hex');
    assert.equal(signature, createHmac('sha256', prepared.secret).update(material).digest('hex'));
    assert.equal(signature.length, 64); assert.notEqual(signature, '00123');
  });
  await check('Vinculação cria login sem produtos nem membership administrativa', async () => {
    await svc('bind', owner, { seller_id: sid, name: 'Nome atualizado', username: 'tester', user_id: sellerUser });
    const portal = await as(sellerUser, () => seller('portal'));
    assert.equal(portal.seller.name, 'Nome atualizado'); assert.deepEqual(portal.offers, []);
    assert.equal((await db.query('select count(*) n from business_members where user_id=$1', [sellerUser])).rows[0].n, 0);
    assert.equal((await svc('lookup', null, { username: 'tester' })).user_id, sellerUser);
    await denied(() => svc('prepare', owner, { seller_id: sid, name: 'Teste', username: 'secondname' }));
  });
  await check('Listagem só inclui contas do negócio do gerente', async () => {
    const accounts = await svc('list', owner, {}); assert.equal(accounts[0].username, 'tester'); assert.equal(accounts[0].deleted, false);
    assert.deepEqual(await svc('list', other, {}), []); await denied(() => svc('list', sellerUser, {}));
  });
  await check('Login limita cinco tentativas persistentes por conta a cada15min', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await svc('throttle', null, { username: 'throttle-test', ip_hash: 'a' })).allowed, true);
    assert.equal((await svc('throttle', null, { username: 'throttle-test', ip_hash: 'b' })).allowed, false);
    await db.query("update commerce_private.seller_login_attempts set window_started=now()-interval '16 minutes' where bucket='login:throttle-test'");
    assert.equal((await svc('throttle', null, { username: 'throttle-test', ip_hash: 'b' })).allowed, true);
  });
  await check('IP compartilhado e orçamento global limitam nomes aleatórios', async () => {
    for (let i = 0; i < 50; i++) assert.equal((await svc('throttle', null, { username: 'ip-test-' + i, ip_hash: 'shared' })).allowed, true);
    assert.equal((await svc('throttle', null, { username: 'ip-next', ip_hash: 'shared' })).allowed, false);
    await db.query("update commerce_private.seller_login_attempts set attempts=500 where bucket='global'");
    assert.equal((await svc('throttle', null, { username: 'global-next', ip_hash: 'different' })).allowed, false);
  });
  let sale;
  await check('Histórico financeiro existe antes da exclusão', async () => {
    const product = (await as(owner, () => db.query("select public.save_product(null,'Bolo conta',null,null,true,$1::jsonb) id", [JSON.stringify([{ name: 'Chocolate', sale_price_cents: 1200, cost_price_cents: 800 }])]))).rows[0].id;
    const variant = (await db.query('select id from product_variants where product_id=$1', [product])).rows[0].id;
    const offer = (await as(owner, () => seller('offer', { seller_id: sid, variant_id: variant, price_cents: 1200, commission_cents: 200 }))).id;
    sale = (await as(sellerUser, () => seller('sale', { request_id: randomUUID(), payment_method: 'pix', items: [{ offer_id: offer, quantity: 1 }] }))).id;
  });
  await check('Excluir exige gerente proprietário e preserva vendas', async () => {
    await denied(() => svc('delete', other, { seller_id: sid }));
    await svc('delete', owner, { seller_id: sid });
    const original = (await db.query('select * from seller_sales where id=$1', [sale])).rows[0]; assert.equal(Number(original.total_cents), 1200);
    assert.equal((await as(owner, () => seller('team'))).sales.length, 1);
    assert.equal((await svc('list', owner, {}))[0].deleted, true);
    assert.equal(await svc('lookup', null, { username: 'tester' }), null);
  });
  await check('JWT antigo não lê portal nem vende após exclusão, mesmo reativando perfil', async () => {
    assert.equal(await as(sellerUser, () => seller('access')), null);
    await denied(() => as(sellerUser, () => seller('portal')));
    await denied(() => as(sellerUser, () => seller('sale', {})));
    await as(owner, () => seller('toggle', { seller_id: sid, active: true }));
    await denied(() => as(sellerUser, () => seller('portal')));
    await denied(() => onboarding(sellerUser));
    await denied(() => as(sellerUser, () => db.query("select commerce_private.seller_operation_v1('portal','{}')")));
  });
  await check('Novo acesso no mesmo vendedor não restaura JWT excluído nem apaga história', async () => {
    const replacement = await user();
    await svc('prepare', owner, { seller_id: sid, name: 'Novo acesso', username: 'replacement' });
    await svc('bind', owner, { seller_id: sid, name: 'Novo acesso', username: 'replacement', user_id: replacement });
    assert.equal((await as(replacement, () => seller('portal'))).sales.length, 1);
    await denied(() => as(sellerUser, () => seller('portal')));
    assert.equal((await svc('list', owner, {}))[0].username, 'replacement');
    await svc('delete', owner, { seller_id: sid }); await svc('delete', owner, { seller_id: sid });
  });
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/seller-accounts-rls-report.json', JSON.stringify({ complete: true, checks: results.length, results, limits: ['PGlite does not test deployed Auth or Edge HTTP.', 'Concurrent sessions require hosted integration verification.'] }, null, 2));
  console.log(results.length + ' verificações de contas gerenciadas aprovadas.');
} finally { await db.close(); }
