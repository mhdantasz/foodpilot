begin;
-- Financial writes remain closed to client roles. Only verified transactional RPCs append receipts.
alter table public.sales drop constraint sales_payment_method_check;
alter table public.sales drop constraint sales_payment_status_check;
alter table public.sales add constraint sales_payment_method_check check(payment_method in ('pix','cash','card','credit','other'));
alter table public.sales add constraint sales_payment_status_check check(payment_status in ('paid','pending','partially_paid'));
alter table public.sales add constraint credit_customer_required check(payment_method<>'credit' or customer_id is not null);
alter table public.sales add constraint sales_customer_identity unique(business_id,id,customer_id);

create table public.payments (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 customer_id uuid, sale_id uuid not null, request_id uuid not null, request_payload jsonb not null,
 amount_cents bigint not null check(amount_cents between 1 and 1000000000000),
 payment_method text not null check(payment_method in ('pix','cash','card','other')),
 paid_at timestamptz not null default now(), notes text check(length(notes)<=2000), created_at timestamptz not null default now(),
 unique(business_id,id), unique(business_id,request_id,sale_id),
 foreign key(business_id,sale_id) references public.sales(business_id,id),
 foreign key(business_id,customer_id) references public.customers(business_id,id),
 foreign key(business_id,sale_id,customer_id) references public.sales(business_id,id,customer_id)
);
create index payments_sale_idx on public.payments(business_id,sale_id);
create index payments_customer_idx on public.payments(business_id,customer_id,paid_at desc);
create index payments_date_idx on public.payments(business_id,paid_at desc);
-- Phase 3 only allowed fully paid sales. Reconstruct their receipt at the sale instant.
insert into public.payments(business_id,customer_id,sale_id,request_id,request_payload,amount_cents,payment_method,paid_at,notes)
 select business_id,customer_id,id,request_id,jsonb_build_object('source','phase3'),total_cents,payment_method,sold_at,'Pagamento integral registrado na Fase 3'
 from public.sales where total_cents>0;

create table public.reservations (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), customer_id uuid not null, location_id uuid,
 request_id uuid not null, request_payload jsonb not null, scheduled_for timestamptz not null,
 status text not null default 'reserved' check(status in ('reserved','prepared','delivered','converted','cancelled')),
 total_cents bigint not null check(total_cents between 0 and 1000000000000), cost_total_cents bigint not null check(cost_total_cents between 0 and 1000000000000),
 converted_sale_id uuid, conversion_method text check(conversion_method in ('pix','cash','card','credit','other')),
 notes text check(length(notes)<=2000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,request_id),unique(business_id,converted_sale_id),
 check((status='converted')=(converted_sale_id is not null)),
 foreign key(business_id,customer_id) references public.customers(business_id,id),
 foreign key(business_id,location_id) references public.locations(business_id,id),
 foreign key(business_id,converted_sale_id,customer_id) references public.sales(business_id,id,customer_id)
);
create index reservations_date_idx on public.reservations(business_id,scheduled_for,id);
create index reservations_customer_idx on public.reservations(business_id,customer_id);
create index reservations_location_idx on public.reservations(business_id,location_id);
create table public.reservation_items (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), reservation_id uuid not null, product_variant_id uuid not null,
 product_name_snapshot text not null, variant_name_snapshot text not null, quantity integer not null check(quantity between 1 and 9999),
 unit_price_cents bigint not null check(unit_price_cents between 0 and 1000000000), unit_cost_cents bigint not null check(unit_cost_cents between 0 and 1000000000),
 line_total_cents bigint not null check(line_total_cents=quantity::bigint*unit_price_cents), line_cost_cents bigint not null check(line_cost_cents=quantity::bigint*unit_cost_cents),
 created_at timestamptz not null default now(), unique(business_id,id),
 foreign key(business_id,reservation_id) references public.reservations(business_id,id),
 foreign key(business_id,product_variant_id) references public.product_variants(business_id,id)
);
create index reservation_items_reservation_idx on public.reservation_items(business_id,reservation_id);
create index reservation_items_variant_idx on public.reservation_items(business_id,product_variant_id);
create table public.expenses (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),request_id uuid not null,
 request_payload jsonb not null, description text not null check(length(btrim(description)) between 1 and 200),
 category text not null check(category in ('ingredients','packaging','transport','fees','other')),
 amount_cents bigint not null check(amount_cents between 1 and 1000000000000),incurred_at timestamptz not null,
 notes text check(length(notes)<=2000),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,request_id)
);
create index expenses_date_idx on public.expenses(business_id,incurred_at desc,id);
do $$ declare t text; begin
 foreach t in array array['payments','reservations','reservation_items','expenses'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy tenant_read on public.%I for select to authenticated using (business_id in (select business_id from public.business_members where user_id=(select auth.uid())))',t);
 end loop;
end $$;
create trigger set_updated before update on public.reservations for each row execute function public.set_updated_at();
create trigger set_updated before update on public.expenses for each row execute function public.set_updated_at();

create view public.sale_balances with (security_invoker=true) as
 select s.*,coalesce(p.paid_cents,0)::bigint as paid_cents,(s.total_cents-coalesce(p.paid_cents,0))::bigint as balance_cents
 from public.sales s left join (select business_id,sale_id,sum(amount_cents) as paid_cents from public.payments group by business_id,sale_id) p
 on p.business_id=s.business_id and p.sale_id=s.id;
revoke all on public.sale_balances from public,anon,authenticated;
grant select on public.sale_balances to authenticated;

-- Customer-wide serialization also covers pay-all versus a concurrently created credit sale.
create function commerce_private.record_payment(p_request_id uuid,p_customer_id uuid,p_sale_id uuid,p_amount_cents bigint,p_method text,p_notes text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid; payload jsonb; previous jsonb; r record; receipt uuid; balance bigint; remaining bigint:=p_amount_cents; allocated bigint;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 select business_id into b from public.business_members where user_id=auth.uid() order by created_at,id limit 1;
 if b is null then raise exception 'Configure seu negócio.' using errcode='42501'; end if;
 if p_request_id is null or p_customer_id is null or p_amount_cents is null or p_amount_cents not between 1 and 1000000000000
 or p_method is null or p_method not in ('pix','cash','card','other') or coalesce(length(p_notes),0)>2000 then
 raise exception 'Informe um pagamento válido, maior que zero.' using errcode='22023'; end if;
 payload:=jsonb_build_object('customer',p_customer_id,'sale',p_sale_id,'amount',p_amount_cents,'method',p_method,'notes',p_notes);
 perform pg_advisory_xact_lock(hashtextextended(b::text||p_request_id::text,4));
 select request_payload into previous from public.payments where business_id=b and request_id=p_request_id limit 1;
 if found then
  if previous is distinct from payload then raise exception 'Esta tentativa já registrou outro pagamento.' using errcode='22023'; end if;
  return jsonb_build_object('amount',p_amount_cents,'repeated',true);
 end if;
 perform 1 from public.customers where business_id=b and id=p_customer_id for update;
 if not found then raise exception 'Cliente não disponível.' using errcode='22023'; end if;
 -- Lock every affected sale in a deterministic order before checking the aggregate outstanding amount.
 perform id from public.sales where business_id=b and customer_id=p_customer_id and (p_sale_id is null or id=p_sale_id) order by sold_at,id for update;
 if p_sale_id is not null and not found then raise exception 'Venda não disponível para este cliente.' using errcode='22023'; end if;
 select coalesce(sum(balance_cents),0) into balance from public.sale_balances where business_id=b and customer_id=p_customer_id and (p_sale_id is null or id=p_sale_id);
 if p_amount_cents>balance then raise exception 'O pagamento ultrapassa o saldo pendente. Atualize a página e confira o saldo.' using errcode='22023'; end if;
 for r in select id,balance_cents,total_cents,paid_cents from public.sale_balances where business_id=b and customer_id=p_customer_id and balance_cents>0 and (p_sale_id is null or id=p_sale_id) order by sold_at,id loop
  allocated:=least(remaining,r.balance_cents);
  insert into public.payments(business_id,customer_id,sale_id,request_id,request_payload,amount_cents,payment_method,notes)
  values(b,p_customer_id,r.id,p_request_id,payload,allocated,p_method,p_notes) returning id into receipt;
  update public.sales set payment_status=case when r.paid_cents+allocated=r.total_cents then 'paid' else 'partially_paid' end,updated_at=now() where business_id=b and id=r.id;
  remaining:=remaining-allocated; exit when remaining=0;
 end loop;
 if remaining<>0 then raise exception 'Saldo alterado. Atualize e tente novamente.' using errcode='22023'; end if;
 return jsonb_build_object('amount',p_amount_cents,'repeated',false);
end $$;
revoke all on function commerce_private.record_payment(uuid,uuid,uuid,bigint,text,text) from public,anon;
grant execute on function commerce_private.record_payment(uuid,uuid,uuid,bigint,text,text) to authenticated;
create function public.record_payment(p_request_id uuid,p_customer_id uuid,p_sale_id uuid,p_amount_cents bigint,p_method text,p_notes text default null)
returns jsonb language sql security invoker set search_path='' as $$ select commerce_private.record_payment(p_request_id,p_customer_id,p_sale_id,p_amount_cents,p_method,p_notes) $$;
revoke all on function public.record_payment(uuid,uuid,uuid,bigint,text,text) from public,anon;
grant execute on function public.record_payment(uuid,uuid,uuid,bigint,text,text) to authenticated;

create function commerce_private.save_expense(p_request_id uuid,p_id uuid,p_description text,p_category text,p_amount_cents bigint,p_day date,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; tz text; eid uuid; payload jsonb; previous jsonb;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 select business_id into b from public.business_members where user_id=auth.uid() order by created_at,id limit 1;
 select timezone into tz from public.businesses where id=b;
 if tz is null then raise exception 'Configure seu negócio.' using errcode='42501'; end if;
 if p_request_id is null or p_day is null or p_description is null or length(btrim(p_description)) not between 1 and 200 or p_category is null or p_category not in ('ingredients','packaging','transport','fees','other') or p_amount_cents is null or p_amount_cents not between 1 and 1000000000000 or coalesce(length(p_notes),0)>2000 then
 raise exception 'Revise a descrição, a data e o valor da despesa.' using errcode='22023'; end if;
 payload:=jsonb_build_object('description',btrim(p_description),'category',p_category,'amount',p_amount_cents,'day',p_day,'notes',p_notes);
 perform pg_advisory_xact_lock(hashtextextended(b::text||p_request_id::text,5));
 if p_id is null then
  select id,request_payload into eid,previous from public.expenses where business_id=b and request_id=p_request_id;
  if found then
   if previous is distinct from payload then raise exception 'Esta tentativa já registrou outra despesa.' using errcode='22023'; end if; return eid;
  end if;
  insert into public.expenses(business_id,request_id,request_payload,description,category,amount_cents,incurred_at,notes)
  values(b,p_request_id,payload,btrim(p_description),p_category,p_amount_cents,p_day::timestamp at time zone tz,p_notes) returning id into eid;
 else
  update public.expenses set description=btrim(p_description),category=p_category,amount_cents=p_amount_cents,incurred_at=p_day::timestamp at time zone tz,notes=p_notes
  where business_id=b and id=p_id returning id into eid;
  if not found then raise exception 'Despesa não disponível.' using errcode='22023'; end if;
 end if; return eid;
end $$;
revoke all on function commerce_private.save_expense(uuid,uuid,text,text,bigint,date,text) from public,anon;
grant execute on function commerce_private.save_expense(uuid,uuid,text,text,bigint,date,text) to authenticated;
create function public.save_expense(p_request_id uuid,p_id uuid,p_description text,p_category text,p_amount_cents bigint,p_day date,p_notes text default null)
returns uuid language sql security invoker set search_path='' as $$ select commerce_private.save_expense(p_request_id,p_id,p_description,p_category,p_amount_cents,p_day,p_notes) $$;
revoke all on function public.save_expense(uuid,uuid,text,text,bigint,date,text) from public,anon;
grant execute on function public.save_expense(uuid,uuid,text,text,bigint,date,text) to authenticated;
create or replace function commerce_private.create_sale(p_request_id uuid,p_items jsonb,p_customer_id uuid,p_location_id uuid,p_payment_method text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; sid uuid; old_payload jsonb; payload jsonb; item jsonb; r record; q integer; revenue bigint:=0; cost bigint:=0;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 select business_id into b from public.business_members where user_id=auth.uid() order by created_at,id limit 1;
 if b is null then raise exception 'Configure seu negócio.' using errcode='42501'; end if;
 if p_request_id is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Carrinho inválido.' using errcode='22023'; end if;
 if jsonb_array_length(p_items) not between 1 and 100 or p_payment_method is null or p_payment_method not in ('pix','cash','card','credit','other') or coalesce(length(p_notes),0)>2000 then
  raise exception 'Revise os itens e o pagamento.' using errcode='22023'; end if;
 payload:=jsonb_build_object('items',p_items,'customer',p_customer_id,'location',p_location_id,'payment',p_payment_method,'notes',p_notes);
 perform pg_advisory_xact_lock(hashtextextended(b::text||p_request_id::text,1));
 select id,request_payload into sid,old_payload from public.sales where business_id=b and request_id=p_request_id;
 if sid is not null then
  if old_payload is distinct from payload then raise exception 'Esta tentativa já registrou outra venda. Abra uma nova venda.' using errcode='22023'; end if;
  return sid;
 end if;
 if p_payment_method='credit' and p_customer_id is null then raise exception 'Escolha um cliente para registrar fiado.' using errcode='22023'; end if;
 if p_customer_id is not null then
  perform 1 from public.customers where business_id=b and id=p_customer_id and active for update;
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
 update public.sales set payment_status=case when p_payment_method='credit' and revenue>0 then 'pending' else 'paid' end where id=sid;
 if p_payment_method<>'credit' and revenue>0 then
  insert into public.payments(business_id,customer_id,sale_id,request_id,request_payload,amount_cents,payment_method,notes)
  values(b,p_customer_id,sid,p_request_id,jsonb_build_object('source','sale'),revenue,p_payment_method,p_notes);
 end if;
 return sid;
end $$;

create function commerce_private.create_reservation(p_request_id uuid,p_items jsonb,p_customer_id uuid,p_location_id uuid,p_scheduled_local timestamp,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; tz text; rid uuid; previous jsonb; payload jsonb; item jsonb; r record; q integer; revenue bigint:=0; cost bigint:=0;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 select business_id into b from public.business_members where user_id=auth.uid() order by created_at,id limit 1;
 select timezone into tz from public.businesses where id=b;
 if tz is null then raise exception 'Configure seu negócio.' using errcode='42501'; end if;
 if p_request_id is null or p_customer_id is null or p_scheduled_local is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Informe cliente, data e itens da reserva.' using errcode='22023'; end if;
 if jsonb_array_length(p_items) not between 1 and 100 or coalesce(length(p_notes),0)>2000 then raise exception 'Revise os itens e observações.' using errcode='22023'; end if;
 payload:=jsonb_build_object('items',p_items,'customer',p_customer_id,'location',p_location_id,'scheduled',p_scheduled_local,'notes',p_notes);
 perform pg_advisory_xact_lock(hashtextextended(b::text||p_request_id::text,6));
 select id,request_payload into rid,previous from public.reservations where business_id=b and request_id=p_request_id;
 if found then
  if previous is distinct from payload then raise exception 'Esta tentativa já registrou outra reserva.' using errcode='22023'; end if; return rid;
 end if;
 perform 1 from public.customers where business_id=b and id=p_customer_id and active for share;
 if not found then raise exception 'Cliente não disponível.' using errcode='22023'; end if;
 if p_location_id is not null then
  perform 1 from public.locations where business_id=b and id=p_location_id and active for share;
  if not found then raise exception 'Local não disponível.' using errcode='22023'; end if;
 end if;
 perform v.id from public.product_variants v join public.products p on p.id=v.product_id and p.business_id=v.business_id
 where v.business_id=b and v.id in (select (x->>'variant_id')::uuid from jsonb_array_elements(p_items) x) order by v.id for share of v,p;
 insert into public.reservations(business_id,customer_id,location_id,request_id,request_payload,scheduled_for,total_cents,cost_total_cents,notes)
 values(b,p_customer_id,p_location_id,p_request_id,payload,p_scheduled_local at time zone tz,0,0,p_notes) returning id into rid;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item->'quantity') is distinct from 'number' or (item->>'quantity') !~ '^[0-9]{1,4}$' then raise exception 'Quantidade inválida.' using errcode='22023'; end if;
  q:=(item->>'quantity')::integer;
  if q not between 1 and 9999 then raise exception 'Quantidade inválida.' using errcode='22023'; end if;
  select v.*,p.name as product_name into r from public.product_variants v join public.products p on p.id=v.product_id and p.business_id=v.business_id
  where v.business_id=b and v.id=(item->>'variant_id')::uuid and v.active and p.active;
  if not found then raise exception 'Um produto está indisponível.' using errcode='22023'; end if;
  revenue:=revenue+q::bigint*r.sale_price_cents; cost:=cost+q::bigint*r.cost_price_cents;
  if revenue>1000000000000 or cost>1000000000000 then raise exception 'Reserva acima do limite permitido.' using errcode='22023'; end if;
  insert into public.reservation_items(business_id,reservation_id,product_variant_id,product_name_snapshot,variant_name_snapshot,quantity,unit_price_cents,unit_cost_cents,line_total_cents,line_cost_cents)
  values(b,rid,r.id,r.product_name,r.name,q,r.sale_price_cents,r.cost_price_cents,q::bigint*r.sale_price_cents,q::bigint*r.cost_price_cents);
 end loop;
 update public.reservations set total_cents=revenue,cost_total_cents=cost where id=rid;
 return rid;
end $$;
revoke all on function commerce_private.create_reservation(uuid,jsonb,uuid,uuid,timestamp,text) from public,anon;
grant execute on function commerce_private.create_reservation(uuid,jsonb,uuid,uuid,timestamp,text) to authenticated;
create function public.create_reservation(p_request_id uuid,p_items jsonb,p_customer_id uuid,p_location_id uuid,p_scheduled_local timestamp,p_notes text default null)
returns uuid language sql security invoker set search_path='' as $$ select commerce_private.create_reservation(p_request_id,p_items,p_customer_id,p_location_id,p_scheduled_local,p_notes) $$;
revoke all on function public.create_reservation(uuid,jsonb,uuid,uuid,timestamp,text) from public,anon;
grant execute on function public.create_reservation(uuid,jsonb,uuid,uuid,timestamp,text) to authenticated;

create function commerce_private.change_reservation(p_id uuid,p_status text,p_method text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; r public.reservations; sid uuid;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 select business_id into b from public.business_members where user_id=auth.uid() order by created_at,id limit 1;
 if b is null then raise exception 'Configure seu negócio.' using errcode='42501'; end if;
 select * into r from public.reservations where business_id=b and id=p_id for update;
 if not found then raise exception 'Reserva não disponível.' using errcode='22023'; end if;
 if p_status is null or p_status not in ('prepared','delivered','cancelled','converted') then raise exception 'Estado de reserva inválido.' using errcode='22023'; end if;
 if r.status='converted' then
  if p_status='converted' and p_method=r.conversion_method then return r.converted_sale_id; end if;
  raise exception 'Esta reserva já foi convertida. Abra a venda registrada.' using errcode='22023';
 end if;
 if r.status='cancelled' then raise exception 'Esta reserva foi cancelada.' using errcode='22023'; end if;
 if p_status<>'converted' then
  if p_status=r.status then return r.id; end if;
  if (p_status='prepared' and r.status<>'reserved') or (p_status='delivered' and r.status not in ('reserved','prepared')) then raise exception 'A reserva não pode voltar a uma etapa anterior.' using errcode='22023'; end if;
  update public.reservations set status=p_status where id=r.id and business_id=b; return r.id;
 end if;
 if p_method is null or p_method not in ('pix','cash','card','credit','other') then raise exception 'Escolha o pagamento da venda.' using errcode='22023'; end if;
 -- A reservation already owns validated historical snapshots. Archived products/customers retain that commitment.
 perform 1 from public.customers where business_id=b and id=r.customer_id for update;
 insert into public.sales(business_id,customer_id,location_id,request_id,request_payload,subtotal_cents,total_cents,cost_total_cents,profit_cents,payment_method,payment_status,notes)
 values(b,r.customer_id,r.location_id,r.id,jsonb_build_object('reservation',r.id,'method',p_method),r.total_cents,r.total_cents,r.cost_total_cents,r.total_cents-r.cost_total_cents,p_method,
 case when p_method='credit' and r.total_cents>0 then 'pending' else 'paid' end,r.notes) returning id into sid;
 insert into public.sale_items(business_id,sale_id,product_variant_id,product_name_snapshot,variant_name_snapshot,quantity,unit_price_cents,unit_cost_cents,line_total_cents,line_cost_cents)
 select business_id,sid,product_variant_id,product_name_snapshot,variant_name_snapshot,quantity,unit_price_cents,unit_cost_cents,line_total_cents,line_cost_cents
 from public.reservation_items where business_id=b and reservation_id=r.id;
 if not found then raise exception 'Reserva sem itens. Conversão não realizada.' using errcode='22023'; end if;
 if p_method<>'credit' and r.total_cents>0 then
  insert into public.payments(business_id,customer_id,sale_id,request_id,request_payload,amount_cents,payment_method)
  values(b,r.customer_id,sid,r.id,jsonb_build_object('source','reservation'),r.total_cents,p_method);
 end if;
 update public.reservations set status='converted',converted_sale_id=sid,conversion_method=p_method where business_id=b and id=r.id;
 return sid;
end $$;
revoke all on function commerce_private.change_reservation(uuid,text,text) from public,anon;
grant execute on function commerce_private.change_reservation(uuid,text,text) to authenticated;
create function public.change_reservation(p_id uuid,p_status text,p_method text default null)
returns uuid language sql security invoker set search_path='' as $$ select commerce_private.change_reservation(p_id,p_status,p_method) $$;
revoke all on function public.change_reservation(uuid,text,text) from public,anon;
grant execute on function public.change_reservation(uuid,text,text) to authenticated;

create function public.customer_finances(p_anchor timestamptz default now())
returns table(customer_id uuid,name text,phone text,purchased_cents numeric,paid_cents numeric,balance_cents numeric,purchase_count bigint,ticket_cents numeric,last_purchase timestamptz,open_sales bigint,oldest_pending timestamptz,pending_days integer,weekly_frequency numeric,weekly_spend_cents numeric)
language sql stable security invoker set search_path='' as $$
 with context as (select id,timezone,(p_anchor at time zone timezone)::date as today from public.businesses where id=public.current_business_id()),
 totals as (select s.customer_id,sum(s.total_cents) bought,sum(s.paid_cents) paid,sum(s.balance_cents) balance,count(*) purchases,round(avg(s.total_cents)) ticket,max(s.sold_at) latest,
 count(*) filter(where s.balance_cents>0) open_count,min(s.sold_at) filter(where s.balance_cents>0) oldest,min((s.sold_at at time zone c.timezone)::date) first_day
 from public.sale_balances s cross join context c where s.business_id=c.id and s.customer_id is not null and s.sold_at<=p_anchor group by s.customer_id),
 recent as (select s.customer_id,count(*) purchases,sum(s.total_cents) bought from public.sales s cross join context c
 where s.business_id=c.id and s.sold_at>=(c.today-29)::timestamp at time zone c.timezone and s.sold_at<=p_anchor group by s.customer_id)
 select u.id,u.name,u.phone,coalesce(t.bought,0),coalesce(t.paid,0),coalesce(t.balance,0),coalesce(t.purchases,0),coalesce(t.ticket,0),t.latest,coalesce(t.open_count,0),t.oldest,
 case when t.oldest is not null then c.today-(t.oldest at time zone c.timezone)::date else 0 end,
 case when c.today-t.first_day+1>=14 and coalesce(r.purchases,0)>=2 then round(r.purchases*7.0/least(30,c.today-t.first_day+1),1) end,
 case when c.today-t.first_day+1>=14 and coalesce(r.purchases,0)>=2 then round(r.bought*7.0/least(30,c.today-t.first_day+1)) end
 from public.customers u cross join context c left join totals t on t.customer_id=u.id left join recent r on r.customer_id=u.id where u.business_id=c.id
$$;
revoke all on function public.customer_finances(timestamptz) from public,anon;
grant execute on function public.customer_finances(timestamptz) to authenticated;

create function public.operational_metrics(p_period text default 'today',p_anchor timestamptz default now()) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare b uuid:=public.current_business_id(); tz text; d date; bounds record; result jsonb; expenses numeric; received numeric; pending numeric; debtors bigint; reserved bigint; monthly numeric; observed integer; month_days integer; sale_days integer; first_day date;
begin
 select timezone into tz from public.businesses where id=b;
 if tz is null then raise exception 'Negócio não disponível.' using errcode='42501'; end if;
 d:=(p_anchor at time zone tz)::date;
 select * into bounds from public.sales_period(p_period,p_anchor);
 result:=public.sales_metrics(p_period,null,p_anchor);
 select coalesce(sum(amount_cents),0) into expenses from public.expenses where business_id=b and incurred_at>=bounds.starts_at and incurred_at<bounds.ends_at;
 select coalesce(sum(amount_cents),0) into received from public.payments where business_id=b and paid_at>=bounds.starts_at and paid_at<bounds.ends_at;
 select coalesce(sum(balance_cents),0),count(distinct customer_id) filter(where balance_cents>0) into pending,debtors from public.sale_balances where business_id=b;
 select count(*) into reserved from public.reservations where business_id=b and status not in ('cancelled','converted') and scheduled_for>=d::timestamp at time zone tz and scheduled_for<(d+1)::timestamp at time zone tz;
 select coalesce(sum(total_cents),0),min((sold_at at time zone tz)::date),count(distinct (sold_at at time zone tz)::date) into monthly,first_day,sale_days
 from public.sales where business_id=b and sold_at>=date_trunc('month',d::timestamp) at time zone tz and sold_at<=p_anchor;
 observed:=d-date_trunc('month',d::timestamp)::date+1;
 month_days:=extract(day from date_trunc('month',d::timestamp)+interval '1 month'-interval '1 day')::integer;
 return result||jsonb_build_object('expenses',expenses,'received',received,'result',(result->>'profit')::numeric-expenses,'receivable',pending,'debtors',debtors,'reservations_today',reserved,
 'days',(bounds.ends_at at time zone tz)::date-(bounds.starts_at at time zone tz)::date,
 'forecast',case when d-first_day+1>=7 and sale_days>=3 then round(monthly/observed*month_days/100)*100 end,'forecast_observed_days',observed,'forecast_month_days',month_days);
end $$;
revoke all on function public.operational_metrics(text,timestamptz) from public,anon;
grant execute on function public.operational_metrics(text,timestamptz) to authenticated;

create function public.operational_analytics(p_period text default '30days',p_anchor timestamptz default now()) returns jsonb
language sql stable security invoker set search_path='' as $$
 with context as (select public.current_business_id() as b), bounds as (select * from public.sales_period(p_period,p_anchor)),
 period_sales as materialized (select s.* from public.sales s cross join context c cross join bounds d where s.business_id=c.b and s.sold_at>=d.starts_at and s.sold_at<d.ends_at),
 variant_totals as (select i.product_variant_id as id,max(i.product_name_snapshot) as product,max(i.variant_name_snapshot) as name,sum(i.quantity) as units,sum(i.line_total_cents) as revenue
 from public.sale_items i join period_sales s on s.id=i.sale_id and s.business_id=i.business_id group by i.product_variant_id),
 product_totals as (select v.product_id as id,max(i.product_name_snapshot) as name,sum(i.quantity) as units,sum(i.line_total_cents) as revenue
 from public.sale_items i join period_sales s on s.id=i.sale_id and s.business_id=i.business_id join public.product_variants v on v.id=i.product_variant_id and v.business_id=i.business_id group by v.product_id),
 customer_totals as (select s.customer_id as id,max(c.name) as name,count(*) as purchases,sum(s.total_cents) as revenue,max(f.weekly_frequency) as weekly_frequency,max(f.weekly_spend_cents) as weekly_spend_cents
 from period_sales s join public.customers c on c.id=s.customer_id and c.business_id=s.business_id left join public.customer_finances(p_anchor) f on f.customer_id=s.customer_id group by s.customer_id),
 location_totals as (select s.location_id as id,coalesce(max(l.name),'Sem local') as name,count(*) as count,sum(s.total_cents) as revenue from period_sales s left join public.locations l on l.id=s.location_id and l.business_id=s.business_id group by s.location_id)
 select jsonb_build_object('financial',public.operational_metrics(p_period,p_anchor),
 'variants',coalesce((select jsonb_agg(to_jsonb(v)) from (select * from variant_totals order by units desc,id limit 50) v),'[]'::jsonb),
 'products_by_units',coalesce((select jsonb_agg(to_jsonb(v)) from (select * from product_totals order by units desc,id limit 20) v),'[]'::jsonb),
 'products_by_revenue',coalesce((select jsonb_agg(to_jsonb(v)) from (select * from product_totals order by revenue desc,id limit 20) v),'[]'::jsonb),
 'customers_by_count',coalesce((select jsonb_agg(to_jsonb(v)) from (select * from customer_totals order by purchases desc,id limit 20) v),'[]'::jsonb),
 'customers_by_spend',coalesce((select jsonb_agg(to_jsonb(v)) from (select * from customer_totals order by revenue desc,id limit 20) v),'[]'::jsonb),
 'locations',coalesce((select jsonb_agg(to_jsonb(v)) from (select * from location_totals order by revenue desc,id nulls last limit 50) v),'[]'::jsonb))
$$;
revoke all on function public.operational_analytics(text,timestamptz) from public,anon;
grant execute on function public.operational_analytics(text,timestamptz) to authenticated;
commit;
