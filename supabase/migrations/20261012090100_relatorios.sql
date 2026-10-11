-- Frota — relatórios do gestor (Visão Geral e Financeiro)
-- Toda soma de dinheiro é feita aqui, em numeric; o app só exibe.
-- As funções rodam com as permissões de quem chama: o RLS limita ao tenant do gestor
-- (motorista não lê viagens, manutenções nem custos fixos, então recebe zeros).
--
-- Definições usadas nas telas:
--   Faturamento bruto    = frete total (base + complementos) das viagens finalizadas no período
--   Custos operacionais  = combustível + despesas de viagem + comissões + manutenções
--   Custos fixos         = soma dos custos fixos vigentes em cada mês do período
--   Resultado líquido    = faturamento − custos operacionais − custos fixos
-- A viagem entra no período pela data de chegada (fuso de Brasília).

create function app.data_chegada(v public.viagens) returns date
language sql stable set search_path = '' as $$
  select (v.data_hora_chegada at time zone 'America/Sao_Paulo')::date
$$;

grant execute on function app.data_chegada(public.viagens) to authenticated, service_role;

create function public.resumo_financeiro(p_inicio date, p_fim date)
returns table (
  faturamento numeric,
  combustivel numeric,
  despesas numeric,
  comissoes numeric,
  manutencoes numeric,
  custos_operacionais numeric,
  custos_fixos numeric,
  resultado numeric,
  km_rodado numeric,
  viagens integer,
  viagens_combustivel_estimado integer,
  -- adiantamentos ainda não acertados (todas as viagens finalizadas, não só as do período)
  adiantamentos_abertos integer,
  adiantamento_a_devolver numeric,
  adiantamento_a_reembolsar numeric
)
language sql stable set search_path = '' as $$
  with v as (
    select
      coalesce(sum(x.valor_frete_total), 0) as faturamento,
      coalesce(sum(x.combustivel_valor), 0) as combustivel,
      coalesce(sum(x.total_despesas), 0) as despesas,
      coalesce(sum(x.comissao_valor), 0) as comissoes,
      coalesce(sum(x.km_final - x.km_inicial), 0) as km_rodado,
      count(*)::integer as viagens,
      (count(*) filter (where x.combustivel_status = 'estimado'))::integer as estimadas
    from public.viagens x
    where x.status = 'finalizada' and app.data_chegada(x) between p_inicio and p_fim
  ),
  m as (
    select coalesce(sum(x.valor), 0) as total
    from public.manutencoes x
    where x.data between p_inicio and p_fim
  ),
  f as (
    select coalesce(sum(c.valor_mensal), 0) as total
    from generate_series(
           date_trunc('month', p_inicio::timestamp),
           date_trunc('month', p_fim::timestamp),
           interval '1 month') as mes
    join public.custos_fixos c
      on date_trunc('month', c.inicio::timestamp) <= mes
     and (c.fim is null or date_trunc('month', c.fim::timestamp) >= mes)
  ),
  a as (
    select
      count(*)::integer as abertos,
      coalesce(sum(x.adiantamento_saldo) filter (where x.adiantamento_saldo > 0), 0) as a_devolver,
      coalesce(-sum(x.adiantamento_saldo) filter (where x.adiantamento_saldo < 0), 0) as a_reembolsar
    from public.viagens x
    where x.status = 'finalizada' and x.valor_adiantamento > 0 and not x.adiantamento_acertado
  )
  select
    v.faturamento, v.combustivel, v.despesas, v.comissoes, m.total,
    v.combustivel + v.despesas + v.comissoes + m.total,
    f.total,
    v.faturamento - (v.combustivel + v.despesas + v.comissoes + m.total) - f.total,
    v.km_rodado, v.viagens, v.estimadas,
    a.abertos, a.a_devolver, a.a_reembolsar
  from v, m, f, a
$$;

-- Tabela comparativa por placa (Tela 6). Margem = resultado ÷ faturamento.
create function public.desempenho_por_veiculo(p_inicio date, p_fim date)
returns table (
  veiculo_id uuid,
  placa text,
  modelo text,
  viagens integer,
  viagens_combustivel_estimado integer,
  km_rodado numeric,
  faturamento numeric,
  combustivel numeric,
  comissoes numeric,
  despesas numeric,
  manutencoes numeric,
  resultado numeric,
  margem_percentual numeric
)
language sql stable set search_path = '' as $$
  with v as (
    select
      x.veiculo_id,
      count(*)::integer as viagens,
      (count(*) filter (where x.combustivel_status = 'estimado'))::integer as estimadas,
      sum(x.km_final - x.km_inicial) as km_rodado,
      sum(x.valor_frete_total) as faturamento,
      sum(coalesce(x.combustivel_valor, 0)) as combustivel,
      sum(x.comissao_valor) as comissoes,
      sum(x.total_despesas) as despesas
    from public.viagens x
    where x.status = 'finalizada' and app.data_chegada(x) between p_inicio and p_fim
    group by x.veiculo_id
  ),
  m as (
    select x.veiculo_id, sum(x.valor) as total
    from public.manutencoes x
    where x.data between p_inicio and p_fim
    group by x.veiculo_id
  ),
  r as (
    select
      ve.id, ve.placa, ve.modelo,
      coalesce(v.viagens, 0) as viagens,
      coalesce(v.estimadas, 0) as estimadas,
      coalesce(v.km_rodado, 0) as km_rodado,
      coalesce(v.faturamento, 0) as faturamento,
      coalesce(v.combustivel, 0) as combustivel,
      coalesce(v.comissoes, 0) as comissoes,
      coalesce(v.despesas, 0) as despesas,
      coalesce(m.total, 0) as manutencoes
    from public.veiculos ve
    left join v on v.veiculo_id = ve.id
    left join m on m.veiculo_id = ve.id
    where v.veiculo_id is not null or m.veiculo_id is not null
  )
  select
    r.id, r.placa, r.modelo, r.viagens, r.estimadas, r.km_rodado,
    r.faturamento, r.combustivel, r.comissoes, r.despesas, r.manutencoes,
    r.faturamento - r.combustivel - r.comissoes - r.despesas - r.manutencoes,
    case when r.faturamento > 0
         then round((r.faturamento - r.combustivel - r.comissoes - r.despesas - r.manutencoes)
                    * 100 / r.faturamento, 1)
    end
  from r
  order by r.placa
$$;

-- "Atenção necessária" (Tela 2). destino diz para qual tela o alerta leva.
--   CNH: vencida, ou vence em até 30 dias (motoristas ativos)
--   Manutenção: pela última manutenção com "próxima em km" de cada veículo —
--               vencida quando o km atual passou do limite; próxima quando faltam até 1.000 km
--   Pneu: estado "troca" ou "atenção"
create function public.alertas_gestor()
returns table (
  destino text,
  gravidade text,
  mensagem text,
  referencia_id uuid
)
language sql stable set search_path = '' as $$
  select 'motoristas', 'perigo',
         'Motorista ' || m.nome || ': CNH vencida.', m.id
  from public.motoristas m
  where m.status = 'ativo' and m.cnh_validade < current_date

  union all
  select 'motoristas', 'aviso',
         'Motorista ' || m.nome || ': CNH vence em ' || (m.cnh_validade - current_date) || ' dia(s).', m.id
  from public.motoristas m
  where m.status = 'ativo' and m.cnh_validade between current_date and current_date + 30

  union all
  select 'manutencoes',
         case when u.km_proxima <= ve.km_atual then 'perigo' else 'aviso' end,
         'Veículo ' || ve.placa || ': ' || coalesce(nullif(trim(u.descricao), ''), 'manutenção ' || u.tipo)
           || case when u.km_proxima <= ve.km_atual
                   then ' vencida há ' || trim(to_char(ve.km_atual - u.km_proxima, 'FM999G999G990')) || ' km.'
                   else ' a ' || trim(to_char(u.km_proxima - ve.km_atual, 'FM999G999G990')) || ' km do limite.' end,
         ve.id
  from public.veiculos ve
  join lateral (
    select x.km_proxima, x.descricao, x.tipo
    from public.manutencoes x
    where x.veiculo_id = ve.id and x.km_proxima is not null
    order by x.km desc, x.data desc
    limit 1
  ) u on true
  where ve.status <> 'inativo' and u.km_proxima - ve.km_atual <= 1000

  union all
  select 'pneus',
         case when p.estado = 'troca' then 'perigo' else 'aviso' end,
         'Pneu eixo ' || p.eixo || ' ' || p.lado
           || case when p.posicao = 'unico' then '' else ' ' || p.posicao end
           || ' (' || ve.placa || '): '
           || case when p.estado = 'troca' then 'troca urgente.' else 'precisa de atenção.' end,
         ve.id
  from public.pneus p
  join public.veiculos ve on ve.id = p.veiculo_id
  where p.estado <> 'bom' and ve.status <> 'inativo'
$$;

revoke all on function
  public.resumo_financeiro(date, date),
  public.desempenho_por_veiculo(date, date),
  public.alertas_gestor()
from public, anon;

grant execute on function
  public.resumo_financeiro(date, date),
  public.desempenho_por_veiculo(date, date),
  public.alertas_gestor()
to authenticated, service_role;
