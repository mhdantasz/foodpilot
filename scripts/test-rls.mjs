import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';

const db = new PGlite();
const results = [];
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const c = '00000000-0000-4000-8000-000000000003';
const d = '00000000-0000-4000-8000-000000000004';
async function check(name, task) { await task(); results.push(name); console.log(`OK ${name}`); }
async function asUser(id, task, role = 'authenticated') {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id || '']);
    const result = await task();
    await db.exec('commit');
    return result;
  } catch (error) { await db.exec('rollback'); throw error; }
}
async function denied(task) { await assert.rejects(task, error => error.code === '42501'); }
async function count(sql, params = []) { return Number((await db.query(sql, params)).rows[0].count); }
try {
  // Substitui somente as interfaces fornecidas pela plataforma Supabase, não as políticas.
  // PGlite executa PostgreSQL real com roles, permissões e RLS. Auth HTTP não é simulado aqui.
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  for (const filename of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${filename}`, 'utf8'));
  }
  for (const [id, name] of [[a,'Usuário A'],[b,'Usuário B'],[c,'Usuário C'],[d,'Usuário D']]) {
    await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)', [id, JSON.stringify({ full_name: name, role: 'owner' })]);
  }
  await check('Trigger cria exatamente um profile por usuário', async () => assert.equal(await count('select count(*) from public.profiles'), 4));
  await check('Metadata não cria memberships nem concede owner', async () => assert.equal(await count('select count(*) from public.business_members'), 0));
  const rpc = name => db.query("select public.complete_onboarding($1,'doces','encomendas') as id", [name]);
  const bizA = (await asUser(a, () => rpc('Negócio A'))).rows[0].id;
  const bizB = (await asUser(b, () => rpc('Negócio B'))).rows[0].id;
  await check('RPC cria business e owner correspondentes', async () => {
    assert.equal(await count("select count(*) from public.business_members where role='owner'"), 2);
    assert.notEqual(bizA, bizB);
  });
  await check('RPC idempotente: retry retorna mesmo negócio', async () => {
    assert.equal((await asUser(a, () => rpc('Outro nome'))).rows[0].id, bizA);
    assert.equal(await count('select count(*) from public.businesses'), 2);
  });
  for (const [label, user, own, foreign, otherUser] of [['A',a,bizA,bizB,b],['B',b,bizB,bizA,a]]) {
    await check(`${label} SELECT próprio negócio permitido`, () => asUser(user, async () => assert.equal(await count('select count(*) from public.businesses where id=$1',[own]),1)));
    await check(`${label} UUID alheio / SELECT bloqueado`, () => asUser(user, async () => assert.equal(await count('select count(*) from public.businesses where id=$1',[foreign]),0)));
    await check(`${label} SELECT sem filtro só retorna seu negócio`, () => asUser(user, async () => assert.equal(await count('select count(*) from public.businesses'),1)));
    await check(`${label} UPDATE próprio negócio permitido`, () => asUser(user, async () => assert.equal((await db.query('update public.businesses set name=$1 where id=$2 returning id',[`Negócio ${label} atualizado`,own])).rows.length,1)));
    await check(`${label} UPDATE alheio afeta zero registros`, () => asUser(user, async () => assert.equal((await db.query("update public.businesses set name='INVADIDO' where id=$1 returning id",[foreign])).rows.length,0)));
    await check(`${label} profile alheio não pode ser lido/editado`, () => asUser(user, async () => {
      assert.equal(await count('select count(*) from public.profiles where id=$1',[otherUser]),0);
      assert.equal((await db.query("update public.profiles set full_name='INVADIDO' where id=$1 returning id",[otherUser])).rows.length,0);
      assert.equal((await db.query("update public.profiles set full_name='Nome permitido' where id=$1 returning id",[user])).rows.length,1);
    }));
    await check(`${label} só visualiza a própria membership`, () => asUser(user, async () => assert.equal(await count('select count(*) from public.business_members'),1)));
    await check(`${label} INSERT membership indevida negado`, () => denied(() => asUser(user, () => db.query("insert into public.business_members(business_id,user_id,role) values($1,$2,'owner')",[foreign,user]))));
    await check(`${label} INSERT business direto negado`, () => denied(() => asUser(user, () => db.exec("insert into public.businesses(name) values('INDEVIDO')"))));
    await check(`${label} troca de role/business_id negada`, () => denied(() => asUser(user, () => db.query("update public.business_members set business_id=$1, role='owner' where user_id=$2",[foreign,user]))));
    await check(`${label} DELETE membership negado`, () => denied(() => asUser(user, () => db.query('delete from public.business_members where user_id=$1',[user]))));
    await check(`${label} alterar identidade do profile negado`, () => denied(() => asUser(user, () => db.query('update public.profiles set id=$1 where id=$2',[otherUser,user]))));
    await check(`${label} DELETE business negado`, () => denied(() => asUser(user, () => db.query('delete from public.businesses where id=$1',[own]))));
  }
  await check('Usuário sem vínculo não lê negócios/memberships', () => asUser(c, async () => {
    assert.equal(await count('select count(*) from public.businesses'),0);
    assert.equal(await count('select count(*) from public.business_members'),0);
  }));
  await check('RPC rejeita parâmetros inválidos sem criar dados', async () => {
    await assert.rejects(() => asUser(c, () => db.exec("select public.complete_onboarding('x','doces','escola')")), e => e.code === '22023');
    await assert.rejects(() => asUser(c, () => db.exec("select public.complete_onboarding('Válido','invalido','escola')")), e => e.code === '22023');
    assert.equal(await count('select count(*) from public.businesses'),2);
  });
  await check('Sem auth.uid RPC negada', () => denied(() => asUser(null, () => rpc('Sem usuário'))));
  await check('Anon não lê nenhuma das três tabelas', async () => {
    for (const table of ['profiles','businesses','business_members']) await denied(() => asUser(null, () => db.exec(`select * from public.${table}`), 'anon'));
  });
  await check('Anon não executa onboarding', () => denied(() => asUser(null, () => rpc('Anônimo'), 'anon')));
  await check('Falha na membership reverte business transacionalmente', async () => {
    await db.exec(`create function public.fail_test_member() returns trigger language plpgsql as $$ begin raise exception 'forced failure'; end $$;
      create trigger fail_test before insert on public.business_members for each row execute function public.fail_test_member();`);
    await assert.rejects(() => asUser(d, () => rpc('Precisa reverter')));
    assert.equal(await count('select count(*) from public.businesses'),2);
    assert.equal(await count('select count(*) from public.business_members'),2);
    await db.exec('drop trigger fail_test on public.business_members; drop function public.fail_test_member()');
  });
  await check('business_id + user_id rejeita duplicação', async () => {
    await assert.rejects(() => db.query("insert into public.business_members(business_id,user_id,role) values($1,$2,'member')",[bizA,a]), e => e.code === '23505');
  });
  await check('Schema permite múltiplos negócios futuros por usuário', async () => {
    await db.query("insert into public.business_members(business_id,user_id,role) values($1,$2,'member')",[bizB,a]);
    await asUser(a, async () => assert.equal(await count('select count(*) from public.businesses'),2));
    await asUser(a, async () => assert.equal((await db.query("update public.businesses set name='SEM PERMISSAO' where id=$1 returning id",[bizB])).rows.length,0));
  });
  await check('BRL e America/Manaus são padrões', async () => {
    const { rows } = await db.query('select currency,timezone from public.businesses');
    assert.ok(rows.every(row => row.currency === 'BRL' && row.timezone === 'America/Manaus'));
  });
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/rls-report.json', JSON.stringify({ engine: 'PostgreSQL via PGlite; auth.uid/interfaces Supabase mínimas de teste', tests: results, passed: results.length, liveSupabase: false }, null, 2));
  console.log(`\n${results.length} verificações de SQL/RLS passaram. Isso não valida Supabase Auth/HTTP real.`);
} finally { await db.close(); }
