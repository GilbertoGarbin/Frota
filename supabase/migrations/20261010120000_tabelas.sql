-- Frota — tabelas base
-- Convenções: toda tabela tem tenant_id; dinheiro em numeric(12,2); km em numeric(10,1);
-- litros e preço por litro com 3 casas (bomba brasileira: R$ 5,899).
-- FKs compostas (tenant_id, x_id) impedem ligar registros de tenants diferentes.

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Tenants (transportadoras)
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Veículos
-- ---------------------------------------------------------------------------
create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  placa text not null check (length(trim(placa)) > 0),
  modelo text not null,
  km_atual numeric(10,1) not null default 0 check (km_atual >= 0),
  status text not null default 'ativo' check (status in ('ativo', 'em_manutencao', 'inativo')),
  -- Valor que o gestor informa; vale até o primeiro fechamento de tanque cheio
  -- ou quando ajustado depois do último fechamento.
  consumo_medio_informado numeric(6,2) check (consumo_medio_informado > 0),
  consumo_informado_em timestamptz,
  -- Derivados (mantidos por app.recalcular_combustivel)
  consumo_medio_km_por_litro numeric(6,2) check (consumo_medio_km_por_litro > 0),
  preco_medio_referencia_combustivel numeric(8,3) check (preco_medio_referencia_combustivel > 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, placa)
);

-- ---------------------------------------------------------------------------
-- Motoristas
-- ---------------------------------------------------------------------------
create table public.motoristas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  cpf text not null check (cpf ~ '^[0-9]{11}$'),
  telefone text,
  cnh_numero text,
  cnh_validade date,
  veiculo_vinculado_id uuid,
  modelo_remuneracao text not null default 'comissionado'
    check (modelo_remuneracao in ('comissionado', 'assalariado')),
  comissao_percentual numeric(5,2) not null default 0
    check (comissao_percentual >= 0 and comissao_percentual <= 100),
  salario_fixo numeric(12,2) check (salario_fixo >= 0),
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, cpf),
  foreign key (tenant_id, veiculo_vinculado_id) references public.veiculos (tenant_id, id)
);

-- ---------------------------------------------------------------------------
-- Usuários: liga cada login (auth.users) a um tenant e a um papel.
-- Motorista também tem login (sessão do aparelho ativado); desativar a linha revoga o aparelho.
-- ---------------------------------------------------------------------------
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  papel text not null check (papel in ('gestor', 'motorista')),
  motorista_id uuid,
  nome text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, motorista_id) references public.motoristas (tenant_id, id) on delete cascade,
  check ((papel = 'motorista') = (motorista_id is not null))
);

create index usuarios_tenant_idx on public.usuarios (tenant_id);
-- Um aparelho ativo por motorista
create unique index usuarios_motorista_ativo_uq on public.usuarios (motorista_id)
  where motorista_id is not null and ativo;

-- ---------------------------------------------------------------------------
-- Viagens
-- ---------------------------------------------------------------------------
create table public.viagens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  motorista_id uuid not null,
  veiculo_id uuid not null,
  cliente text,
  carga text,
  origem text not null check (length(trim(origem)) > 0),
  destino text not null check (length(trim(destino)) > 0),
  data_prevista date not null default current_date,
  status text not null default 'programada'
    check (status in ('programada', 'em_andamento', 'finalizada')),
  forma_pagamento_frete text,
  km_inicial numeric(10,1) check (km_inicial >= 0),
  km_final numeric(10,1),
  valor_frete numeric(12,2) not null default 0 check (valor_frete >= 0),
  -- Derivados (mantidos por app.viagens_derivados — nunca editar pelo cliente)
  valor_frete_total numeric(12,2) not null default 0,
  comissao_percentual numeric(5,2) not null default 0,
  comissao_valor numeric(12,2) not null default 0,
  total_despesas numeric(12,2) not null default 0,
  -- Adiantamento
  valor_adiantamento numeric(12,2) not null default 0 check (valor_adiantamento >= 0),
  adiantamento_gasto numeric(12,2) not null default 0,
  -- Positivo: a devolver à empresa. Negativo: a reembolsar ao motorista.
  adiantamento_saldo numeric(12,2) generated always as (valor_adiantamento - adiantamento_gasto) stored,
  adiantamento_acertado boolean not null default false,
  adiantamento_acertado_em timestamptz,
  -- Combustível (mantido por app.recalcular_combustivel)
  combustivel_status text check (combustivel_status in ('estimado', 'apurado')),
  combustivel_valor numeric(12,2),
  resultado_operacional numeric(12,2) generated always as
    (valor_frete_total - coalesce(combustivel_valor, 0) - total_despesas - comissao_valor) stored,
  iniciada_em timestamptz,
  data_hora_chegada timestamptz,
  local_chegada text,
  observacoes text,
  observacoes_finais text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, motorista_id) references public.motoristas (tenant_id, id),
  foreign key (tenant_id, veiculo_id) references public.veiculos (tenant_id, id),
  check (status = 'programada' or km_inicial is not null),
  check (status <> 'finalizada' or (km_final is not null and km_final >= km_inicial))
);

create index viagens_tenant_status_idx on public.viagens (tenant_id, status);
create index viagens_motorista_idx on public.viagens (motorista_id, status);
create index viagens_veiculo_km_idx on public.viagens (veiculo_id, km_inicial);
-- Um motorista só tem uma viagem em andamento por vez
create unique index viagens_motorista_em_andamento_uq on public.viagens (motorista_id)
  where status = 'em_andamento';

-- ---------------------------------------------------------------------------
-- Lançamentos da viagem. O id é gerado no aparelho (UUID) — reenviar não duplica.
-- ---------------------------------------------------------------------------
create table public.abastecimentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  veiculo_id uuid not null,
  viagem_id uuid, -- nulo: abastecimento fora de viagem, lançado pelo gestor
  data date not null default current_date,
  km numeric(10,1) not null check (km >= 0),
  posto text,
  combustivel text not null default 'diesel_s10'
    check (combustivel in ('diesel_s10', 'diesel_s500', 'arla32')),
  litros numeric(10,3) not null check (litros > 0),
  preco_litro numeric(8,3) not null check (preco_litro > 0),
  total numeric(12,2) generated always as (round(litros * preco_litro, 2)) stored,
  tanque_cheio boolean not null default false,
  forma_pagamento text not null
    check (forma_pagamento in ('adiantamento', 'cartao_empresa', 'proprio_bolso')),
  comprovante_path text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, veiculo_id) references public.veiculos (tenant_id, id),
  foreign key (tenant_id, viagem_id) references public.viagens (tenant_id, id)
);

create index abastecimentos_veiculo_km_idx on public.abastecimentos (veiculo_id, km);
create index abastecimentos_viagem_idx on public.abastecimentos (viagem_id);

create table public.despesas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  viagem_id uuid not null,
  data date not null default current_date,
  categoria text not null,
  valor numeric(12,2) not null check (valor > 0),
  forma_pagamento text not null
    check (forma_pagamento in ('adiantamento', 'cartao_empresa', 'proprio_bolso')),
  local text,
  descricao text,
  observacoes text,
  comprovante_path text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, viagem_id) references public.viagens (tenant_id, id)
);

create index despesas_viagem_idx on public.despesas (viagem_id);

-- Tudo que soma ao frete: carga complementar (motorista) e diária/pedágio/reentrega (gestor).
create table public.complementos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  viagem_id uuid not null,
  data date not null default current_date,
  origem_lancamento text not null check (origem_lancamento in ('motorista', 'gestor')),
  tipo text not null
    check (tipo in ('carga_complementar', 'diaria_espera', 'pedagio_adicional', 'reentrega', 'outro')),
  valor numeric(12,2) not null check (valor > 0),
  cliente_carga_adicional text,
  local_coleta text,
  local_entrega text,
  peso_volume text,
  descricao text,
  comprovante_path text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, viagem_id) references public.viagens (tenant_id, id),
  check (origem_lancamento = 'gestor' or tipo = 'carga_complementar')
);

create index complementos_viagem_idx on public.complementos (viagem_id);

create table public.paradas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  viagem_id uuid not null,
  motorista_id uuid not null,
  tipo text not null check (tipo in ('pernoite', 'almoco', 'descanso', 'outro')),
  local_nome text not null check (length(trim(local_nome)) > 0),
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  avaliacao_estrelas smallint check (avaliacao_estrelas between 1 and 5),
  comentario text,
  data_hora timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, viagem_id) references public.viagens (tenant_id, id),
  foreign key (tenant_id, motorista_id) references public.motoristas (tenant_id, id)
);

create index paradas_viagem_idx on public.paradas (viagem_id);
create index paradas_tenant_local_idx on public.paradas (tenant_id, lower(local_nome));

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  viagem_id uuid not null,
  -- 'canhoto' é o documento obrigatório para finalizar a viagem
  tipo text not null check (tipo in ('canhoto', 'cte', 'nota_fiscal', 'comprovante', 'outro')),
  arquivo_path text not null,
  enviado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, viagem_id) references public.viagens (tenant_id, id)
);

create index documentos_viagem_idx on public.documentos (viagem_id, tipo);

-- ---------------------------------------------------------------------------
-- Janelas de consumo: intervalo de km entre dois "tanque cheio" do mesmo veículo.
-- Tabela derivada — recriada por app.recalcular_combustivel.
-- ---------------------------------------------------------------------------
create table public.janelas_consumo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  veiculo_id uuid not null,
  abastecimento_fechamento_id uuid not null unique
    references public.abastecimentos (id) on delete cascade,
  km_inicio numeric(10,1) not null,
  km_fim numeric(10,1) not null,
  litros numeric(12,3) not null,
  custo_total numeric(12,2) not null,
  consumo_km_por_litro numeric(6,2) not null,
  fechada_em timestamptz not null,
  -- false enquanto houver viagem em andamento dentro da janela (rateio aguarda ela finalizar)
  rateada boolean not null,
  foreign key (tenant_id, veiculo_id) references public.veiculos (tenant_id, id) on delete cascade,
  check (km_fim > km_inicio)
);

create index janelas_consumo_veiculo_idx on public.janelas_consumo (veiculo_id, km_fim);

-- ---------------------------------------------------------------------------
-- Identidade do usuário logado (usadas pelas políticas RLS e pelas funções)
-- ---------------------------------------------------------------------------

-- Tenant do usuário logado. Nulo se o login está desativado ou o motorista está inativo.
create function app.tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select u.tenant_id
  from public.usuarios u
  left join public.motoristas m on m.id = u.motorista_id
  where u.id = auth.uid()
    and u.ativo
    and (u.papel = 'gestor' or m.status = 'ativo')
$$;

create function app.papel() returns text
language sql stable security definer set search_path = '' as $$
  select u.papel
  from public.usuarios u
  where u.id = auth.uid() and u.tenant_id = app.tenant_id()
$$;

create function app.eh_gestor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.papel() = 'gestor', false)
$$;

create function app.motorista_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select u.motorista_id
  from public.usuarios u
  where u.id = auth.uid() and u.tenant_id = app.tenant_id() and u.papel = 'motorista'
$$;

-- Cadastros do gestor já nascem no tenant dele (a política RLS confere)
alter table public.veiculos alter column tenant_id set default app.tenant_id();
alter table public.motoristas alter column tenant_id set default app.tenant_id();

-- A viagem pertence ao motorista logado?
create function app.viagem_do_motorista(p_viagem_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.viagens v
    where v.id = p_viagem_id
      and v.tenant_id = app.tenant_id()
      and v.motorista_id = app.motorista_id()
  )
$$;

-- Idem, e ainda está em andamento (única situação em que o motorista lança).
create function app.viagem_aberta_do_motorista(p_viagem_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.viagens v
    where v.id = p_viagem_id
      and v.tenant_id = app.tenant_id()
      and v.motorista_id = app.motorista_id()
      and v.status = 'em_andamento'
  )
$$;
