begin;

-- Managed seller logins never gain membership or direct access to credentials.
create table commerce_private.seller_login_secret (
 singleton boolean primary key default true check(singleton),
 secret text not null check(length(secret)=64)
);
insert into commerce_private.seller_login_secret(singleton,secret)
 values(true,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
create table commerce_private.seller_accounts (
 id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.seller_profiles(id),
 user_id uuid not null unique references public.profiles(id), username text not null unique check(username ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), deleted_at timestamptz
);
create unique index seller_accounts_active_seller_idx on commerce_private.seller_accounts(seller_id) where deleted_at is null;
create index seller_accounts_actor_idx on commerce_private.seller_accounts(created_by);
create table commerce_private.seller_login_attempts (
 bucket text primary key, window_started timestamptz not null, attempts integer not null check(attempts>0)
);
alter table commerce_private.seller_login_secret enable row level security;
alter table commerce_private.seller_accounts enable row level security;
alter table commerce_private.seller_login_attempts enable row level security;
revoke all on commerce_private.seller_login_secret,commerce_private.seller_accounts,commerce_private.seller_login_attempts from public,anon,authenticated;

create function commerce_private.seller_account_service(p_action text,p_actor uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare bid uuid; sp public.seller_profiles%rowtype; ac commerce_private.seller_accounts%rowtype;
 sid uuid; uid uuid; login text; nm text; key text; hits integer; cap integer; allowed boolean:=true;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' then raise exception using errcode='22023',message='Dados inválidos.'; end if;
 if p_action='throttle' then
  -- The global budget also bounds abuse if an upstream IP header is absent or spoofed.
  foreach key in array array['global','ip:'||coalesce(p_input->>'ip_hash','unknown'),'login:'||coalesce(p_input->>'username','invalid')] loop
   cap:=case when key='global' then 500 when key like 'ip:%' then 50 else 5 end;
   insert into commerce_private.seller_login_attempts(bucket,window_started,attempts) values(key,now(),1)
   on conflict(bucket) do update set
    attempts=case when commerce_private.seller_login_attempts.window_started<=now()-interval '15 minutes' then 1 else commerce_private.seller_login_attempts.attempts+1 end,
    window_started=case when commerce_private.seller_login_attempts.window_started<=now()-interval '15 minutes' then now() else commerce_private.seller_login_attempts.window_started end
   returning attempts into hits;
   if hits>cap then allowed:=false; end if;
  end loop;
  -- Bounded-size pruning only; credentials and account history are never pruned.
  delete from commerce_private.seller_login_attempts where window_started<now()-interval '1 day';
  return jsonb_build_object('allowed',allowed);
 elsif p_action='lookup' then
  select * into ac from commerce_private.seller_accounts where username=p_input->>'username' and deleted_at is null;
  if ac.id is null or not exists(select 1 from public.seller_profiles where id=ac.seller_id and active and user_id=ac.user_id) then return 'null'::jsonb; end if;
  return jsonb_build_object('user_id',ac.user_id,'username',ac.username,'secret',(select secret from commerce_private.seller_login_secret where singleton));
 end if;
 if p_actor is null then raise exception using errcode='42501',message='Somente o gerente pode gerenciar acessos.'; end if;
 select business_id into bid from public.business_members where user_id=p_actor and role='owner' order by created_at,id limit 1;
 if bid is null then raise exception using errcode='42501',message='Somente o gerente pode gerenciar acessos.'; end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('seller_id',q.seller_id,'username',q.username,'deleted',q.deleted_at is not null)) from
   (select distinct on(a.seller_id) a.* from commerce_private.seller_accounts a join public.seller_profiles s on s.id=a.seller_id where s.business_id=bid order by a.seller_id,a.created_at desc,a.id desc) q),'[]'::jsonb);
 end if;
 sid:=(p_input->>'seller_id')::uuid;
 select * into sp from public.seller_profiles where id=sid and business_id=bid for update;
 if sp.id is null then raise exception using errcode='42501',message='Vendedor indisponível.'; end if;
 if p_action in ('prepare','bind') then
  login:=lower(btrim(p_input->>'username')); nm:=btrim(p_input->>'name');
  if login is null or login !~ '^[a-z0-9][a-z0-9._-]{2,39}$' or nm is null or length(nm) not between 1 and 100 then raise exception using errcode='22023',message='Informe nome e login válido de 3 a 40 caracteres.'; end if;
  if exists(select 1 from commerce_private.seller_accounts where username=login) then raise exception using errcode='22023',message='Este login não está disponível.'; end if;
  if sp.user_id is not null and not exists(select 1 from commerce_private.seller_accounts where seller_id=sid and user_id=sp.user_id and deleted_at is not null) then raise exception using errcode='22023',message='Este vendedor já possui um acesso. Exclua o acesso anterior antes de gerar outro.'; end if;
  if p_action='prepare' then return jsonb_build_object('username',login,'secret',(select secret from commerce_private.seller_login_secret where singleton)); end if;
  uid:=(p_input->>'user_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if uid is null or not exists(select 1 from public.profiles where id=uid) or exists(select 1 from public.business_members where user_id=uid) or exists(select 1 from public.seller_profiles where user_id=uid) then raise exception using errcode='22023',message='Conta indisponível para vinculação.'; end if;
  insert into commerce_private.seller_accounts(seller_id,user_id,username,created_by) values(sid,uid,login,p_actor);
  update public.seller_profiles set user_id=uid,name=nm,active=true where id=sid;
  update public.seller_invites set expires_at=now() where seller_id=sid and used_at is null;
  return jsonb_build_object('seller_id',sid,'username',login);
 elsif p_action='delete' then
  if sp.user_id is not null and exists(select 1 from public.business_members where user_id=sp.user_id) then raise exception using errcode='42501',message='Não é permitido excluir uma conta administrativa.'; end if;
  if sp.user_id is not null then
   if not exists(select 1 from commerce_private.seller_accounts where user_id=sp.user_id) then
    insert into commerce_private.seller_accounts(seller_id,user_id,username,created_by,deleted_at) values(sid,sp.user_id,'deleted-'||replace(sp.user_id::text,'-',''),p_actor,now());
   else update commerce_private.seller_accounts set deleted_at=coalesce(deleted_at,now()) where user_id=sp.user_id; end if;
  end if;
  update public.seller_profiles set active=false where id=sid;
  update public.seller_invites set expires_at=now() where seller_id=sid and used_at is null;
  return jsonb_build_object('user_id',sp.user_id,'seller_id',sid);
 end if;
 raise exception using errcode='22023',message='Operação inválida.';
exception when invalid_text_representation then raise exception using errcode='22023',message='Identificador inválido.';
end;
$$;
revoke all on function commerce_private.seller_account_service(text,uuid,jsonb) from public,anon,authenticated;
create function public.seller_account_service(p_action text,p_actor uuid default null,p_input jsonb default '{}'::jsonb) returns jsonb
language sql security definer set search_path='' as $$ select commerce_private.seller_account_service(p_action,p_actor,p_input); $$;
revoke all on function public.seller_account_service(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.seller_account_service(text,uuid,jsonb) to service_role;

-- Existing JWTs of deleted users must fail immediately, without waiting for token expiry.
alter function commerce_private.seller_operation(text,jsonb) rename to seller_operation_v1;
revoke all on function commerce_private.seller_operation_v1(text,jsonb) from public,anon,authenticated;
create function commerce_private.seller_operation(p_action text,p_input jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from commerce_private.seller_accounts where user_id=auth.uid() and deleted_at is not null) then
  if p_action='access' then return 'null'::jsonb; end if;
  raise exception using errcode='42501',message='Este acesso foi excluído. Procure o gerente.';
 end if;
 return commerce_private.seller_operation_v1(p_action,p_input);
end;
$$;
revoke all on function commerce_private.seller_operation(text,jsonb) from public,anon,authenticated;
grant execute on function commerce_private.seller_operation(text,jsonb) to authenticated;
create or replace function public.seller_operation(p_action text,p_input jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select commerce_private.seller_operation(p_action,p_input); $$;
revoke all on function public.seller_operation(text,jsonb) from public,anon,authenticated;
grant execute on function public.seller_operation(text,jsonb) to authenticated;
commit;
