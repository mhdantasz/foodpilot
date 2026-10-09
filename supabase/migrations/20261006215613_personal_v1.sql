-- Cancelamento terminal auditável; nenhum recibo, item ou valor original é apagado.
begin;
alter table public.sales
 add column status text not null default 'active' check(status in ('active','cancelled')),
 add column cancelled_at timestamptz,
 add column cancelled_by uuid references public.profiles(id) on delete restrict,
 add column cancellation_reason text,
 add column refunded_cents bigint not null default 0,
 add constraint cancellation_audit check (
  (status='active' and cancelled_at is null and cancelled_by is null and cancellation_reason is null and refunded_cents=0)
  or (status='cancelled' and cancelled_at is not null and cancelled_by is not null and cancellation_reason is not null and length(btrim(cancellation_reason)) between 5 and 500 and refunded_cents between 0 and total_cents)
 );
create index sales_cancellation_actor_idx on public.sales(cancelled_by);
create index sales_cancellation_date_idx on public.sales(business_id,cancelled_at) where status='cancelled';
-- Mantém ordem das colunas existentes para não quebrar dependências da view.
create or replace view public.sale_balances with(security_invoker=true) as
 select s.id,s.business_id,s.customer_id,s.location_id,s.request_id,s.request_payload,s.subtotal_cents,s.total_cents,s.cost_total_cents,s.profit_cents,s.payment_method,s.payment_status,s.notes,s.sold_at,s.created_at,s.updated_at,
 coalesce(p.paid_cents,0)::bigint as paid_cents,
 case when s.status='cancelled' then 0::bigint else (s.total_cents-coalesce(p.paid_cents,0))::bigint end as balance_cents,
 s.status,s.cancelled_at,s.cancelled_by,s.cancellation_reason,s.refunded_cents
 from public.sales s left join (select business_id,sale_id,sum(amount_cents) as paid_cents from public.payments group by business_id,sale_id) p on p.business_id=s.business_id and p.sale_id=s.id;
revoke all on public.sale_balances from public,anon,authenticated;
grant select on public.sale_balances to authenticated;

create function commerce_private.cancel_sale(p_id uuid,p_reason text,p_refund_confirmed boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; customer uuid; r public.sales; paid bigint; reason text:=btrim(p_reason);
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 select business_id into b from public.business_members where user_id=auth.uid() order by created_at,id limit 1;
 if b is null or not exists(select 1 from public.business_members where business_id=b and user_id=auth.uid() and role='owner') then raise exception 'Somente o proprietário pode cancelar vendas.' using errcode='42501'; end if;
 if reason is null or length(reason) not between 5 and 500 then raise exception 'Informe o motivo do cancelamento, entre 5 e 500 caracteres.' using errcode='22023'; end if;
 select customer_id into customer from public.sales where business_id=b and id=p_id;
 if not found then raise exception 'Venda não disponível.' using errcode='22023'; end if;
 -- Mesma ordem dos pagamentos: cliente antes da venda. Evita recebimento concorrente após cancelamento.
 if customer is not null then perform 1 from public.customers where business_id=b and id=customer for update; end if;
 select * into r from public.sales where business_id=b and id=p_id for update;
 if r.status='cancelled' then
  if r.cancellation_reason=reason then return r.id; end if;
  raise exception 'Esta venda já foi cancelada. Consulte o histórico.' using errcode='22023';
 end if;
 select coalesce(sum(amount_cents),0) into paid from public.payments where business_id=b and sale_id=r.id;
 if paid>0 and not coalesce(p_refund_confirmed,false) then raise exception 'Confirme a devolução do valor já recebido antes de cancelar.' using errcode='22023'; end if;
 update public.sales set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=reason,refunded_cents=paid,updated_at=now() where business_id=b and id=r.id;
 return r.id;
end $$;
revoke all on function commerce_private.cancel_sale(uuid,text,boolean) from public,anon;
grant execute on function commerce_private.cancel_sale(uuid,text,boolean) to authenticated;
create function public.cancel_sale(p_id uuid,p_reason text,p_refund_confirmed boolean default false)
returns uuid language sql security invoker set search_path='' as $$ select commerce_private.cancel_sale(p_id,p_reason,p_refund_confirmed) $$;
revoke all on function public.cancel_sale(uuid,text,boolean) from public,anon;
grant execute on function public.cancel_sale(uuid,text,boolean) to authenticated;
comment on column public.sales.refunded_cents is 'Estorno total confirmado pelo proprietário no cancelamento. Devolução externa, não integração bancária. Recibos originais preservados.';

create or replace function public.sales_metrics(p_period text default 'today',p_customer_id uuid default null,p_anchor timestamptz default now()) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('revenue',coalesce(sum(total_cents),0),'cost',coalesce(sum(cost_total_cents),0),'profit',coalesce(sum(profit_cents),0),
 'count',count(*),'ticket',coalesce(round(sum(total_cents)::numeric/nullif(count(*),0)),0),'last_purchase',max(sold_at))
 from public.sales where status='active' and business_id=public.current_business_id() and (p_customer_id is null or customer_id=p_customer_id)
 and (p_period='all' or (sold_at>=(select starts_at from public.sales_period(p_period,p_anchor)) and sold_at<(select ends_at from public.sales_period(p_period,p_anchor))))
$$;

create or replace function public.customer_summaries() returns table(customer_id uuid,total_cents numeric,purchase_count bigint,last_purchase timestamptz)
language sql stable security invoker set search_path='' as $$
 select customer_id,sum(total_cents),count(*),max(sold_at) from public.sales where status='active' and business_id=public.current_business_id() and customer_id is not null group by customer_id
$$;

create or replace function public.customer_finances(p_anchor timestamptz default now())
returns table(customer_id uuid,name text,phone text,purchased_cents numeric,paid_cents numeric,balance_cents numeric,purchase_count bigint,ticket_cents numeric,last_purchase timestamptz,open_sales bigint,oldest_pending timestamptz,pending_days integer,weekly_frequency numeric,weekly_spend_cents numeric)
language sql stable security invoker set search_path='' as $$
 with context as (select id,timezone,(p_anchor at time zone timezone)::date as today from public.businesses where id=public.current_business_id()),
 totals as (select s.customer_id,sum(s.total_cents) bought,sum(s.paid_cents) paid,sum(s.balance_cents) balance,count(*) purchases,round(avg(s.total_cents)) ticket,max(s.sold_at) latest,
 count(*) filter(where s.balance_cents>0) open_count,min(s.sold_at) filter(where s.balance_cents>0) oldest,min((s.sold_at at time zone c.timezone)::date) first_day
 from public.sale_balances s cross join context c where s.status='active' and s.business_id=c.id and s.customer_id is not null and s.sold_at<=p_anchor group by s.customer_id),
 recent as (select s.customer_id,count(*) purchases,sum(s.total_cents) bought from public.sales s cross join context c
 where s.status='active' and s.business_id=c.id and s.sold_at>=(c.today-29)::timestamp at time zone c.timezone and s.sold_at<=p_anchor group by s.customer_id)
 select u.id,u.name,u.phone,coalesce(t.bought,0),coalesce(t.paid,0),coalesce(t.balance,0),coalesce(t.purchases,0),coalesce(t.ticket,0),t.latest,coalesce(t.open_count,0),t.oldest,
 case when t.oldest is not null then c.today-(t.oldest at time zone c.timezone)::date else 0 end,
 case when c.today-t.first_day+1>=14 and coalesce(r.purchases,0)>=2 then round(r.purchases*7.0/least(30,c.today-t.first_day+1),1) end,
 case when c.today-t.first_day+1>=14 and coalesce(r.purchases,0)>=2 then round(r.bought*7.0/least(30,c.today-t.first_day+1)) end
 from public.customers u cross join context c left join totals t on t.customer_id=u.id left join recent r on r.customer_id=u.id where u.business_id=c.id
$$;

create or replace function public.operational_metrics(p_period text default 'today',p_anchor timestamptz default now()) returns jsonb
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

 -- Caixa líquido: estorno pertence à data real do cancelamento, não reescreve o recebimento original.
 received:=received-(select coalesce(sum(refunded_cents),0) from public.sales where business_id=b and status='cancelled' and cancelled_at>=bounds.starts_at and cancelled_at<bounds.ends_at);
 select coalesce(sum(balance_cents),0),count(distinct customer_id) filter(where balance_cents>0) into pending,debtors from public.sale_balances where business_id=b;
 select count(*) into reserved from public.reservations where business_id=b and status not in ('cancelled','converted') and scheduled_for>=d::timestamp at time zone tz and scheduled_for<(d+1)::timestamp at time zone tz;
 select coalesce(sum(total_cents),0),min((sold_at at time zone tz)::date),count(distinct (sold_at at time zone tz)::date) into monthly,first_day,sale_days
 from public.sales where status='active' and business_id=b and sold_at>=date_trunc('month',d::timestamp) at time zone tz and sold_at<=p_anchor;
 observed:=d-date_trunc('month',d::timestamp)::date+1;
 month_days:=extract(day from date_trunc('month',d::timestamp)+interval '1 month'-interval '1 day')::integer;
 return result||jsonb_build_object('expenses',expenses,'received',received,'result',(result->>'profit')::numeric-expenses,'receivable',pending,'debtors',debtors,'reservations_today',reserved,
 'days',(bounds.ends_at at time zone tz)::date-(bounds.starts_at at time zone tz)::date,
 'forecast',case when d-first_day+1>=7 and sale_days>=3 then round(monthly/observed*month_days/100)*100 end,'forecast_observed_days',observed,'forecast_month_days',month_days);
end $$;

create or replace function public.operational_analytics(p_period text default '30days',p_anchor timestamptz default now()) returns jsonb
language sql stable security invoker set search_path='' as $$
 with context as (select public.current_business_id() as b), bounds as (select * from public.sales_period(p_period,p_anchor)),
 period_sales as materialized (select s.* from public.sales s cross join context c cross join bounds d where s.status='active' and s.business_id=c.b and s.sold_at>=d.starts_at and s.sold_at<d.ends_at),
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
commit;
