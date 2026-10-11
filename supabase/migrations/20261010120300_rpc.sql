-- Frota — funções chamadas pelo app (supabase.rpc)
-- As do motorista são security definer porque ele não tem acesso direto à tabela viagens;
-- cada uma confere o tenant e o dono da viagem antes de agir. Todas são idempotentes:
-- a fila offline pode reenviar a mesma chamada sem efeito colateral.

-- ---------------------------------------------------------------------------
-- Primeiro acesso do gestor: cria a transportadora e o vincula a ela
-- ---------------------------------------------------------------------------
create function public.criar_tenant(p_nome text, p_nome_usuario text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
begin
  if v_uid is null then
    raise exception 'Login necessário' using errcode = '28000';
  end if;
  if exists (select 1 from public.usuarios u where u.id = v_uid) then
    raise exception 'Este usuário já pertence a uma transportadora' using errcode = '23505';
  end if;

  insert into public.tenants (nome) values (p_nome) returning id into v_tenant;
  insert into public.usuarios (id, tenant_id, papel, nome)
  values (v_uid, v_tenant, 'gestor', p_nome_usuario);
  return v_tenant;
end;
$$;

-- ---------------------------------------------------------------------------
-- Viagens do motorista logado — sem combustível nem resultado operacional
-- (regra fixa: o motorista vê frete e a própria comissão, nunca a margem da empresa)
-- ---------------------------------------------------------------------------
create function public.viagens_do_motorista()
returns table (
  id uuid,
  veiculo_id uuid,
  cliente text,
  carga text,
  origem text,
  destino text,
  data_prevista date,
  status text,
  forma_pagamento_frete text,
  km_inicial numeric,
  km_final numeric,
  valor_frete numeric,
  valor_frete_total numeric,
  comissao_percentual numeric,
  comissao_valor numeric,
  valor_adiantamento numeric,
  adiantamento_gasto numeric,
  adiantamento_saldo numeric,
  adiantamento_acertado boolean,
  iniciada_em timestamptz,
  data_hora_chegada timestamptz,
  local_chegada text,
  observacoes text,
  observacoes_finais text,
  atualizado_em timestamptz
)
language sql stable security definer set search_path = '' as $$
  select v.id, v.veiculo_id, v.cliente, v.carga, v.origem, v.destino, v.data_prevista,
         v.status, v.forma_pagamento_frete, v.km_inicial, v.km_final,
         v.valor_frete, v.valor_frete_total, v.comissao_percentual, v.comissao_valor,
         v.valor_adiantamento, v.adiantamento_gasto, v.adiantamento_saldo,
         v.adiantamento_acertado, v.iniciada_em, v.data_hora_chegada, v.local_chegada,
         v.observacoes, v.observacoes_finais, v.atualizado_em
  from public.viagens v
  where v.tenant_id = app.tenant_id()
    and v.motorista_id = app.motorista_id()
$$;

-- ---------------------------------------------------------------------------
-- Fluxo alternativo: o próprio motorista cadastra a viagem (dono que também dirige).
-- O adiantamento não é definido aqui — só o gestor define.
-- ---------------------------------------------------------------------------
create function public.criar_viagem_motorista(
  p_id uuid,
  p_veiculo_id uuid,
  p_origem text,
  p_destino text,
  p_valor_frete numeric,
  p_data_prevista date default current_date,
  p_cliente text default null,
  p_carga text default null,
  p_observacoes text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := app.tenant_id();
  v_motorista uuid := app.motorista_id();
begin
  if v_tenant is null or v_motorista is null then
    raise exception 'Apenas motoristas ativos podem cadastrar a própria viagem' using errcode = '42501';
  end if;

  insert into public.viagens (
    id, tenant_id, motorista_id, veiculo_id, origem, destino, valor_frete,
    data_prevista, cliente, carga, observacoes
  ) values (
    p_id, v_tenant, v_motorista, p_veiculo_id, p_origem, p_destino, p_valor_frete,
    coalesce(p_data_prevista, current_date), p_cliente, p_carga, p_observacoes
  )
  on conflict (id) do nothing;
end;
$$;

-- Carrega a viagem conferindo tenant e dono; trava a linha.
create function app.viagem_para_operar(p_viagem_id uuid) returns public.viagens
language plpgsql security definer set search_path = '' as $$
declare
  v public.viagens%rowtype;
begin
  select * into v from public.viagens
  where id = p_viagem_id and tenant_id = app.tenant_id()
  for update;

  if v.id is null or not (app.eh_gestor() or v.motorista_id = app.motorista_id()) then
    raise exception 'Viagem não encontrada' using errcode = 'P0002';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Confirmar e iniciar viagem
-- ---------------------------------------------------------------------------
create function public.iniciar_viagem(
  p_viagem_id uuid,
  p_km_inicial numeric,
  p_iniciada_em timestamptz default now()
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.viagens%rowtype := app.viagem_para_operar(p_viagem_id);
begin
  if v.status <> 'programada' then
    return; -- já iniciada: reenvio da fila
  end if;
  if p_km_inicial is null or p_km_inicial < 0 then
    raise exception 'Informe o km inicial' using errcode = '22023';
  end if;
  if exists (select 1 from public.viagens o
             where o.motorista_id = v.motorista_id and o.status = 'em_andamento') then
    raise exception 'Já existe uma viagem em andamento para este motorista' using errcode = '23505';
  end if;

  update public.viagens
  set status = 'em_andamento',
      km_inicial = p_km_inicial,
      iniciada_em = coalesce(p_iniciada_em, now())
  where id = p_viagem_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Finalizar viagem (conferência final). Exige o canhoto anexado.
-- ---------------------------------------------------------------------------
create function public.finalizar_viagem(
  p_viagem_id uuid,
  p_km_final numeric,
  p_data_hora_chegada timestamptz default now(),
  p_local_chegada text default null,
  p_observacoes_finais text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.viagens%rowtype := app.viagem_para_operar(p_viagem_id);
begin
  if v.status = 'finalizada' then
    return; -- já finalizada: reenvio da fila
  end if;
  if v.status <> 'em_andamento' then
    raise exception 'A viagem ainda não foi iniciada' using errcode = '22023';
  end if;
  if p_km_final is null or p_km_final < v.km_inicial then
    raise exception 'O km final deve ser maior ou igual ao km inicial (%)', v.km_inicial
      using errcode = '22023';
  end if;
  if not exists (select 1 from public.documentos d
                 where d.viagem_id = p_viagem_id and d.tipo = 'canhoto') then
    raise exception 'Falta anexar: canhoto' using errcode = 'P0001';
  end if;

  update public.viagens
  set status = 'finalizada',
      km_final = p_km_final,
      data_hora_chegada = coalesce(p_data_hora_chegada, now()),
      local_chegada = p_local_chegada,
      observacoes_finais = p_observacoes_finais
  where id = p_viagem_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Adiantamento sugerido: média das viagens finalizadas na mesma rota.
-- Sem linhas de histórico → valor nulo e quantidade 0 ("Sem histórico nesta rota").
-- Roda com as permissões de quem chama (só o gestor lê viagens).
-- ---------------------------------------------------------------------------
create function public.sugerir_adiantamento(p_origem text, p_destino text)
returns table (valor numeric, quantidade integer)
language sql stable set search_path = '' as $$
  select round(avg(v.valor_adiantamento), 2), count(*)::integer
  from public.viagens v
  where v.status = 'finalizada'
    and v.valor_adiantamento > 0
    and lower(trim(v.origem)) = lower(trim(p_origem))
    and lower(trim(v.destino)) = lower(trim(p_destino))
$$;

-- ---------------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------------
revoke all on function app.viagem_para_operar(uuid) from public;

revoke all on function
  public.criar_tenant(text, text),
  public.viagens_do_motorista(),
  public.criar_viagem_motorista(uuid, uuid, text, text, numeric, date, text, text, text),
  public.iniciar_viagem(uuid, numeric, timestamptz),
  public.finalizar_viagem(uuid, numeric, timestamptz, text, text),
  public.sugerir_adiantamento(text, text)
from public, anon;

grant execute on function
  public.criar_tenant(text, text),
  public.viagens_do_motorista(),
  public.criar_viagem_motorista(uuid, uuid, text, text, numeric, date, text, text, text),
  public.iniciar_viagem(uuid, numeric, timestamptz),
  public.finalizar_viagem(uuid, numeric, timestamptz, text, text),
  public.sugerir_adiantamento(text, text)
to authenticated, service_role;
