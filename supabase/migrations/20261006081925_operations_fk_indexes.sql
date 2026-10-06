begin;
create index payments_sale_customer_idx on public.payments(business_id,sale_id,customer_id);
drop index public.payments_sale_idx;
create index reservations_sale_customer_idx on public.reservations(business_id,converted_sale_id,customer_id);
commit;
