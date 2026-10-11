-- Frota — manutenções, custos fixos e pneus (telas 3, 5 e Custos Fixos do gestor)
-- As três são só do gestor: o motorista não lê nem grava.

-- ---------------------------------------------------------------------------
-- Manutenções e preventivas
-- ---------------------------------------------------------------------------
create table public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.tenant_id() references public.tenants (id) on delete cascade,
  veiculo_id uuid not null,
  viagem_id uuid,
  tipo text not null check (tipo in ('preventiva', 'corretiva', 'borracharia')),
  descricao text,
  valor numeric(12,2) not null default 0 check (valor >= 0),
  data date not null default current_date,
  km numeric(10,1) check (km >= 0),
  -- "Próxima manutenção em (+km)": intervalo até a próxima; alimenta os alertas por quilometragem
  proxima_em_km numeric(10,1) check (proxima_em_km > 0),
  km_proxima numeric(10,1) generated always as (km + proxima_em_km) stored,
  oficina text,
  nota_fiscal_path text,
  pago boolean not null default false,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, veiculo_id) references public.veiculos (tenant_id, id),
  foreign key (tenant_id, viagem_id) references public.viagens (tenant_id, id)
);

create index manutencoes_veiculo_idx on public.manutencoes (veiculo_id, km desc);
create index manutencoes_tenant_data_idx on public.manutencoes (tenant_id, data);

-- ---------------------------------------------------------------------------
-- Custos fixos: despesas mensais recorrentes (seguro, parcela, rastreador, contador…)
-- Valem do mês de "inicio" até o mês de "fim" (sem fim = continuam valendo).
-- ---------------------------------------------------------------------------
create table public.custos_fixos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.tenant_id() references public.tenants (id) on delete cascade,
  descricao text not null check (length(trim(descricao)) > 0),
  categoria text,
  valor_mensal numeric(12,2) not null check (valor_mensal > 0),
  veiculo_id uuid, -- opcional: custo ligado a um veículo específico
  inicio date not null default date_trunc('month', current_date)::date,
  fim date,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, veiculo_id) references public.veiculos (tenant_id, id),
  check (fim is null or fim >= inicio)
);

create index custos_fixos_tenant_idx on public.custos_fixos (tenant_id, inicio);

-- ---------------------------------------------------------------------------
-- Pneus: posição no veículo e estado. Versão simples — a spec (6.2) deixa o mapa
-- visual de eixos pendente de validação em campo.
-- ---------------------------------------------------------------------------
create table public.pneus (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.tenant_id() references public.tenants (id) on delete cascade,
  veiculo_id uuid not null,
  eixo smallint not null check (eixo between 1 and 9),
  lado text not null check (lado in ('esquerdo', 'direito')),
  -- rodado simples = 'unico'; rodado duplo = 'externo' e 'interno'
  posicao text not null default 'unico' check (posicao in ('unico', 'externo', 'interno')),
  estado text not null default 'bom' check (estado in ('bom', 'atencao', 'troca')),
  marca text,
  km_instalacao numeric(10,1) check (km_instalacao >= 0),
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, veiculo_id) references public.veiculos (tenant_id, id) on delete cascade,
  unique (veiculo_id, eixo, lado, posicao)
);

create trigger tocar_atualizado_em before update on public.manutencoes
  for each row execute function app.tocar_atualizado_em();
create trigger tocar_atualizado_em before update on public.custos_fixos
  for each row execute function app.tocar_atualizado_em();
create trigger tocar_atualizado_em before update on public.pneus
  for each row execute function app.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- Permissões: só o gestor do tenant
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['manutencoes', 'custos_fixos', 'pneus']
  loop
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format($f$
      create policy gestor_tudo on public.%I for all to authenticated
        using (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()))
        with check (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()))
    $f$, t);
  end loop;
end;
$$;
