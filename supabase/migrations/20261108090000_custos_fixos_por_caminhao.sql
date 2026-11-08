-- Frota — custos fixos por caminhão
--
-- O custo fixo pode ser de um caminhão (parcela, seguro, IPVA, rastreador…) ou geral da
-- transportadora (contador, escritório, sistema). A coluna veiculo_id já existia; agora a tela usa.
--
-- Novidades:
--   * categoria vira lista fechada (para lembrar o gestor do que costuma faltar: depreciação, IPVA…)
--   * periodicidade: 'mensal' (informa valor_mensal) ou 'anual' (informa valor_anual e o banco
--     guarda valor_mensal = valor_anual ÷ 12, arredondado ao centavo)
--   * desempenho_por_veiculo desconta o custo fixo: o do próprio caminhão + a parte dele no custo
--     geral, que é dividido igualmente entre os caminhões ativos (status <> 'inativo') em cada mês.
--     Caminhão parado com custo fixo aparece na tabela (com prejuízo), porque é isso que ele custa.

-- ---------------------------------------------------------------------------
-- Categoria: lista fechada. O que já estava escrito à mão é encaixado pelo nome.
-- ---------------------------------------------------------------------------
update public.custos_fixos set categoria = case
    when categoria is null or trim(categoria) = '' then null
    when categoria ilike '%financ%' or categoria ilike '%parcela%' or categoria ilike '%leasing%'
      or categoria ilike '%consórcio%' or categoria ilike '%consorcio%' then 'financiamento'
    when categoria ilike '%deprecia%' then 'depreciacao'
    when categoria ilike '%seguro%' then 'seguro'
    when categoria ilike '%ipva%' or categoria ilike '%licencia%' then 'ipva_licenciamento'
    when categoria ilike '%salár%' or categoria ilike '%salar%' or categoria ilike '%encargo%'
      or categoria ilike '%folha%' then 'salario_encargos'
    when categoria ilike '%rastrea%' or categoria ilike '%monitora%' then 'rastreador'
    when categoria ilike '%antt%' or categoria ilike '%rntrc%' or categoria ilike '%tacógrafo%'
      or categoria ilike '%tacografo%' or categoria ilike '%taxa%' then 'taxas'
    when categoria ilike '%contab%' or categoria ilike '%contador%' or categoria ilike '%escrit%'
      or categoria ilike '%aluguel%' or categoria ilike '%sistema%' or categoria ilike '%admin%'
      or categoria ilike '%telefone%' or categoria ilike '%internet%' then 'administrativo'
    else 'outros'
  end;

alter table public.custos_fixos
  add constraint custos_fixos_categoria_check check (categoria is null or categoria in (
    'financiamento', 'depreciacao', 'seguro', 'ipva_licenciamento', 'salario_encargos',
    'rastreador', 'taxas', 'administrativo', 'outros'));

-- ---------------------------------------------------------------------------
-- Periodicidade e valor anual
-- ---------------------------------------------------------------------------
alter table public.custos_fixos
  add column periodicidade text not null default 'mensal' check (periodicidade in ('mensal', 'anual')),
  add column valor_anual numeric(12,2) check (valor_anual > 0),
  add constraint custos_fixos_anual_tem_valor check ((periodicidade = 'anual') = (valor_anual is not null));

create index custos_fixos_veiculo_idx on public.custos_fixos (veiculo_id) where veiculo_id is not null;

-- valor_mensal do custo anual é derivado: o que o cliente mandar é ignorado
create function app.custo_fixo_valor_mensal() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.periodicidade = 'anual' then
    new.valor_mensal := round(new.valor_anual / 12, 2);
  else
    new.valor_anual := null;
  end if;
  return new;
end
$$;

create trigger custo_fixo_valor_mensal before insert or update on public.custos_fixos
  for each row execute function app.custo_fixo_valor_mensal();

-- ---------------------------------------------------------------------------
-- Tabela por placa com custo fixo
-- ---------------------------------------------------------------------------
drop function public.desempenho_por_veiculo(date, date);

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
  -- custo fixo do próprio caminhão no período
  custos_fixos_proprios numeric,
  -- parte do custo fixo geral (dividido igualmente entre os caminhões ativos)
  custos_fixos_rateados numeric,
  custos_fixos numeric,
  -- resultado antes do custo fixo (só a operação: frete − combustível − comissão − despesas − manutenção)
  resultado_operacional numeric,
  -- resultado depois do custo fixo
  resultado numeric,
  margem_percentual numeric,
  custo_fixo_por_km numeric
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
  -- custos vigentes em cada mês do período (mesma regra do resumo_financeiro)
  vig as (
    select c.veiculo_id, c.valor_mensal
    from generate_series(
           date_trunc('month', p_inicio::timestamp),
           date_trunc('month', p_fim::timestamp),
           interval '1 month') as mes
    join public.custos_fixos c
      on date_trunc('month', c.inicio::timestamp) <= mes
     and (c.fim is null or date_trunc('month', c.fim::timestamp) >= mes)
  ),
  proprio as (
    select vig.veiculo_id, sum(vig.valor_mensal) as total
    from vig where vig.veiculo_id is not null
    group by vig.veiculo_id
  ),
  ativos as (
    select count(*) as n from public.veiculos where status <> 'inativo'
  ),
  parte_geral as (
    select case when ativos.n > 0
                then round(coalesce((select sum(vig.valor_mensal) from vig where vig.veiculo_id is null), 0) / ativos.n, 2)
                else 0 end as valor
    from ativos
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
      coalesce(m.total, 0) as manutencoes,
      coalesce(p.total, 0) as fixo_proprio,
      case when ve.status <> 'inativo' then pg.valor else 0 end as fixo_rateado
    from public.veiculos ve
    cross join parte_geral pg
    left join v on v.veiculo_id = ve.id
    left join m on m.veiculo_id = ve.id
    left join proprio p on p.veiculo_id = ve.id
    where ve.status <> 'inativo'
       or v.veiculo_id is not null or m.veiculo_id is not null or p.veiculo_id is not null
  ),
  t as (
    select r.*,
      r.fixo_proprio + r.fixo_rateado as fixo,
      r.faturamento - r.combustivel - r.comissoes - r.despesas - r.manutencoes as operacional
    from r
  )
  select
    t.id, t.placa, t.modelo, t.viagens, t.estimadas, t.km_rodado,
    t.faturamento, t.combustivel, t.comissoes, t.despesas, t.manutencoes,
    t.fixo_proprio, t.fixo_rateado, t.fixo,
    t.operacional,
    t.operacional - t.fixo,
    case when t.faturamento > 0 then round((t.operacional - t.fixo) * 100 / t.faturamento, 1) end,
    case when t.km_rodado > 0 then round(t.fixo / t.km_rodado, 2) end
  from t
  order by t.placa
$$;

revoke all on function public.desempenho_por_veiculo(date, date) from public, anon;
grant execute on function public.desempenho_por_veiculo(date, date) to authenticated, service_role;
