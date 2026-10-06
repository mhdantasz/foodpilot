-- Executar com acesso administrativo APENAS no desenvolvimento.
-- SET ROLE reproduz o papel de PostgREST; nenhuma consulta é testada como admin.
-- Fixtures e resultados são revertidos ao final. Não altera usuários existentes.
begin;
create temporary table phase2_fixture (label text primary key, user_id uuid, business_id uuid);
create temporary table phase2_results (test text);
grant select on phase2_fixture to authenticated;
grant insert, select on phase2_results to authenticated;
insert into phase2_fixture(label,user_id) values ('A',gen_random_uuid()),('B',gen_random_uuid());
insert into auth.users(id,raw_user_meta_data)
select user_id,jsonb_build_object('full_name','Fixture isolamento '||label) from phase2_fixture;
select set_config('request.jwt.claim.sub',(select user_id::text from phase2_fixture where label='A'),true);
set local role authenticated;
select public.complete_onboarding('Fixture negócio A','doces','encomendas');
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from phase2_fixture where label='B'),true);
set local role authenticated;
select public.complete_onboarding('Fixture negócio B','bolos','escola');
reset role;
update phase2_fixture f set business_id=m.business_id from public.business_members m where m.user_id=f.user_id;

select set_config('request.jwt.claim.sub',(select user_id::text from phase2_fixture where label='A'),true);
set local role authenticated;
do $$
declare own_id uuid; foreign_id uuid; uid uuid; affected integer;
begin
  select business_id,user_id into own_id,uid from phase2_fixture where label='A';
  select business_id into foreign_id from phase2_fixture where label='B';
  if (select count(*) from public.businesses where id=own_id)<>1 then raise exception 'A próprio inacessível'; end if;
  if exists(select 1 from public.businesses where id=foreign_id) then raise exception 'A vazou UUID B'; end if;
  if (select count(*) from public.businesses)<>1 then raise exception 'A SELECT sem filtro vazou'; end if;
  update public.businesses set name='INVASÃO' where id=foreign_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'A UPDATE alheio permitido'; end if;
  begin
    insert into public.business_members(business_id,user_id,role) values(foreign_id,uid,'owner');
    raise exception 'A INSERT indevido permitido';
  exception when insufficient_privilege then null;
  end;
  if public.complete_onboarding('Retry A','doces','encomendas')<>own_id then raise exception 'A duplicou onboarding'; end if;
  if exists(select 1 from public.profiles where id<>uid) then raise exception 'A profile alheio exposto'; end if;
  if exists(select 1 from public.business_members where user_id<>uid) then raise exception 'A membership alheia exposta'; end if;
  insert into phase2_results values ('A: próprio permitido; UUID/SELECT/UPDATE B bloqueados; INSERT negado; retry idempotente; profiles/memberships isolados');
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from phase2_fixture where label='B'),true);
set local role authenticated;
do $$
declare own_id uuid; foreign_id uuid; uid uuid; affected integer;
begin
  select business_id,user_id into own_id,uid from phase2_fixture where label='B';
  select business_id into foreign_id from phase2_fixture where label='A';
  if (select count(*) from public.businesses where id=own_id)<>1 then raise exception 'B próprio inacessível'; end if;
  if exists(select 1 from public.businesses where id=foreign_id) then raise exception 'B vazou UUID A'; end if;
  if (select count(*) from public.businesses)<>1 then raise exception 'B SELECT sem filtro vazou'; end if;
  update public.businesses set name='INVASÃO' where id=foreign_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'B UPDATE alheio permitido'; end if;
  begin
    insert into public.business_members(business_id,user_id,role) values(foreign_id,uid,'owner');
    raise exception 'B INSERT indevido permitido';
  exception when insufficient_privilege then null;
  end;
  if public.complete_onboarding('Retry B','bolos','escola')<>own_id then raise exception 'B duplicou onboarding'; end if;
  if exists(select 1 from public.profiles where id<>uid) then raise exception 'B profile alheio exposto'; end if;
  if exists(select 1 from public.business_members where user_id<>uid) then raise exception 'B membership alheia exposta'; end if;
  insert into phase2_results values ('B: próprio permitido; UUID/SELECT/UPDATE A bloqueados; INSERT negado; retry idempotente; profiles/memberships isolados');
end $$;
reset role;
select test from phase2_results order by test;
rollback;
