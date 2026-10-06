import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { integrationConfig } from './test-env.mjs';
const config = integrationConfig();
if (!config) throw new Error('Configure Supabase e duas contas de teste distintas em .env.test.local. Veja docs/security.md. Nenhum teste real foi executado.');
const client = () => createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
const a = client(); const b = client(); const anonymous = client();
const results = [];
async function check(name, task) { await task(); results.push(name); console.log(`OK ${name}`); }
async function login(user, email, password) {
  const { data, error } = await user.auth.signInWithPassword({ email, password });
  assert.equal(error, null, 'A conta de teste deve existir e estar confirmada.');
  return data.user.id;
}
try {
  const [userA,userB] = await Promise.all([login(a,config.aEmail,config.aPassword),login(b,config.bEmail,config.bPassword)]);
  assert.notEqual(userA,userB,'As contas precisam ser distintas');
  async function onboard(user, name) {
    const { data,error } = await user.rpc('complete_onboarding',{ p_name: name, p_business_type:'doces', p_sales_channel:'encomendas' });
    assert.equal(error,null,'Aplique as migrations antes de testar'); return data;
  }
  const businessA = await onboard(a,'Teste de isolamento A');
  const businessB = await onboard(b,'Teste de isolamento B');
  assert.notEqual(businessA,businessB,'As contas precisam pertencer a negócios distintos');
  await check('RPC concorrente e retries preservam o mesmo negócio', async () => {
    const ids = await Promise.all(Array.from({ length:4 }, () => onboard(a,'Retry não duplica')));
    assert.ok(ids.every(id => id === businessA));
  });
  for (const [label,user,own,foreign,userId,otherId] of [['A',a,businessA,businessB,userA,userB],['B',b,businessB,businessA,userB,userA]]) {
    await check(`${label} consulta própria por UUID`,async () => {
      const { data,error } = await user.from('businesses').select('id').eq('id',own); assert.equal(error,null); assert.equal(data.length,1);
    });
    await check(`${label} SELECT alheio por UUID bloqueado`,async () => {
      const { data,error } = await user.from('businesses').select('id').eq('id',foreign); assert.equal(error,null); assert.deepEqual(data,[]);
    });
    await check(`${label} SELECT sem filtro não vaza outros negócios`,async () => {
      const { data,error } = await user.from('businesses').select('id'); assert.equal(error,null); assert.deepEqual(data.map(row => row.id),[own]);
    });
    await check(`${label} UPDATE alheio afeta zero linhas`,async () => {
      const { data,error } = await user.from('businesses').update({ name:'ACESSO INDEVIDO' }).eq('id',foreign).select('id'); assert.equal(error,null); assert.deepEqual(data,[]);
    });
    await check(`${label} INSERT membership indevida negado`,async () => {
      const { error } = await user.from('business_members').insert({ business_id:foreign,user_id:userId,role:'owner' }); assert.ok(error); assert.equal(error.code,'42501');
    });
    await check(`${label} INSERT business direto negado`,async () => {
      const { error } = await user.from('businesses').insert({ name:'INDEVIDO' }); assert.ok(error); assert.equal(error.code,'42501');
    });
    await check(`${label} alteração da associação negada`,async () => {
      const { error } = await user.from('business_members').update({ business_id:foreign,role:'owner' }).eq('user_id',userId); assert.ok(error); assert.equal(error.code,'42501');
    });
    await check(`${label} profile próprio acessível e alheio isolado`,async () => {
      const ownResult = await user.from('profiles').select('id').eq('id',userId); assert.equal(ownResult.error,null); assert.equal(ownResult.data.length,1);
      const foreignResult = await user.from('profiles').select('id').eq('id',otherId); assert.equal(foreignResult.error,null); assert.deepEqual(foreignResult.data,[]);
      const update = await user.from('profiles').update({ full_name:'INDEVIDO' }).eq('id',otherId).select('id'); assert.equal(update.error,null); assert.deepEqual(update.data,[]);
    });
    await check(`${label} membership owner pertence ao usuário certo`,async () => {
      const { data,error } = await user.from('business_members').select('*'); assert.equal(error,null); assert.equal(data.length,1); assert.equal(data[0].business_id,own); assert.equal(data[0].role,'owner');
    });
  }
  await check('Anônimo não consulta nenhuma tabela',async () => {
    for (const table of ['profiles','businesses','business_members']) { const { error } = await anonymous.from(table).select('id'); assert.ok(error); assert.equal(error.code,'42501'); }
  });
  await check('Anônimo não cria negócio via RPC',async () => {
    const { error } = await anonymous.rpc('complete_onboarding',{ p_name:'Inválido',p_business_type:'doces',p_sales_channel:'escola' }); assert.ok(error); assert.equal(error.code,'42501');
  });
  await mkdir('test-results',{ recursive:true });
  await writeFile('test-results/integration-report.json',JSON.stringify({ engine:'Supabase Auth + PostgREST real', passed:results.length, tests:results },null,2));
  console.log(`${results.length} testes reais de isolamento passaram.`);
} finally { await Promise.all([a.auth.signOut({ scope:'local' }),b.auth.signOut({ scope:'local' })]); }
