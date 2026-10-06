begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Minha conta' check (char_length(full_name) between 1 and 100),
  phone text check (char_length(phone) <= 30),
  avatar_url text check (char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  business_type text check (char_length(business_type) <= 80),
  -- Personalização de onboarding; não representa uma entidade locations.
  sales_channel text check (sales_channel in ('escola','faculdade','cursinho','trabalho','encomendas','outro')),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'America/Manaus' check (char_length(timezone) between 3 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create index business_members_user_idx on public.business_members(user_id, created_at, id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger businesses_updated before update on public.businesses for each row execute function public.set_updated_at();
revoke all on function public.set_updated_at() from public, anon, authenticated;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'),100),''), 'Minha conta'));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Também cobre usuários cadastrados antes da migration.
insert into public.profiles (id, full_name)
select id, coalesce(nullif(left(btrim(raw_user_meta_data ->> 'full_name'),100),''),'Minha conta') from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;

revoke all on public.profiles, public.businesses, public.business_members from public, anon, authenticated;
grant select on public.profiles, public.businesses, public.business_members to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant update (name, business_type, sales_channel) on public.businesses to authenticated;

create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Apenas a própria associação. Não referencia businesses e não há recursão.
create policy members_read_self on public.business_members for select to authenticated
using (user_id = (select auth.uid()));
create policy businesses_read_member on public.businesses for select to authenticated
using (exists (select 1 from public.business_members m where m.business_id = businesses.id and m.user_id = (select auth.uid())));
create policy businesses_update_owner on public.businesses for update to authenticated
using (exists (select 1 from public.business_members m where m.business_id = businesses.id and m.user_id = (select auth.uid()) and m.role = 'owner'))
with check (exists (select 1 from public.business_members m where m.business_id = businesses.id and m.user_id = (select auth.uid()) and m.role = 'owner'));

create function public.complete_onboarding(p_name text, p_business_type text, p_sales_channel text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Profile required' using errcode = '42501';
  end if;
  -- Serializa onboarding por usuário, incluindo solicitações concorrentes/retries.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  select business_id into v_business from public.business_members
    where user_id = v_user order by created_at, id limit 1;
  if v_business is not null then return v_business; end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 100 then
    raise exception 'Invalid business name' using errcode = '22023';
  end if;
  if p_business_type is null or p_business_type not in ('bolos','salgados','doces','marmitas','lanches','bebidas','outro')
     or p_sales_channel is null or p_sales_channel not in ('escola','faculdade','cursinho','trabalho','encomendas','outro') then
    raise exception 'Invalid onboarding options' using errcode = '22023';
  end if;
  insert into public.businesses (name, business_type, sales_channel)
    values (btrim(p_name), p_business_type, p_sales_channel) returning id into v_business;
  insert into public.business_members (business_id, user_id, role) values (v_business, v_user, 'owner');
  return v_business;
end;
$$;
revoke all on function public.complete_onboarding(text,text,text) from public, anon, authenticated;
grant execute on function public.complete_onboarding(text,text,text) to authenticated;

comment on function public.complete_onboarding(text,text,text) is 'Único caminho de criação: identidade auth.uid, transaction + lock, owner fixo. Sem IDs/papéis fornecidos pelo cliente.';
comment on column public.businesses.sales_channel is 'Categoria única de personalização do onboarding; não é um local comercial.';
commit;
