-- Frota — tenant_id padrão nas tabelas de viagem e lançamentos
-- O app não precisa enviar tenant_id: nasce com o do usuário logado (a política RLS confere,
-- e a FK composta garante que o lançamento é do mesmo tenant da viagem).
alter table public.viagens alter column tenant_id set default app.tenant_id();
alter table public.abastecimentos alter column tenant_id set default app.tenant_id();
alter table public.despesas alter column tenant_id set default app.tenant_id();
alter table public.complementos alter column tenant_id set default app.tenant_id();
alter table public.paradas alter column tenant_id set default app.tenant_id();
alter table public.documentos alter column tenant_id set default app.tenant_id();
