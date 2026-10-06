// Dev-only provisioning recipe. Never part of application signup or a migration.
// SQL is deliberately NOT executed here: an operator must review/apply it in dev.
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadTestEnvironment } from './test-env.mjs';
loadTestEnvironment();
if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://hbkrcznikmrelkxxcjfq.supabase.co') throw new Error('Esta fixture é exclusiva do projeto de desenvolvimento documentado.');
const id=randomUUID(),email=`phase3-ui-${id.slice(0,8)}@example.invalid`,password='T3!'+randomBytes(24).toString('hex');
const local=await readFile('.env.test.local','utf8');
const updated=local.replace(/^(TEST_UI_EMAIL|TEST_UI_PASSWORD|TEST_SIGNUP_EMAIL|TEST_SIGNUP_PASSWORD|TEST_SIGNUP_PRECONFIRMED)=.*\r?\n?/gm,'');
await writeFile('.env.test.local',updated+`\nTEST_UI_EMAIL=${email}\nTEST_UI_PASSWORD=${password}\nTEST_SIGNUP_EMAIL=${email}\nTEST_SIGNUP_PASSWORD=${password}\nTEST_SIGNUP_PRECONFIRMED=1\n`);
const sql=`-- Exclusive development fixture; review project before executing.\nbegin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
values('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Pessoa de teste UI Fase 3"}',now(),now(),'','','','');
insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at)
values(gen_random_uuid(),'${id}','${id}','{"sub":"${id}","email":"${email}"}','email',now(),now());
commit;\n`;
await mkdir('test-results',{recursive:true});await writeFile('test-results/ui-fixture.sql',sql);
console.log('Fixture preparada. Revise/aplique test-results/ui-fixture.sql exclusivamente no desenvolvimento; depois execute check:ui e check:ui:commerce. Senha gerada somente em arquivos locais ignorados. SMTP não será retestado neste modo.');
