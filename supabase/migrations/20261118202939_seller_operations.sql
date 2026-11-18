-- Seller operations: isolated identities, immutable snapshots, bounded authorized RPC.
begin;
create table public.seller_profiles (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 user_id uuid unique references public.profiles(id), name text not null check(length(btrim(name)) between 1 and 100),
 location text not null default '' check(length(location)<=100), active boolean not null default true,
 created_at timestamptz not null default now(), unique(business_id,id)
);
create index seller_profiles_business_idx on public.seller_profiles(business_id);
create table public.seller_invites (
 id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.seller_profiles(id),
 code_hash text not null unique, expires_at timestamptz not null, used_at timestamptz, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create index seller_invites_seller_idx on public.seller_invites(seller_id);
create index seller_invites_created_by_idx on public.seller_invites(created_by);
create table public.seller_offers (
 id uuid primary key default gen_random_uuid(), business_id uuid not null, seller_id uuid not null, variant_id uuid not null,
 price_cents bigint not null check(price_cents between 1 and 1000000000), commission_cents bigint not null check(commission_cents between 0 and price_cents), active boolean not null default true,
 foreign key(business_id,seller_id) references public.seller_profiles(business_id,id), foreign key(business_id,variant_id) references public.product_variants(business_id,id), unique(seller_id,variant_id), unique(seller_id,id)
);
create index seller_offers_variant_idx on public.seller_offers(business_id,variant_id);
create table public.seller_weeks (
 id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.seller_profiles(id), request_id uuid not null, starts_on date not null, ends_on date not null,
 total_cents bigint not null check(total_cents>=0), commission_cents bigint not null check(commission_cents>=0), sale_count integer not null check(sale_count>=0),
 status text not null default 'closed' check(status in ('closed','paid')), closed_by uuid not null references public.profiles(id), closed_at timestamptz not null default now(), paid_at timestamptz, paid_by uuid references public.profiles(id),
 check(ends_on=starts_on+6), check((status='closed' and paid_at is null and paid_by is null) or (status='paid' and paid_at is not null and paid_by is not null)), unique(seller_id,request_id), unique(seller_id,id)
);
create index seller_weeks_period_idx on public.seller_weeks(seller_id,starts_on,ends_on);
create index seller_weeks_closed_by_idx on public.seller_weeks(closed_by);
create index seller_weeks_paid_by_idx on public.seller_weeks(paid_by);
create table public.seller_sales (
 id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.seller_profiles(id), request_id uuid not null, request_payload jsonb not null,
 sold_at timestamptz not null default now(), payment_method text not null check(payment_method in ('pix','card','cash','other')),
 total_cents bigint not null check(total_cents between 1 and 1000000000000), cost_cents bigint not null check(cost_cents between 0 and 1000000000000), commission_cents bigint not null check(commission_cents between 0 and total_cents),
 status text not null default 'active' check(status in ('active','cancelled')), cancelled_at timestamptz, cancelled_by uuid references public.profiles(id), cancellation_reason text,
 closed_week_id uuid, foreign key(seller_id,closed_week_id) references public.seller_weeks(seller_id,id), unique(seller_id,request_id),
 check((status='active' and cancelled_at is null and cancelled_by is null and cancellation_reason is null) or (status='cancelled' and cancelled_at is not null and cancelled_by is not null and length(btrim(cancellation_reason)) between 5 and 500))
);
create index seller_sales_date_idx on public.seller_sales(seller_id,sold_at);
create index seller_sales_week_idx on public.seller_sales(seller_id,closed_week_id);
create index seller_sales_cancelled_by_idx on public.seller_sales(cancelled_by);
create table public.seller_sale_items (
 id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.seller_sales(id), offer_id uuid not null references public.seller_offers(id),
 product_name text not null, variant_name text not null, quantity integer not null check(quantity between 1 and 9999),
 unit_price_cents bigint not null check(unit_price_cents>0), unit_cost_cents bigint not null check(unit_cost_cents>=0), unit_commission_cents bigint not null check(unit_commission_cents between 0 and unit_price_cents),
 total_cents bigint not null check(total_cents=quantity*unit_price_cents), cost_cents bigint not null check(cost_cents=quantity*unit_cost_cents), commission_cents bigint not null check(commission_cents=quantity*unit_commission_cents)
);
create index seller_items_sale_idx on public.seller_sale_items(sale_id);
create index seller_items_offer_idx on public.seller_sale_items(offer_id);
-- No direct Data API grants. RLS denies all rows: only bounded authorized RPC exposes safe fields.
alter table public.seller_profiles enable row level security;
alter table public.seller_invites enable row level security;
alter table public.seller_offers enable row level security;
alter table public.seller_weeks enable row level security;
alter table public.seller_sales enable row level security;
alter table public.seller_sale_items enable row level security;
revoke all on public.seller_profiles,public.seller_invites,public.seller_offers,public.seller_weeks,public.seller_sales,public.seller_sale_items from public,anon,authenticated;

create function commerce_private.seller_operation(p_action text,p_input jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); bid uuid; sid uuid; target uuid; rid uuid; code text; nm text; loc text; method text;
 sp public.seller_profiles%rowtype; inv public.seller_invites%rowtype; ofr record; oldsale public.seller_sales%rowtype; wk public.seller_weeks%rowtype;
 fromday date; today date; today_local date; starts date; ends date; tz text; pr jsonb; response jsonb; items jsonb; item jsonb;
 amount bigint:=0; costs bigint:=0; commission bigint:=0; qty integer; price bigint; fee bigint; saleid uuid; rows_count integer;
 owner_mode boolean:=false; metrics jsonb; products jsonb; seller_products jsonb; allsales jsonb; alloffers jsonb; allweeks jsonb; sellers jsonb;
begin
 if uid is null then raise exception using errcode='42501',message='Entre na sua conta para continuar.'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' then raise exception using errcode='22023',message='Dados inválidos.'; end if;
 select * into sp from public.seller_profiles where user_id=uid;
 if p_action='access' then
  if sp.id is null then return 'null'::jsonb; end if;
  return jsonb_build_object('seller_id',sp.id,'name',sp.name,'active',sp.active);
 end if;
 if p_action='accept' then
  code:=btrim(p_input->>'code');
  if code is null or code !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='Convite inválido ou expirado.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select * into inv from public.seller_invites where code_hash=encode(sha256(convert_to(code,'UTF8')),'hex');
  if inv.id is null or inv.used_at is not null or inv.expires_at<=now() then raise exception using errcode='22023',message='Convite inválido ou expirado.'; end if;
  select * into sp from public.seller_profiles where id=inv.seller_id for update;
  select * into inv from public.seller_invites where id=inv.id for update;
  if inv.used_at is not null or inv.expires_at<=now() then raise exception using errcode='22023',message='Convite inválido ou expirado.'; end if;
  if sp.user_id is not null or not sp.active or exists(select 1 from public.seller_profiles where user_id=uid) or exists(select 1 from public.business_members where user_id=uid) then raise exception using errcode='22023',message='Esta conta ou este vendedor já possui vínculo. Use uma conta individual sem outro negócio.'; end if;
  update public.seller_profiles set user_id=uid where id=sp.id;
  update public.seller_invites set used_at=now() where id=inv.id;
  return jsonb_build_object('id',sp.id);
 end if;
 if p_action in ('portal','sale') then
  if sp.id is null then
   if p_action='sale' then raise exception using errcode='42501',message='Aceite seu convite antes de vender.'; end if;
   tz:='America/Manaus';
  else bid:=sp.business_id; sid:=sp.id; end if;
 else
  select business_id into bid from public.business_members where user_id=uid and role='owner' order by created_at,id limit 1;
  if bid is null then raise exception using errcode='42501',message='Somente o gerente pode realizar esta operação.'; end if;
  owner_mode:=true;
 end if;
 if bid is not null then select timezone into tz from public.businesses where id=bid; end if;
 tz:=coalesce(tz,'America/Manaus'); today_local:=(now() at time zone tz)::date;
 if p_action='create' then
  nm:=btrim(p_input->>'name'); loc:=btrim(coalesce(p_input->>'location',''));
  if nm is null or length(nm) not between 1 and 100 or length(loc)>100 then raise exception using errcode='22023',message='Informe nome e local com até 100 caracteres.'; end if;
  insert into public.seller_profiles(business_id,name,location) values(bid,nm,loc) returning id into target;
  return jsonb_build_object('id',target);
 end if;
 if p_action in ('invite','offer','toggle','close') then
  sid:=(p_input->>'seller_id')::uuid;
  select * into sp from public.seller_profiles where id=sid and business_id=bid for update;
  if sp.id is null then raise exception using errcode='42501',message='Vendedor indisponível.'; end if;
 end if;
 if p_action='invite' then
  if sp.user_id is not null or not sp.active then raise exception using errcode='22023',message='Vendedor já vinculado ou desativado.'; end if;
  update public.seller_invites set expires_at=now() where seller_id=sid and used_at is null;
  code:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.seller_invites(seller_id,code_hash,expires_at,created_by) values(sid,encode(sha256(convert_to(code,'UTF8')),'hex'),now()+interval '7 days',uid);
  return jsonb_build_object('code',code,'id',sid);
 elsif p_action='toggle' then
  update public.seller_profiles set active=(p_input->>'active')::boolean where id=sid;
  return jsonb_build_object('id',sid);
 elsif p_action='offer' then
  target:=(p_input->>'variant_id')::uuid; price:=(p_input->>'price_cents')::bigint; fee:=(p_input->>'commission_cents')::bigint;
  if price is null or fee is null or price not between 1 and 1000000000 or fee not between 0 and price then raise exception using errcode='22023',message='Informe preço positivo e comissão entre zero e o preço.'; end if;
  if not exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id where v.id=target and v.business_id=bid and v.active and p.active) then raise exception using errcode='22023',message='Produto indisponível.'; end if;
  insert into public.seller_offers(business_id,seller_id,variant_id,price_cents,commission_cents,active) values(bid,sid,target,price,fee,coalesce((p_input->>'active')::boolean,true))
   on conflict(seller_id,variant_id) do update set price_cents=excluded.price_cents,commission_cents=excluded.commission_cents,active=excluded.active returning id into target;
  return jsonb_build_object('id',target);
 elsif p_action='sale' then
  select * into sp from public.seller_profiles where id=sid for update;
  if not sp.active then raise exception using errcode='42501',message='Seu acesso de vendedor está desativado.'; end if;
  rid:=(p_input->>'request_id')::uuid; method:=p_input->>'payment_method'; items:=p_input->'items';
  if rid is null or method is null or method not in ('pix','card','cash','other') or items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 50 then raise exception using errcode='22023',message='Revise os produtos e a forma de pagamento.'; end if;
  pr:=jsonb_build_object('items',items,'payment_method',method);
  select * into oldsale from public.seller_sales where seller_id=sid and request_id=rid;
  if oldsale.id is not null then
   if oldsale.request_payload<>pr then raise exception using errcode='22023',message='Esta tentativa já foi usada para outra venda.'; end if;
   return jsonb_build_object('id',oldsale.id);
  end if;
  if exists(select 1 from public.seller_weeks where seller_id=sid and today_local between starts_on and ends_on) then raise exception using errcode='22023',message='O período de hoje já está fechado.'; end if;
  saleid:=gen_random_uuid();
  -- Validate every line before header and copy from locked catalog/offers, never from browser prices.
  for item in select value from jsonb_array_elements(items) loop
   if jsonb_typeof(item)<>'object' or coalesce(item->>'quantity','') !~ '^[0-9]{1,4}$' then raise exception using errcode='22023',message='Quantidade inválida.'; end if;
   qty:=(item->>'quantity')::integer;
   if qty not between 1 and 9999 then raise exception using errcode='22023',message='Quantidade inválida.'; end if;
   select o.*,v.cost_price_cents,p.name product_name,v.name variant_name into ofr from public.seller_offers o join public.product_variants v on v.id=o.variant_id join public.products p on p.id=v.product_id where o.id=(item->>'offer_id')::uuid and o.seller_id=sid and o.active and v.active and p.active for share of o,v,p;
   if ofr.id is null then raise exception using errcode='22023',message='Oferta indisponível para este vendedor.'; end if;
   amount:=amount+qty*ofr.price_cents; costs:=costs+qty*ofr.cost_price_cents; commission:=commission+qty*ofr.commission_cents;
  end loop;
  if amount>1000000000000 or costs>1000000000000 then raise exception using errcode='22023',message='Venda acima do limite.'; end if;
  insert into public.seller_sales(id,seller_id,request_id,request_payload,payment_method,total_cents,cost_cents,commission_cents) values(saleid,sid,rid,pr,method,amount,costs,commission);
  for item in select value from jsonb_array_elements(items) loop
   qty:=(item->>'quantity')::integer;
   select o.*,v.cost_price_cents,p.name product_name,v.name variant_name into ofr from public.seller_offers o join public.product_variants v on v.id=o.variant_id join public.products p on p.id=v.product_id where o.id=(item->>'offer_id')::uuid and o.seller_id=sid;
   insert into public.seller_sale_items(sale_id,offer_id,product_name,variant_name,quantity,unit_price_cents,unit_cost_cents,unit_commission_cents,total_cents,cost_cents,commission_cents) values(saleid,ofr.id,ofr.product_name,ofr.variant_name,qty,ofr.price_cents,ofr.cost_price_cents,ofr.commission_cents,qty*ofr.price_cents,qty*ofr.cost_price_cents,qty*ofr.commission_cents);
  end loop;
  return jsonb_build_object('id',saleid);
 elsif p_action='cancel' then
  target:=(p_input->>'sale_id')::uuid;
  select s.seller_id into sid from public.seller_sales s join public.seller_profiles p on p.id=s.seller_id where s.id=target and p.business_id=bid;
  if sid is null then raise exception using errcode='42501',message='Venda indisponível.'; end if;
  perform 1 from public.seller_profiles where id=sid for update;
  select * into oldsale from public.seller_sales where id=target for update;
  nm:=btrim(p_input->>'reason');
  if nm is null or length(nm) not between 5 and 500 then raise exception using errcode='22023',message='Informe um motivo entre 5 e 500 caracteres.'; end if;
  if oldsale.status='cancelled' then
   if oldsale.cancellation_reason<>nm then raise exception using errcode='22023',message='Venda já cancelada com outro motivo.'; end if;
   return jsonb_build_object('id',target);
  end if;
  if oldsale.closed_week_id is not null then raise exception using errcode='22023',message='Venda incluída em fechamento. O histórico fechado não pode ser alterado.'; end if;
  update public.seller_sales set status='cancelled',cancelled_at=now(),cancelled_by=uid,cancellation_reason=nm where id=target;
  return jsonb_build_object('id',target);
 elsif p_action='close' then
  starts:=(p_input->>'starts_on')::date; ends:=(p_input->>'ends_on')::date; rid:=(p_input->>'request_id')::uuid;
  if starts is null or ends is null or rid is null or ends<>starts+6 or ends>=today_local then raise exception using errcode='22023',message='Escolha 7 dias completos, terminando até ontem.'; end if;
  select * into wk from public.seller_weeks where seller_id=sid and request_id=rid;
  if wk.id is not null then
   if wk.starts_on<>starts or wk.ends_on<>ends then raise exception using errcode='22023',message='Esta tentativa já foi usada para outro fechamento.'; end if;
   return jsonb_build_object('id',wk.id);
  end if;
  if exists(select 1 from public.seller_weeks where seller_id=sid and starts_on<=ends and ends_on>=starts) then raise exception using errcode='22023',message='Este período sobrepõe uma semana já fechada.'; end if;
  select coalesce(sum(total_cents),0),coalesce(sum(commission_cents),0),count(*) into amount,commission,rows_count from public.seller_sales where seller_id=sid and status='active' and sold_at>=starts::timestamp at time zone tz and sold_at<(ends+1)::timestamp at time zone tz;
  insert into public.seller_weeks(seller_id,request_id,starts_on,ends_on,total_cents,commission_cents,sale_count,closed_by) values(sid,rid,starts,ends,amount,commission,rows_count,uid) returning id into target;
  update public.seller_sales set closed_week_id=target where seller_id=sid and status='active' and sold_at>=starts::timestamp at time zone tz and sold_at<(ends+1)::timestamp at time zone tz;
  return jsonb_build_object('id',target);
 elsif p_action='pay' then
  target:=(p_input->>'week_id')::uuid;
  select w.* into wk from public.seller_weeks w join public.seller_profiles p on p.id=w.seller_id where w.id=target and p.business_id=bid for update of w;
  if wk.id is null then raise exception using errcode='42501',message='Fechamento indisponível.'; end if;
  if wk.status='closed' then update public.seller_weeks set status='paid',paid_at=now(),paid_by=uid where id=target; end if;
  return jsonb_build_object('id',target);
 end if;
 if p_action not in ('team','portal') then raise exception using errcode='22023',message='Operação inválida.'; end if;
 begin
  fromday:=coalesce(nullif(p_input->>'from','')::date,today_local-6); today:=coalesce(nullif(p_input->>'to','')::date,today_local);
 exception when invalid_datetime_format or datetime_field_overflow then raise exception using errcode='22023',message='Período inválido.';
 end;
 if today<fromday or today-fromday>365 or today>today_local then raise exception using errcode='22023',message='Escolha até 366 dias, sem datas futuras.'; end if;
 response:=jsonb_build_object('period',jsonb_build_object('from',fromday,'to',today,'calendar_days',today-fromday+1,'timezone',tz),'history_limit',100);
 if not owner_mode and sp.id is null then return response||jsonb_build_object('seller',null,'offers','[]'::jsonb,'sales','[]'::jsonb,'weeks','[]'::jsonb,'metrics',null,'products','[]'::jsonb); end if;
 -- Every relation below is scoped to owner business OR the linked seller; no browser tenant authority.
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'seller_id',o.seller_id,'variant_id',o.variant_id,'product_name',p.name,'variant_name',v.name,'price_cents',o.price_cents,'commission_cents',o.commission_cents,'active',o.active and v.active and p.active) order by p.name,v.name),'[]'::jsonb) into alloffers from public.seller_offers o join public.seller_profiles s on s.id=o.seller_id join public.product_variants v on v.id=o.variant_id join public.products p on p.id=v.product_id where s.business_id=bid and (owner_mode or s.id=sid);
 select coalesce(jsonb_agg(x.row order by x.sold_at desc,x.id),'[]'::jsonb) into allsales from (
  select s.sold_at,s.id,jsonb_build_object('id',s.id,'seller_id',s.seller_id,'seller_name',p.name,'sold_at',s.sold_at,'payment_method',s.payment_method,'total_cents',s.total_cents,'commission_cents',s.commission_cents,'status',s.status,'cancellation_reason',s.cancellation_reason,'closed_week_id',s.closed_week_id,'items',coalesce((select jsonb_agg(jsonb_build_object('product_name',i.product_name,'variant_name',i.variant_name,'quantity',i.quantity,'unit_price_cents',i.unit_price_cents,'unit_commission_cents',i.unit_commission_cents,'total_cents',i.total_cents,'commission_cents',i.commission_cents) order by i.id) from public.seller_sale_items i where i.sale_id=s.id),'[]'::jsonb)) row
  from public.seller_sales s join public.seller_profiles p on p.id=s.seller_id where p.business_id=bid and (owner_mode or p.id=sid) and s.sold_at>=fromday::timestamp at time zone tz and s.sold_at<(today+1)::timestamp at time zone tz order by s.sold_at desc,s.id limit 100
 ) x;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'seller_id',w.seller_id,'seller_name',p.name,'starts_on',w.starts_on,'ends_on',w.ends_on,'total_cents',w.total_cents,'commission_cents',w.commission_cents,'sale_count',w.sale_count,'status',w.status,'closed_at',w.closed_at,'paid_at',w.paid_at) order by w.starts_on desc),'[]'::jsonb) into allweeks from (select sw.* from public.seller_weeks sw join public.seller_profiles ss on ss.id=sw.seller_id where ss.business_id=bid and (owner_mode or ss.id=sid) order by sw.starts_on desc limit 100) w join public.seller_profiles p on p.id=w.seller_id;
 select coalesce(jsonb_agg(q.row order by q.revenue desc),'[]'::jsonb) into metrics from (
  select coalesce(sum(s.total_cents),0) revenue,jsonb_build_object('seller_id',p.id,'seller_name',p.name,'revenue_cents',coalesce(sum(s.total_cents),0),'commission_cents',coalesce(sum(s.commission_cents),0),'units',coalesce(sum((select sum(i.quantity) from public.seller_sale_items i where i.sale_id=s.id)),0),'sale_count',count(s.id),'active_days',count(distinct (s.sold_at at time zone tz)::date),'calendar_days',today-fromday+1,'units_per_calendar_day',round(coalesce(sum((select sum(i.quantity) from public.seller_sale_items i where i.sale_id=s.id)),0)::numeric/(today-fromday+1),2),'units_per_active_day',coalesce(round(sum((select sum(i.quantity) from public.seller_sale_items i where i.sale_id=s.id))::numeric/nullif(count(distinct (s.sold_at at time zone tz)::date),0),2),0)) || case when owner_mode then jsonb_build_object('cost_cents',coalesce(sum(s.cost_cents),0),'result_cents',coalesce(sum(s.total_cents-s.cost_cents-s.commission_cents),0)) else '{}'::jsonb end row
  from public.seller_profiles p left join public.seller_sales s on s.seller_id=p.id and s.status='active' and s.sold_at>=fromday::timestamp at time zone tz and s.sold_at<(today+1)::timestamp at time zone tz where p.business_id=bid and (owner_mode or p.id=sid) group by p.id,p.name
 ) q;
 select coalesce(jsonb_agg(q.row order by q.units desc,q.variant_id),'[]'::jsonb) into products from (
  select o.variant_id,sum(i.quantity) units,jsonb_build_object('product_id',v.product_id,'variant_id',o.variant_id,'product_name',catalog_product.name,'variant_name',v.name,'units',sum(i.quantity),'revenue_cents',sum(i.total_cents),'commission_cents',sum(i.commission_cents),'active_days',count(distinct (s.sold_at at time zone tz)::date),'calendar_days',today-fromday+1,'units_per_calendar_day',round(sum(i.quantity)::numeric/(today-fromday+1),2),'units_per_active_day',round(sum(i.quantity)::numeric/count(distinct (s.sold_at at time zone tz)::date),2)) row
  from public.seller_sale_items i join public.seller_sales s on s.id=i.sale_id join public.seller_profiles p on p.id=s.seller_id join public.seller_offers o on o.id=i.offer_id join public.product_variants v on v.id=o.variant_id join public.products catalog_product on catalog_product.id=v.product_id where p.business_id=bid and (owner_mode or p.id=sid) and s.status='active' and s.sold_at>=fromday::timestamp at time zone tz and s.sold_at<(today+1)::timestamp at time zone tz group by v.product_id,o.variant_id,catalog_product.name,v.name
 ) q;
 response:=response||jsonb_build_object('offers',alloffers,'sales',allsales,'weeks',allweeks,'products',products);
 if not owner_mode then return response||jsonb_build_object('seller',jsonb_build_object('seller_id',sp.id,'name',sp.name,'active',sp.active),'metrics',metrics->0); end if;
 -- Per-vendor/product averages aggregate the entire period, independent of history limit.
 select coalesce(jsonb_agg(q.row order by q.seller_id,q.units desc,q.variant_id),'[]'::jsonb) into seller_products from (
  select p.id seller_id,o.variant_id,sum(i.quantity) units,jsonb_build_object('seller_id',p.id,'seller_name',p.name,'product_id',v.product_id,'variant_id',o.variant_id,'product_name',catalog_product.name,'variant_name',v.name,'units',sum(i.quantity),'revenue_cents',sum(i.total_cents),'commission_cents',sum(i.commission_cents),'active_days',count(distinct (s.sold_at at time zone tz)::date),'calendar_days',today-fromday+1,'units_per_calendar_day',round(sum(i.quantity)::numeric/(today-fromday+1),2),'units_per_active_day',round(sum(i.quantity)::numeric/count(distinct (s.sold_at at time zone tz)::date),2)) row
  from public.seller_sale_items i join public.seller_sales s on s.id=i.sale_id join public.seller_profiles p on p.id=s.seller_id join public.seller_offers o on o.id=i.offer_id join public.product_variants v on v.id=o.variant_id join public.products catalog_product on catalog_product.id=v.product_id where p.business_id=bid and s.status='active' and s.sold_at>=fromday::timestamp at time zone tz and s.sold_at<(today+1)::timestamp at time zone tz group by p.id,p.name,v.product_id,o.variant_id,catalog_product.name,v.name
 ) q;
 response:=response||jsonb_build_object('seller_products',seller_products);
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'location',p.location,'active',p.active,'linked',p.user_id is not null,'created_at',p.created_at) order by p.created_at),'[]'::jsonb) into sellers from public.seller_profiles p where p.business_id=bid;
 response:=response||jsonb_build_object('sellers',sellers,'metrics',metrics,'totals',jsonb_build_object('revenue_cents',coalesce((select sum((x->>'revenue_cents')::bigint) from jsonb_array_elements(metrics) x),0),'cost_cents',coalesce((select sum((x->>'cost_cents')::bigint) from jsonb_array_elements(metrics) x),0),'commission_cents',coalesce((select sum((x->>'commission_cents')::bigint) from jsonb_array_elements(metrics) x),0),'result_cents',coalesce((select sum((x->>'result_cents')::bigint) from jsonb_array_elements(metrics) x),0),'units',coalesce((select sum((x->>'units')::bigint) from jsonb_array_elements(metrics) x),0),'sale_count',coalesce((select sum((x->>'sale_count')::bigint) from jsonb_array_elements(metrics) x),0)));
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'product_name',p.name,'variant_name',v.name,'sale_price_cents',v.sale_price_cents) order by p.name,v.name),'[]'::jsonb) into products from public.product_variants v join public.products p on p.id=v.product_id where v.business_id=bid and v.active and p.active;
 return response||jsonb_build_object('variants',products);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_datetime_format then
 raise exception using errcode='22023',message='Revise os identificadores, datas e valores informados.';
end;
$$;
revoke all on function commerce_private.seller_operation(text,jsonb) from public,anon,authenticated;
grant execute on function commerce_private.seller_operation(text,jsonb) to authenticated;
create function public.seller_operation(p_action text,p_input jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select commerce_private.seller_operation(p_action,p_input); $$;
revoke all on function public.seller_operation(text,jsonb) from public,anon,authenticated;
grant execute on function public.seller_operation(text,jsonb) to authenticated;
-- Same user lock as invitation acceptance prevents concurrent mixed roles.
create or replace function public.complete_onboarding(p_name text, p_business_type text, p_sales_channel text)
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
  if exists (select 1 from public.seller_profiles where user_id=v_user) then
    raise exception 'Contas de vendedor não podem criar outro negócio.' using errcode='42501';
  end if;
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


commit;
