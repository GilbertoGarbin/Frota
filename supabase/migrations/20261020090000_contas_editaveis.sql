-- Contas editáveis pelo gestor (Financeiro > Receber / Pagar > Editar): valor e vencimento
-- corrigidos à mão passam a valer e o recálculo automático não sobrescreve mais
-- (valor_manual / vencimento_manual). "Gerar de novo" na viagem refaz as parcelas do zero.

alter table public.recebimentos
  add column valor_manual boolean not null default false,
  add column vencimento_manual boolean not null default false,
  add column observacao text;

alter table public.pagamentos
  add column valor_manual boolean not null default false,
  add column vencimento_manual boolean not null default false,
  add column observacao text;

-- Recebimentos: o que foi corrigido à mão fica; a última parcela fecha o total com o resto
create or replace function app.recalcular_recebimentos(p_viagem_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.viagens%rowtype;
  v_total numeric;
  v_ultima integer;
  v_outras numeric;
begin
  select * into v from public.viagens where id = p_viagem_id;
  if v.id is null then
    return;
  end if;
  v_total := app.frete_das_parcelas(p_viagem_id);
  select max(ordem) into v_ultima from public.recebimentos where viagem_id = p_viagem_id and origem = 'frete';

  update public.recebimentos r
  set valor = round(v_total * r.percentual / 100, 2)
  where r.viagem_id = p_viagem_id and r.origem = 'frete' and r.recebido_em is null
    and not r.valor_manual and r.ordem <> v_ultima;

  select coalesce(sum(r.valor), 0) into v_outras
  from public.recebimentos r
  where r.viagem_id = p_viagem_id and r.origem = 'frete' and r.ordem <> v_ultima;
  update public.recebimentos r
  set valor = greatest(v_total - v_outras, 0)
  where r.viagem_id = p_viagem_id and r.origem = 'frete' and r.recebido_em is null
    and not r.valor_manual and r.ordem = v_ultima;

  update public.recebimentos r
  set vencimento = app.vencimento_da_regra(app.base_da_viagem(v, r.base), r.dias, r.tipo_dias, r.dia_semana)
  where r.viagem_id = p_viagem_id and r.recebido_em is null and not r.vencimento_manual;
end;
$$;

-- Complemento: atualiza o recebimento sem desfazer a correção manual
create or replace function app.sincronizar_recebimento_complemento() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v public.viagens%rowtype;
  regra jsonb;
begin
  if tg_op = 'DELETE' then
    return null; -- o recebimento sai junto (on delete cascade)
  end if;
  if new.tipo <> 'complemento' then
    delete from public.recebimentos where complemento_id = new.id and recebido_em is null;
    return null;
  end if;
  select * into v from public.viagens where id = new.viagem_id;
  select f.parcelas -> (jsonb_array_length(f.parcelas) - 1) into regra
  from public.formas_recebimento f where f.id = v.forma_recebimento_id;

  insert into public.recebimentos
    (tenant_id, viagem_id, complemento_id, origem, descricao, base, dias, tipo_dias, dia_semana, valor)
  values
    (v.tenant_id, v.id, new.id, 'complemento', coalesce('Complemento — ' || nullif(new.descricao, ''), 'Complemento'),
     coalesce(regra->>'base', 'entrega'), coalesce((regra->>'dias')::int, 0), coalesce(regra->>'tipo_dias', 'corridos'),
     nullif(regra->>'dia_semana', '')::smallint, new.valor)
  on conflict (complemento_id) where complemento_id is not null do update
    set valor = case when public.recebimentos.valor_manual then public.recebimentos.valor else excluded.valor end
    where public.recebimentos.recebido_em is null;

  perform app.recalcular_recebimentos(v.id);
  return null;
end;
$$;

-- Pagamentos dos lançamentos: correção manual de valor/vencimento fica
create or replace function app.sincronizar_pagamento_lancamento() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  eh_abast boolean := tg_table_name = 'abastecimentos';
  v_valor numeric;
  v_desc text;
  v_favorecido text;
  v_venc date;
  v_pago date;
  v_motorista text;
begin
  if tg_op = 'DELETE' then
    return null;
  end if;
  if new.forma_pagamento = 'adiantamento' then
    delete from public.pagamentos
    where (abastecimento_id = new.id or despesa_id = new.id) and pago_em is null;
    return null;
  end if;

  select m.nome into v_motorista
  from public.viagens vg join public.motoristas m on m.id = vg.motorista_id
  where vg.id = new.viagem_id;

  if eh_abast then
    v_valor := new.total;
    v_desc := format('Abastecimento — %s L', trim(to_char(new.litros, 'FM999G999D000')));
    v_favorecido := new.posto;
  else
    v_valor := new.valor;
    v_desc := 'Despesa — ' || new.categoria;
    v_favorecido := new.local;
  end if;
  if new.forma_pagamento = 'proprio_bolso' then
    v_desc := v_desc || ' (reembolso ao motorista)';
    v_favorecido := coalesce(v_motorista, v_favorecido);
  end if;
  v_venc := case when new.forma_pagamento = 'a_prazo' then coalesce(new.vencimento, new.data) else new.data end;
  v_pago := case when new.forma_pagamento = 'cartao_empresa' then new.data else null end;

  if eh_abast then
    insert into public.pagamentos
      (tenant_id, viagem_id, abastecimento_id, origem, descricao, favorecido, forma, chave_pix, valor, vencimento, pago_em)
    values
      (new.tenant_id, new.viagem_id, new.id, 'abastecimento', v_desc, v_favorecido, new.forma_pagamento,
       new.chave_pix, v_valor, v_venc, v_pago)
    on conflict (abastecimento_id) where abastecimento_id is not null do update
      set forma = excluded.forma,
          chave_pix = coalesce(excluded.chave_pix, public.pagamentos.chave_pix),
          valor = case when public.pagamentos.valor_manual then public.pagamentos.valor else excluded.valor end,
          vencimento = case when public.pagamentos.vencimento_manual then public.pagamentos.vencimento else excluded.vencimento end,
          pago_em = coalesce(public.pagamentos.pago_em, excluded.pago_em);
  else
    insert into public.pagamentos
      (tenant_id, viagem_id, despesa_id, origem, descricao, favorecido, forma, chave_pix, valor, vencimento, pago_em)
    values
      (new.tenant_id, new.viagem_id, new.id, 'despesa', v_desc, v_favorecido, new.forma_pagamento,
       new.chave_pix, v_valor, v_venc, v_pago)
    on conflict (despesa_id) where despesa_id is not null do update
      set forma = excluded.forma,
          chave_pix = coalesce(excluded.chave_pix, public.pagamentos.chave_pix),
          valor = case when public.pagamentos.valor_manual then public.pagamentos.valor else excluded.valor end,
          vencimento = case when public.pagamentos.vencimento_manual then public.pagamentos.vencimento else excluded.vencimento end,
          pago_em = coalesce(public.pagamentos.pago_em, excluded.pago_em);
  end if;
  return null;
end;
$$;

-- Adiantamento: idem
create or replace function app.viagem_financeiro() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_motorista text;
begin
  if tg_op = 'UPDATE' and (old.valor_adiantamento, old.motorista_id, old.valor_frete_total, old.iniciada_em,
                           old.data_hora_chegada, old.data_prevista)
     is not distinct from (new.valor_adiantamento, new.motorista_id, new.valor_frete_total, new.iniciada_em,
                           new.data_hora_chegada, new.data_prevista) then
    return null;
  end if;
  if new.valor_adiantamento > 0 then
    select m.nome into v_motorista from public.motoristas m where m.id = new.motorista_id;
    insert into public.pagamentos
      (tenant_id, viagem_id, origem, descricao, favorecido, forma, valor, vencimento, pago_em)
    values
      (new.tenant_id, new.id, 'adiantamento', 'Adiantamento ao motorista', v_motorista, 'adiantamento',
       new.valor_adiantamento, coalesce(app.dia_local(new.iniciada_em), new.data_prevista), app.dia_local(new.iniciada_em))
    on conflict (viagem_id) where origem = 'adiantamento' do update
      set favorecido = excluded.favorecido,
          valor = case when public.pagamentos.valor_manual then public.pagamentos.valor else excluded.valor end,
          vencimento = case when public.pagamentos.vencimento_manual then public.pagamentos.vencimento else excluded.vencimento end,
          pago_em = coalesce(public.pagamentos.pago_em, excluded.pago_em);
  else
    delete from public.pagamentos where viagem_id = new.id and origem = 'adiantamento' and pago_em is null;
  end if;

  if exists (select 1 from public.recebimentos where viagem_id = new.id) then
    perform app.recalcular_recebimentos(new.id);
  end if;
  return null;
end;
$$;
