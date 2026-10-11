-- Frota — campos derivados e apuração de combustível
-- Todas as funções daqui são security definer: rodam mesmo quando quem lançou foi o
-- motorista, que não tem permissão de escrita direta em viagens/veículos.

-- ---------------------------------------------------------------------------
-- atualizado_em
-- ---------------------------------------------------------------------------
create function app.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger tocar_atualizado_em before update on public.tenants
  for each row execute function app.tocar_atualizado_em();
create trigger tocar_atualizado_em before update on public.motoristas
  for each row execute function app.tocar_atualizado_em();
create trigger tocar_atualizado_em before update on public.usuarios
  for each row execute function app.tocar_atualizado_em();
create trigger tocar_atualizado_em before update on public.abastecimentos
  for each row execute function app.tocar_atualizado_em();
create trigger tocar_atualizado_em before update on public.despesas
  for each row execute function app.tocar_atualizado_em();
create trigger tocar_atualizado_em before update on public.complementos
  for each row execute function app.tocar_atualizado_em();
create trigger tocar_atualizado_em before update on public.paradas
  for each row execute function app.tocar_atualizado_em();
create trigger tocar_atualizado_em before update on public.documentos
  for each row execute function app.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- Lançamentos: preenche tenant_id (e veículo/motorista) a partir da viagem
-- ---------------------------------------------------------------------------
create function app.lancamento_antes_inserir() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v public.viagens%rowtype;
begin
  if new.viagem_id is not null then
    select * into v from public.viagens where id = new.viagem_id;
  end if;

  if v.id is not null then
    new.tenant_id := coalesce(new.tenant_id, v.tenant_id);
    if tg_table_name = 'abastecimentos' then
      new.veiculo_id := v.veiculo_id;
    elsif tg_table_name = 'paradas' then
      new.motorista_id := v.motorista_id;
    end if;
  end if;

  if tg_table_name = 'complementos' then
    new.origem_lancamento := coalesce(
      new.origem_lancamento,
      case when app.papel() = 'motorista' then 'motorista' else 'gestor' end
    );
    if new.origem_lancamento = 'motorista' then
      new.tipo := coalesce(new.tipo, 'carga_complementar');
    end if;
  end if;

  new.tenant_id := coalesce(new.tenant_id, app.tenant_id());
  return new;
end;
$$;

create trigger lancamento_antes_inserir before insert on public.abastecimentos
  for each row execute function app.lancamento_antes_inserir();
create trigger lancamento_antes_inserir before insert on public.despesas
  for each row execute function app.lancamento_antes_inserir();
create trigger lancamento_antes_inserir before insert on public.complementos
  for each row execute function app.lancamento_antes_inserir();
create trigger lancamento_antes_inserir before insert on public.paradas
  for each row execute function app.lancamento_antes_inserir();
create trigger lancamento_antes_inserir before insert on public.documentos
  for each row execute function app.lancamento_antes_inserir();

-- ---------------------------------------------------------------------------
-- Viagens: frete total, comissão, despesas e gasto do adiantamento
-- Recalculados a cada gravação, a partir dos lançamentos — valor enviado pelo cliente é ignorado.
-- ---------------------------------------------------------------------------
create function app.viagens_derivados() returns trigger
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

create trigger viagens_derivados before insert or update on public.viagens
  for each row execute function app.viagens_derivados();

-- Lançamento gravado/alterado/removido → regrava a viagem para recalcular os derivados
create function app.lancamento_tocar_viagem() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' and old.viagem_id is not null then
    update public.viagens set atualizado_em = now() where id = old.viagem_id;
  end if;
  if tg_op <> 'DELETE' and new.viagem_id is not null
     and (tg_op = 'INSERT' or new.viagem_id is distinct from old.viagem_id) then
    update public.viagens set atualizado_em = now() where id = new.viagem_id;
  end if;
  return null;
end;
$$;

create trigger lancamento_tocar_viagem after insert or update or delete on public.complementos
  for each row execute function app.lancamento_tocar_viagem();
create trigger lancamento_tocar_viagem after insert or update or delete on public.despesas
  for each row execute function app.lancamento_tocar_viagem();
create trigger lancamento_tocar_viagem after insert or update or delete on public.abastecimentos
  for each row execute function app.lancamento_tocar_viagem();

-- ---------------------------------------------------------------------------
-- Apuração de combustível (spec do gestor, seção 5c)
--
-- Recalcula TUDO do veículo a partir dos dados gravados, sempre do mesmo jeito:
-- o resultado depende só do km dos registros, nunca da ordem em que chegaram
-- (um abastecimento offline pode sincronizar depois de outro mais recente).
--
--  1. Janela = intervalo de km entre dois "tanque cheio" consecutivos (diesel).
--     Custo da janela = todos os abastecimentos com km em (início, fim], Arla inclusive.
--     Litros da janela = só diesel (Arla não entra no km/L).
--  2. O custo real da janela é rateado entre as viagens finalizadas, proporcional ao km
--     que cada uma rodou dentro dela. Os centavos de arredondamento vão para a maior parte.
--  3. Viagem com todo o km coberto por janelas rateadas = 'apurado'. O km ainda não
--     coberto é estimado: km ÷ consumo médio × preço de referência → 'estimado'.
--  4. Janela com viagem em andamento dentro dela aguarda essa viagem finalizar
--     (senão o valor "apurado" das outras mudaria depois).
--  5. Consumo médio do veículo = média das últimas 5 janelas (km total ÷ litros total).
-- ---------------------------------------------------------------------------
create function app.recalcular_combustivel(p_veiculo_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_veic public.veiculos%rowtype;
  v_consumo numeric;
  v_preco numeric;
  v_ultima_fechada timestamptz;
begin
  -- Trava o veículo: dois recálculos simultâneos do mesmo veículo rodam em fila
  select * into v_veic from public.veiculos where id = p_veiculo_id for update;
  if not found then
    return;
  end if;

  delete from public.janelas_consumo where veiculo_id = p_veiculo_id;

  insert into public.janelas_consumo (
    tenant_id, veiculo_id, abastecimento_fechamento_id, km_inicio, km_fim,
    litros, custo_total, consumo_km_por_litro, fechada_em, rateada
  )
  with ancoras as (
    select a.id, a.km, a.criado_em,
           lag(a.km) over (order by a.km, a.data, a.id) as km_anterior
    from public.abastecimentos a
    where a.veiculo_id = p_veiculo_id and a.tanque_cheio and a.combustivel <> 'arla32'
  ),
  janelas as (
    select n.id, n.km_anterior as km_inicio, n.km as km_fim, n.criado_em,
           (select coalesce(sum(a.litros), 0) from public.abastecimentos a
            where a.veiculo_id = p_veiculo_id and a.combustivel <> 'arla32'
              and a.km > n.km_anterior and a.km <= n.km) as litros,
           (select coalesce(sum(a.total), 0) from public.abastecimentos a
            where a.veiculo_id = p_veiculo_id
              and a.km > n.km_anterior and a.km <= n.km) as custo
    from ancoras n
    where n.km_anterior is not null and n.km > n.km_anterior
  )
  select v_veic.tenant_id, p_veiculo_id, j.id, j.km_inicio, j.km_fim,
         -- teto: um lançamento absurdo (ex.: 0,5 L em 5.000 km) não pode travar a sincronização
         j.litros, j.custo, least(round((j.km_fim - j.km_inicio) / j.litros, 2), 9999.99), j.criado_em,
         not exists (
           select 1 from public.viagens v
           where v.veiculo_id = p_veiculo_id
             and v.status = 'em_andamento'
             and v.km_inicial < j.km_fim
         )
  from janelas j
  where j.litros > 0;

  -- Consumo médio: últimas 5 janelas; o valor informado pelo gestor vale se não há
  -- janela ou se foi ajustado depois do último fechamento.
  -- (sem janelas o resultado tem de ser nulo; least() sozinho ignoraria o nulo)
  select case when count(*) > 0
              then least(round(sum(u.km_fim - u.km_inicio) / sum(u.litros), 2), 9999.99) end
    into v_consumo
  from (
    select j.km_inicio, j.km_fim, j.litros
    from public.janelas_consumo j
    where j.veiculo_id = p_veiculo_id
    order by j.km_fim desc
    limit 5
  ) u;

  select max(j.fechada_em) into v_ultima_fechada
  from public.janelas_consumo j
  where j.veiculo_id = p_veiculo_id;

  if v_veic.consumo_medio_informado is not null
     and (v_consumo is null or v_veic.consumo_informado_em > v_ultima_fechada) then
    v_consumo := v_veic.consumo_medio_informado;
  end if;

  -- Preço de referência: abastecimento de diesel mais recente do próprio veículo
  select a.preco_litro into v_preco
  from public.abastecimentos a
  where a.veiculo_id = p_veiculo_id and a.combustivel <> 'arla32'
  order by a.data desc, a.km desc, a.id
  limit 1;
  v_preco := coalesce(v_preco, v_veic.preco_medio_referencia_combustivel);

  update public.veiculos
  set consumo_medio_km_por_litro = v_consumo,
      preco_medio_referencia_combustivel = v_preco
  where id = p_veiculo_id
    and (consumo_medio_km_por_litro is distinct from v_consumo
         or preco_medio_referencia_combustivel is distinct from v_preco);

  perform set_config('app.recalculando', '1', true);

  with viagens_fin as (
    select v.id, v.km_inicial, v.km_final, v.km_final - v.km_inicial as km_total
    from public.viagens v
    where v.veiculo_id = p_veiculo_id and v.status = 'finalizada'
  ),
  sobreposicao as (
    select j.id as janela_id, j.custo_total, f.id as viagem_id,
           least(f.km_final, j.km_fim) - greatest(f.km_inicial, j.km_inicio) as km
    from public.janelas_consumo j
    join viagens_fin f on f.km_inicial < j.km_fim and f.km_final > j.km_inicio
    where j.veiculo_id = p_veiculo_id and j.rateada
  ),
  partes as (
    select s.janela_id, s.viagem_id, s.km, s.custo_total,
           round(s.custo_total * s.km / sum(s.km) over (partition by s.janela_id), 2) as valor,
           row_number() over (partition by s.janela_id order by s.km desc, s.viagem_id) as ordem
    from sobreposicao s
  ),
  ajustadas as (
    select p.viagem_id, p.km,
           p.valor + case when p.ordem = 1
                          then p.custo_total - sum(p.valor) over (partition by p.janela_id)
                          else 0 end as valor
    from partes p
  ),
  apurado as (
    select a.viagem_id, sum(a.km) as km_coberto, sum(a.valor) as valor_real
    from ajustadas a
    group by a.viagem_id
  ),
  resultado as (
    select f.id,
           case when f.km_total > 0 and coalesce(r.km_coberto, 0) >= f.km_total
                then 'apurado' else 'estimado' end as status,
           case
             when f.km_total <= 0 then 0
             when coalesce(r.km_coberto, 0) >= f.km_total then r.valor_real
             when v_consumo is null or v_preco is null then r.valor_real
             else coalesce(r.valor_real, 0)
                  + round((f.km_total - coalesce(r.km_coberto, 0)) / v_consumo * v_preco, 2)
           end as valor
    from viagens_fin f
    left join apurado r on r.viagem_id = f.id
  )
  update public.viagens v
  set combustivel_status = x.status,
      combustivel_valor = x.valor
  from resultado x
  where v.id = x.id
    and (v.combustivel_status is distinct from x.status
         or v.combustivel_valor is distinct from x.valor);

  -- Viagem que deixou de estar finalizada não tem combustível
  update public.viagens v
  set combustivel_status = null,
      combustivel_valor = null
  where v.veiculo_id = p_veiculo_id
    and v.status <> 'finalizada'
    and (v.combustivel_status is not null or v.combustivel_valor is not null);

  perform set_config('app.recalculando', '', true);
end;
$$;

-- Gatilhos que disparam o recálculo -------------------------------------------------

create function app.abastecimento_recalcular() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    perform app.recalcular_combustivel(old.veiculo_id);
  end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.veiculo_id is distinct from old.veiculo_id) then
    perform app.recalcular_combustivel(new.veiculo_id);
  end if;
  return null;
end;
$$;

create trigger abastecimento_recalcular after insert or update or delete on public.abastecimentos
  for each row execute function app.abastecimento_recalcular();

create function app.viagem_recalcular() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'programada' then
    return null;
  end if;

  if tg_op <> 'DELETE' and new.status = 'finalizada' then
    update public.veiculos
    set km_atual = new.km_final
    where id = new.veiculo_id and km_atual < new.km_final;
  end if;

  if tg_op <> 'INSERT' then
    perform app.recalcular_combustivel(old.veiculo_id);
  end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.veiculo_id is distinct from old.veiculo_id) then
    perform app.recalcular_combustivel(new.veiculo_id);
  end if;
  return null;
end;
$$;

-- "update of": só dispara quando o comando altera uma dessas colunas — o update que o
-- próprio recálculo faz (combustivel_*) não dispara de novo.
create trigger viagem_recalcular
  after insert or delete or update of status, km_inicial, km_final, veiculo_id on public.viagens
  for each row execute function app.viagem_recalcular();

-- Veículos --------------------------------------------------------------------------

create function app.veiculos_antes_gravar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.consumo_medio_informado is not null then
      new.consumo_informado_em := now();
      new.consumo_medio_km_por_litro := new.consumo_medio_informado;
    end if;
  elsif new.consumo_medio_informado is distinct from old.consumo_medio_informado then
    new.consumo_informado_em := now();
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger veiculos_antes_gravar before insert or update on public.veiculos
  for each row execute function app.veiculos_antes_gravar();

create function app.veiculo_recalcular() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.recalcular_combustivel(new.id);
  return null;
end;
$$;

-- Gestor ajustou o consumo informado → refaz as estimativas
create trigger veiculo_recalcular after update of consumo_medio_informado on public.veiculos
  for each row execute function app.veiculo_recalcular();
