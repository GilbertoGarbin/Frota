-- Frota — o que o app do motorista ainda precisava do banco

-- ---------------------------------------------------------------------------
-- Gasto do próprio bolso do motorista (despesas e abastecimentos): valor que a empresa
-- deve reembolsar, mostrado na prestação de contas ao lado do saldo do adiantamento.
-- ---------------------------------------------------------------------------
alter table public.viagens
  add column gasto_proprio_bolso numeric(12,2) not null default 0;

create or replace function app.viagens_derivados() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_recalculando boolean := coalesce(current_setting('app.recalculando', true), '') = '1';
begin
  if tg_op = 'INSERT' then
    new.tenant_id := coalesce(new.tenant_id, app.tenant_id());
    new.combustivel_status := null;
    new.combustivel_valor := null;
  elsif not v_recalculando then
    -- Combustível só muda por app.recalcular_combustivel
    new.combustivel_status := old.combustivel_status;
    new.combustivel_valor := old.combustivel_valor;
  end if;

  -- Percentual de comissão: acompanha o cadastro do motorista enquanto a viagem está
  -- programada e é congelado quando ela inicia (mudar o cadastro não altera viagens passadas).
  if tg_op = 'INSERT'
     or new.status = 'programada'
     or old.status = 'programada'
     or new.motorista_id is distinct from old.motorista_id then
    select case when m.modelo_remuneracao = 'comissionado' then m.comissao_percentual else 0 end
      into new.comissao_percentual
    from public.motoristas m
    where m.id = new.motorista_id;
    new.comissao_percentual := coalesce(new.comissao_percentual, 0);
  else
    new.comissao_percentual := old.comissao_percentual;
  end if;

  new.valor_frete_total := new.valor_frete + coalesce(
    (select sum(c.valor) from public.complementos c where c.viagem_id = new.id), 0);
  new.comissao_valor := round(new.valor_frete_total * new.comissao_percentual / 100, 2);
  new.total_despesas := coalesce(
    (select sum(d.valor) from public.despesas d where d.viagem_id = new.id), 0);
  new.adiantamento_gasto :=
    coalesce((select sum(d.valor) from public.despesas d
              where d.viagem_id = new.id and d.forma_pagamento = 'adiantamento'), 0)
    + coalesce((select sum(a.total) from public.abastecimentos a
                where a.viagem_id = new.id and a.forma_pagamento = 'adiantamento'), 0);
  new.gasto_proprio_bolso :=
    coalesce((select sum(d.valor) from public.despesas d
              where d.viagem_id = new.id and d.forma_pagamento = 'proprio_bolso'), 0)
    + coalesce((select sum(a.total) from public.abastecimentos a
                where a.viagem_id = new.id and a.forma_pagamento = 'proprio_bolso'), 0);

  if not new.adiantamento_acertado then
    new.adiantamento_acertado_em := null;
  elsif tg_op = 'INSERT' or not old.adiantamento_acertado then
    new.adiantamento_acertado_em := coalesce(new.adiantamento_acertado_em, now());
  else
    new.adiantamento_acertado_em := old.adiantamento_acertado_em;
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

-- Recalcula as viagens que já existem
update public.viagens set atualizado_em = now();

-- ---------------------------------------------------------------------------
-- viagens_do_motorista: mais colunas (muda o tipo de retorno → recriar)
--   editavel: viagem que o próprio motorista cadastrou e ainda não iniciou
-- ---------------------------------------------------------------------------
drop function public.viagens_do_motorista();

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
  gasto_proprio_bolso numeric,
  iniciada_em timestamptz,
  data_hora_chegada timestamptz,
  local_chegada text,
  observacoes text,
  observacoes_finais text,
  editavel boolean,
  atualizado_em timestamptz
)
language sql stable security definer set search_path = '' as $$
  select v.id, v.veiculo_id, v.cliente, v.carga, v.origem, v.destino, v.data_prevista,
         v.status, v.forma_pagamento_frete, v.km_inicial, v.km_final,
         v.valor_frete, v.valor_frete_total, v.comissao_percentual, v.comissao_valor,
         v.valor_adiantamento, v.adiantamento_gasto, v.adiantamento_saldo,
         v.adiantamento_acertado, v.gasto_proprio_bolso,
         v.iniciada_em, v.data_hora_chegada, v.local_chegada,
         v.observacoes, v.observacoes_finais,
         v.status = 'programada' and v.criado_por = auth.uid(),
         v.atualizado_em
  from public.viagens v
  where v.tenant_id = app.tenant_id()
    and v.motorista_id = app.motorista_id()
$$;

-- ---------------------------------------------------------------------------
-- Editar viagem que o próprio motorista cadastrou, antes de iniciar
-- ---------------------------------------------------------------------------
create function public.editar_viagem_motorista(
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
begin
  update public.viagens
  set veiculo_id = p_veiculo_id,
      origem = p_origem,
      destino = p_destino,
      valor_frete = p_valor_frete,
      data_prevista = coalesce(p_data_prevista, data_prevista),
      cliente = p_cliente,
      carga = p_carga,
      observacoes = p_observacoes
  where id = p_id
    and tenant_id = app.tenant_id()
    and motorista_id = app.motorista_id()
    and criado_por = auth.uid()
    and status = 'programada';

  if not found then
    raise exception 'Só é possível editar viagens que você cadastrou e ainda não iniciou'
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resumo do motorista num período (chip do Início e cards do Histórico).
-- Conta viagens finalizadas pela data de chegada.
-- ---------------------------------------------------------------------------
create function public.resumo_motorista(p_inicio date, p_fim date)
returns table (viagens integer, km_rodado numeric, comissao numeric)
language sql stable security definer set search_path = '' as $$
  select count(*)::integer,
         coalesce(sum(v.km_final - v.km_inicial), 0),
         coalesce(sum(v.comissao_valor), 0)
  from public.viagens v
  where v.tenant_id = app.tenant_id()
    and v.motorista_id = app.motorista_id()
    and v.status = 'finalizada'
    and app.data_chegada(v) between p_inicio and p_fim
$$;

-- ---------------------------------------------------------------------------
-- Parada frequente na rota da viagem (lembrete na tela "Confirmar viagem").
-- Correspondência por texto de origem/destino e nome do local (decisao_stack_infra §2.2).
-- ---------------------------------------------------------------------------
create function public.parada_sugerida(p_viagem_id uuid)
returns table (local_nome text, media_estrelas numeric, vezes integer)
language sql stable security definer set search_path = '' as $$
  select min(p.local_nome), round(avg(p.avaliacao_estrelas), 1), count(*)::integer
  from public.viagens alvo
  join public.viagens v
    on v.tenant_id = alvo.tenant_id
   and v.id <> alvo.id
   and lower(trim(v.origem)) = lower(trim(alvo.origem))
   and lower(trim(v.destino)) = lower(trim(alvo.destino))
  join public.paradas p on p.viagem_id = v.id and p.avaliacao_estrelas is not null
  where alvo.id = p_viagem_id
    and alvo.tenant_id = app.tenant_id()
    and (app.eh_gestor() or alvo.motorista_id = app.motorista_id())
  group by lower(trim(p.local_nome))
  having avg(p.avaliacao_estrelas) >= 3
  order by count(*) desc, avg(p.avaliacao_estrelas) desc
  limit 1
$$;

revoke all on function
  public.viagens_do_motorista(),
  public.editar_viagem_motorista(uuid, uuid, text, text, numeric, date, text, text, text),
  public.resumo_motorista(date, date),
  public.parada_sugerida(uuid)
from public, anon;

grant execute on function
  public.viagens_do_motorista(),
  public.editar_viagem_motorista(uuid, uuid, text, text, numeric, date, text, text, text),
  public.resumo_motorista(date, date),
  public.parada_sugerida(uuid)
to authenticated, service_role;
