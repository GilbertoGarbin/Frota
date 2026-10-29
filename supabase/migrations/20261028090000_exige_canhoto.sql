-- Canhoto obrigatório passa a ser configurável.
--   tenants.exige_canhoto: padrão da transportadora (tela Configurações, só o admin)
--   viagens.exige_canhoto: vale para a viagem; nasce com o padrão da transportadora e o gestor
--   pode trocar naquela viagem. finalizar_viagem só cobra o canhoto quando a viagem exige.
-- Viagens e transportadoras que já existem continuam exigindo (como era antes).

alter table public.tenants add column exige_canhoto boolean not null default true;

alter table public.viagens add column exige_canhoto boolean not null default true;
-- sem valor enviado, o trigger abaixo preenche com o padrão da transportadora
alter table public.viagens alter column exige_canhoto drop default;

create function app.viagem_exige_canhoto_padrao()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.exige_canhoto is null then
    select t.exige_canhoto into new.exige_canhoto from public.tenants t where t.id = new.tenant_id;
    new.exige_canhoto := coalesce(new.exige_canhoto, true);
  end if;
  return new;
end;
$$;

-- nome começando por "a" para rodar antes dos outros triggers de insert
create trigger a_exige_canhoto_padrao before insert on public.viagens
  for each row execute function app.viagem_exige_canhoto_padrao();

-- ---------------------------------------------------------------------------
-- Configurações da transportadora
-- ---------------------------------------------------------------------------
create function public.minhas_configuracoes()
returns table (exige_canhoto boolean)
language sql stable security definer set search_path = '' as $$
  select t.exige_canhoto from public.tenants t
  where t.id = app.tenant_id() and app.eh_gestor()
$$;

create function public.salvar_configuracoes(p_exige_canhoto boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if app.tenant_id() is null or not app.eh_admin() then
    raise exception 'Só o admin da transportadora altera as configurações' using errcode = '42501';
  end if;
  update public.tenants
  set exige_canhoto = coalesce(p_exige_canhoto, true)
  where id = app.tenant_id();
end;
$$;

-- ---------------------------------------------------------------------------
-- Finalizar: só cobra o canhoto se a viagem exige
-- ---------------------------------------------------------------------------
create or replace function public.finalizar_viagem(
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
  if v.exige_canhoto and not exists (select 1 from public.documentos d
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
-- viagens_do_motorista: o app precisa saber se a viagem exige canhoto
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
  atualizado_em timestamptz,
  exige_canhoto boolean
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
         v.atualizado_em,
         v.exige_canhoto
  from public.viagens v
  where v.tenant_id = app.tenant_id()
    and v.motorista_id = app.motorista_id()
$$;

revoke all on function
  app.viagem_exige_canhoto_padrao(),
  public.minhas_configuracoes(),
  public.salvar_configuracoes(boolean),
  public.viagens_do_motorista()
from public, anon;

grant execute on function
  public.minhas_configuracoes(),
  public.salvar_configuracoes(boolean),
  public.viagens_do_motorista()
to authenticated, service_role;
