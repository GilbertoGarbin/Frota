-- Frota — permissões e Row-Level Security
-- Regra geral: ninguém enxerga nada fora do próprio tenant.
--   Gestor:    tudo do tenant.
--   Motorista: o próprio cadastro, os veículos, e os lançamentos das viagens dele.
--              Não lê a tabela viagens direto (ela tem combustível e margem) — usa as
--              funções viagens_do_motorista / iniciar_viagem / finalizar_viagem.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

grant usage on schema app to authenticated, service_role;
revoke all on all functions in schema app from public;
grant execute on function
  app.tenant_id(),
  app.papel(),
  app.eh_gestor(),
  app.motorista_id(),
  app.viagem_do_motorista(uuid),
  app.viagem_aberta_do_motorista(uuid)
to authenticated, service_role;
grant execute on function app.recalcular_combustivel(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;

create policy tenant_ler on public.tenants for select to authenticated
  using (id = (select app.tenant_id()));
create policy tenant_gestor_alterar on public.tenants for update to authenticated
  using (id = (select app.tenant_id()) and (select app.eh_gestor()))
  with check (id = (select app.tenant_id()));

-- ---------------------------------------------------------------------------
-- usuarios (escrita só por funções security definer / service_role)
-- ---------------------------------------------------------------------------
alter table public.usuarios enable row level security;

create policy usuario_ler on public.usuarios for select to authenticated
  using (
    id = (select auth.uid())
    or (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()))
  );

-- ---------------------------------------------------------------------------
-- veiculos
-- ---------------------------------------------------------------------------
alter table public.veiculos enable row level security;

create policy veiculo_ler on public.veiculos for select to authenticated
  using (tenant_id = (select app.tenant_id()));
create policy veiculo_gestor_inserir on public.veiculos for insert to authenticated
  with check (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()));
create policy veiculo_gestor_alterar on public.veiculos for update to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()))
  with check (tenant_id = (select app.tenant_id()));
create policy veiculo_gestor_excluir on public.veiculos for delete to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()));

-- ---------------------------------------------------------------------------
-- motoristas
-- ---------------------------------------------------------------------------
alter table public.motoristas enable row level security;

create policy motorista_ler on public.motoristas for select to authenticated
  using (
    tenant_id = (select app.tenant_id())
    and ((select app.eh_gestor()) or id = (select app.motorista_id()))
  );
create policy motorista_gestor_inserir on public.motoristas for insert to authenticated
  with check (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()));
create policy motorista_gestor_alterar on public.motoristas for update to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()))
  with check (tenant_id = (select app.tenant_id()));
create policy motorista_gestor_excluir on public.motoristas for delete to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()));

-- ---------------------------------------------------------------------------
-- viagens (só gestor acessa a tabela)
-- ---------------------------------------------------------------------------
alter table public.viagens enable row level security;

create policy viagem_gestor on public.viagens for all to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()))
  with check (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()));

-- ---------------------------------------------------------------------------
-- janelas_consumo (leitura do gestor; quem grava é app.recalcular_combustivel)
-- ---------------------------------------------------------------------------
alter table public.janelas_consumo enable row level security;

create policy janela_gestor_ler on public.janelas_consumo for select to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()));

-- ---------------------------------------------------------------------------
-- Lançamentos: mesmas regras nas cinco tabelas
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['abastecimentos', 'despesas', 'complementos', 'paradas', 'documentos']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      create policy gestor_tudo on public.%I for all to authenticated
        using (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()))
        with check (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()))
    $f$, t);

    -- Motorista lê os lançamentos das viagens dele (inclusive finalizadas)…
    execute format($f$
      create policy motorista_ler on public.%I for select to authenticated
        using (tenant_id = (select app.tenant_id()) and app.viagem_do_motorista(viagem_id))
    $f$, t);

    -- …mas só lança, corrige ou remove enquanto a viagem está em andamento.
    execute format($f$
      create policy motorista_inserir on public.%I for insert to authenticated
        with check (tenant_id = (select app.tenant_id()) and app.viagem_aberta_do_motorista(viagem_id))
    $f$, t);
    execute format($f$
      create policy motorista_alterar on public.%I for update to authenticated
        using (tenant_id = (select app.tenant_id()) and app.viagem_aberta_do_motorista(viagem_id))
        with check (tenant_id = (select app.tenant_id()) and app.viagem_aberta_do_motorista(viagem_id))
    $f$, t);
    execute format($f$
      create policy motorista_excluir on public.%I for delete to authenticated
        using (tenant_id = (select app.tenant_id()) and app.viagem_aberta_do_motorista(viagem_id))
    $f$, t);
  end loop;
end;
$$;

-- Motorista só lança carga complementar; diária, pedágio e reentrega são do gestor.
create policy motorista_so_carga_inserir on public.complementos as restrictive
  for insert to authenticated
  with check (
    (select app.eh_gestor())
    or (origem_lancamento = 'motorista' and tipo = 'carga_complementar')
  );
create policy motorista_so_carga_alterar on public.complementos as restrictive
  for update to authenticated
  using ((select app.eh_gestor()) or origem_lancamento = 'motorista')
  with check (
    (select app.eh_gestor())
    or (origem_lancamento = 'motorista' and tipo = 'carga_complementar')
  );
create policy motorista_so_carga_excluir on public.complementos as restrictive
  for delete to authenticated
  using ((select app.eh_gestor()) or origem_lancamento = 'motorista');
