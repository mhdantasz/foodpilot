begin;

create table public.categories (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 name text not null check (length(btrim(name)) between 1 and 100), active boolean not null default true,
 sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_id,id)
);
create unique index categories_name_unique on public.categories(business_id,lower(regexp_replace(btrim(name),'\s+',' ','g')));
create table public.products (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), category_id uuid,
 name text not null check(length(btrim(name)) between 1 and 100), description text check(length(description)<=2000), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_id,id),
 foreign key(business_id,category_id) references public.categories(business_id,id)
);
create index products_category_idx on public.products(business_id,category_id);
create table public.product_variants (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), product_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 100), sale_price_cents bigint not null check(sale_price_cents between 0 and 1000000000),
 cost_price_cents bigint not null check(cost_price_cents between 0 and 1000000000), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_id,id),
 foreign key(business_id,product_id) references public.products(business_id,id)
);
create unique index variants_name_unique on public.product_variants(business_id,product_id,lower(btrim(name)));
create table public.customers (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 name text not null check(length(btrim(name)) between 1 and 100), phone text check(phone ~ '^\+?[0-9]{6,20}$'), notes text check(length(notes)<=2000),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_id,id)
);
create index customers_business_name_idx on public.customers(business_id,name);
create table public.locations (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 name text not null check(length(btrim(name)) between 1 and 100), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_id,id)
);
create unique index locations_name_unique on public.locations(business_id,lower(regexp_replace(btrim(name),'\s+',' ','g')));
create table public.sales (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), customer_id uuid, location_id uuid,
 request_id uuid not null, request_payload jsonb not null,
 subtotal_cents bigint not null check(subtotal_cents between 0 and 1000000000000), total_cents bigint not null check(total_cents=subtotal_cents),
 cost_total_cents bigint not null check(cost_total_cents between 0 and 1000000000000), profit_cents bigint not null check(profit_cents=total_cents-cost_total_cents),
 payment_method text not null check(payment_method in ('pix','cash','card','other')), payment_status text not null default 'paid' check(payment_status='paid'),
 notes text check(length(notes)<=2000), sold_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(business_id,id), unique(business_id,request_id),
 foreign key(business_id,customer_id) references public.customers(business_id,id), foreign key(business_id,location_id) references public.locations(business_id,id)
);
create index sales_business_date_idx on public.sales(business_id,sold_at desc,id);
create index sales_customer_idx on public.sales(business_id,customer_id,sold_at desc);
create index sales_location_idx on public.sales(business_id,location_id);
create table public.sale_items (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), sale_id uuid not null, product_variant_id uuid not null,
 product_name_snapshot text not null, variant_name_snapshot text not null, quantity integer not null check(quantity between 1 and 9999),
 unit_price_cents bigint not null check(unit_price_cents between 0 and 1000000000), unit_cost_cents bigint not null check(unit_cost_cents between 0 and 1000000000),
 line_total_cents bigint not null check(line_total_cents=quantity::bigint*unit_price_cents), line_cost_cents bigint not null check(line_cost_cents=quantity::bigint*unit_cost_cents),
 created_at timestamptz not null default now(), unique(business_id,id),
 foreign key(business_id,sale_id) references public.sales(business_id,id), foreign key(business_id,product_variant_id) references public.product_variants(business_id,id)
);
create index sale_items_sale_idx on public.sale_items(business_id,sale_id);
create index sale_items_variant_idx on public.sale_items(business_id,product_variant_id);

-- Policies read the existing non-recursive self-membership policy. No editable JWT metadata.
do $$ declare t text; begin
 foreach t in array array['categories','products','product_variants','customers','locations','sales','sale_items'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy tenant_read on public.%I for select to authenticated using (business_id in (select business_id from public.business_members where user_id=(select auth.uid())))',t);
  if t not in ('sales','sale_items') then
   execute format('grant insert on public.%I to authenticated',t);
   execute format('create policy tenant_insert on public.%I for insert to authenticated with check (business_id in (select business_id from public.business_members where user_id=(select auth.uid())))',t);
   execute format('create policy tenant_update on public.%I for update to authenticated using (business_id in (select business_id from public.business_members where user_id=(select auth.uid()))) with check (business_id in (select business_id from public.business_members where user_id=(select auth.uid())))',t);
   execute format('create trigger set_updated before update on public.%I for each row execute function public.set_updated_at()',t);
  end if;
 end loop;
end $$;
grant update(name,active,sort_order) on public.categories to authenticated;
grant update(name,description,active,category_id) on public.products to authenticated;
grant update(name,sale_price_cents,cost_price_cents,active) on public.product_variants to authenticated;
grant update(name,phone,notes,active) on public.customers to authenticated;
grant update(name,active) on public.locations to authenticated;

create function public.current_business_id() returns uuid language sql stable security invoker set search_path='' as $$
 select business_id from public.business_members where user_id=auth.uid() order by created_at,id limit 1
$$;
revoke all on function public.current_business_id() from public,anon;
grant execute on function public.current_business_id() to authenticated;

create function public.save_product(p_id uuid,p_name text,p_category_id uuid,p_description text,p_active boolean,p_variants jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare b uuid:=public.current_business_id(); pid uuid; v jsonb; vid uuid;
begin
 if b is null then raise exception 'Negócio não disponível.' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_active is null or jsonb_typeof(p_variants) is distinct from 'array' then
  raise exception 'Revise os dados do produto.' using errcode='22023'; end if;
 if jsonb_array_length(p_variants) not between 1 and 50 then raise exception 'Inclua entre 1 e 50 sabores.' using errcode='22023'; end if;
 if p_id is null then
  insert into public.products(business_id,name,category_id,description,active) values(b,btrim(p_name),p_category_id,p_description,p_active) returning id into pid;
 else
  update public.products set name=btrim(p_name),category_id=p_category_id,description=p_description,active=p_active where id=p_id and business_id=b returning id into pid;
  if pid is null then raise exception 'Produto não encontrado.' using errcode='22023'; end if;
 end if;
 for v in select value from jsonb_array_elements(p_variants) loop
  if v->>'name' is null or length(btrim(v->>'name')) not between 1 and 100 then raise exception 'Informe o nome do sabor.' using errcode='22023'; end if;
  vid:=nullif(v->>'id','')::uuid;
  if vid is null then
   insert into public.product_variants(business_id,product_id,name,sale_price_cents,cost_price_cents,active)
    values(b,pid,btrim(v->>'name'),(v->>'sale_price_cents')::bigint,(v->>'cost_price_cents')::bigint,coalesce((v->>'active')::boolean,true));
  else
   update public.product_variants set name=btrim(v->>'name'),sale_price_cents=(v->>'sale_price_cents')::bigint,cost_price_cents=(v->>'cost_price_cents')::bigint,active=coalesce((v->>'active')::boolean,true)
    where id=vid and business_id=b and product_id=pid;
   if not found then raise exception 'Sabor não encontrado.' using errcode='22023'; end if;
  end if;
 end loop;
 return pid;
end $$;
revoke all on function public.save_product(uuid,text,uuid,text,boolean,jsonb) from public,anon;
grant execute on function public.save_product(uuid,text,uuid,text,boolean,jsonb) to authenticated;

-- Non-exposed schema: the only privileged operation is the atomic append of a sale.
create schema if not exists commerce_private;
revoke all on schema commerce_private from public,anon;
grant usage on schema commerce_private to authenticated;
create function commerce_private.create_sale(p_request_id uuid,p_items jsonb,p_customer_id uuid,p_location_id uuid,p_payment_method text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; sid uuid; old_payload jsonb; payload jsonb; item jsonb; r record; q integer; revenue bigint:=0; cost bigint:=0;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 select business_id into b from public.business_members where user_id=auth.uid() order by created_at,id limit 1;
 if b is null then raise exception 'Configure seu negócio.' using errcode='42501'; end if;
 if p_request_id is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Carrinho inválido.' using errcode='22023'; end if;
 if jsonb_array_length(p_items) not between 1 and 100 or p_payment_method is null or p_payment_method not in ('pix','cash','card','other') or coalesce(length(p_notes),0)>2000 then
  raise exception 'Revise os itens e o pagamento.' using errcode='22023'; end if;
 payload:=jsonb_build_object('items',p_items,'customer',p_customer_id,'location',p_location_id,'payment',p_payment_method,'notes',p_notes);
 perform pg_advisory_xact_lock(hashtextextended(b::text||p_request_id::text,1));
 select id,request_payload into sid,old_payload from public.sales where business_id=b and request_id=p_request_id;
 if sid is not null then
  if old_payload is distinct from payload then raise exception 'Esta tentativa já registrou outra venda. Abra uma nova venda.' using errcode='22023'; end if;
  return sid;
 end if;
 if p_customer_id is not null then
  perform 1 from public.customers where business_id=b and id=p_customer_id and active for share;
  if not found then raise exception 'Cliente não disponível.' using errcode='22023'; end if;
 end if;
 if p_location_id is not null then
  perform 1 from public.locations where business_id=b and id=p_location_id and active for share;
  if not found then raise exception 'Local não disponível.' using errcode='22023'; end if;
 end if;
 -- Stable lock order prevents simultaneous catalog changes from altering a sale midway.
 perform v.id from public.product_variants v join public.products p on p.id=v.product_id and p.business_id=v.business_id
  where v.business_id=b and v.id in (select (x->>'variant_id')::uuid from jsonb_array_elements(p_items) x)
  order by v.id for share of v,p;
 sid:=gen_random_uuid();
 insert into public.sales(id,business_id,customer_id,location_id,request_id,request_payload,subtotal_cents,total_cents,cost_total_cents,profit_cents,payment_method,notes)
 values(sid,b,p_customer_id,p_location_id,p_request_id,payload,0,0,0,0,p_payment_method,p_notes);
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item->'quantity') is distinct from 'number' or (item->>'quantity') !~ '^[0-9]{1,4}$' then raise exception 'Quantidade inválida.' using errcode='22023'; end if;
  q:=(item->>'quantity')::integer;
  if q not between 1 and 9999 then raise exception 'Quantidade inválida.' using errcode='22023'; end if;
  select v.*,p.name as product_name into r from public.product_variants v join public.products p on p.id=v.product_id and p.business_id=v.business_id
   where v.business_id=b and v.id=(item->>'variant_id')::uuid and v.active and p.active;
  if not found then raise exception 'Um produto está indisponível. Revise o carrinho.' using errcode='22023'; end if;
  revenue:=revenue+q::bigint*r.sale_price_cents; cost:=cost+q::bigint*r.cost_price_cents;
  if revenue>1000000000000 or cost>1000000000000 then raise exception 'Venda acima do limite permitido.' using errcode='22023'; end if;
  insert into public.sale_items(business_id,sale_id,product_variant_id,product_name_snapshot,variant_name_snapshot,quantity,unit_price_cents,unit_cost_cents,line_total_cents,line_cost_cents)
   values(b,sid,r.id,r.product_name,r.name,q,r.sale_price_cents,r.cost_price_cents,q::bigint*r.sale_price_cents,q::bigint*r.cost_price_cents);
 end loop;
 update public.sales set subtotal_cents=revenue,total_cents=revenue,cost_total_cents=cost,profit_cents=revenue-cost where id=sid;
 return sid;
end $$;
revoke all on function commerce_private.create_sale(uuid,jsonb,uuid,uuid,text,text) from public,anon;
grant execute on function commerce_private.create_sale(uuid,jsonb,uuid,uuid,text,text) to authenticated;
create function public.create_sale(p_request_id uuid,p_items jsonb,p_customer_id uuid default null,p_location_id uuid default null,p_payment_method text default 'pix',p_notes text default null)
returns uuid language sql security invoker set search_path='' as $$
 select commerce_private.create_sale(p_request_id,p_items,p_customer_id,p_location_id,p_payment_method,p_notes)
$$;
revoke all on function public.create_sale(uuid,jsonb,uuid,uuid,text,text) from public,anon;
grant execute on function public.create_sale(uuid,jsonb,uuid,uuid,text,text) to authenticated;

create function public.sales_period(p_period text,p_anchor timestamptz default now()) returns table(starts_at timestamptz,ends_at timestamptz)
language plpgsql stable security invoker set search_path='' as $$
declare tz text; d date; start_day date; end_day date;
begin
 select timezone into tz from public.businesses where id=public.current_business_id();
 if tz is null then raise exception 'Negócio não disponível.' using errcode='42501'; end if;
 d:=(p_anchor at time zone tz)::date; end_day:=d+1;
 case p_period
 when 'today' then start_day:=d;
 when 'yesterday' then start_day:=d-1; end_day:=d;
 when '7days' then start_day:=d-6;
 when '30days' then start_day:=d-29;
 when 'week' then start_day:=date_trunc('week',d::timestamp)::date;
 when 'month' then start_day:=date_trunc('month',d::timestamp)::date;
 else raise exception 'Período inválido.' using errcode='22023'; end case;
 return query select start_day::timestamp at time zone tz,end_day::timestamp at time zone tz;
end $$;
revoke all on function public.sales_period(text,timestamptz) from public,anon;
grant execute on function public.sales_period(text,timestamptz) to authenticated;
create function public.sales_metrics(p_period text default 'today',p_customer_id uuid default null,p_anchor timestamptz default now()) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('revenue',coalesce(sum(total_cents),0),'cost',coalesce(sum(cost_total_cents),0),'profit',coalesce(sum(profit_cents),0),
 'count',count(*),'ticket',coalesce(round(sum(total_cents)::numeric/nullif(count(*),0)),0),'last_purchase',max(sold_at))
 from public.sales where business_id=public.current_business_id() and (p_customer_id is null or customer_id=p_customer_id)
 and (p_period='all' or (sold_at>=(select starts_at from public.sales_period(p_period,p_anchor)) and sold_at<(select ends_at from public.sales_period(p_period,p_anchor))))
$$;
revoke all on function public.sales_metrics(text,uuid,timestamptz) from public,anon;
grant execute on function public.sales_metrics(text,uuid,timestamptz) to authenticated;
create function public.customer_summaries() returns table(customer_id uuid,total_cents numeric,purchase_count bigint,last_purchase timestamptz)
language sql stable security invoker set search_path='' as $$
 select customer_id,sum(total_cents),count(*),max(sold_at) from public.sales where business_id=public.current_business_id() and customer_id is not null group by customer_id
$$;
revoke all on function public.customer_summaries() from public,anon;
grant execute on function public.customer_summaries() to authenticated;
comment on function public.create_sale(uuid,jsonb,uuid,uuid,text,text) is 'Atomic append-only sale. Business from auth.uid membership; prices from locked catalog; retries compare payload. No direct sales/item writes.';
commit;

