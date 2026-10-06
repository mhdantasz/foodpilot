-- A plataforma pode fornecer esse event trigger. Não deve ser chamado pela API.
-- A revogação não impede sua execução automática pelo PostgreSQL ao criar tabelas.
do $$
begin
  if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
