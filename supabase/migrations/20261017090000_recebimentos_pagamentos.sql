-- Contas do financeiro: recebimentos (o que entra) e pagamentos (o que sai), sempre ligados à
-- viagem e, conforme o caso, ao abastecimento, à despesa ou ao complemento.
--
-- Recebimentos
--   origem 'frete'       — parcelas da forma de recebimento, criadas pelo botão "Gerar
--                          recebimentos" (public.gerar_recebimentos). O valor das parcelas cobre
--                          o frete total menos os complementos do tipo 'complemento'.
--   origem 'complemento' — criado sozinho quando o gestor lança um complemento.
--   Cada linha guarda a regra da parcela (base, dias, tipo de dia, dia da semana): enquanto não
--   foi recebida, valor e vencimento se refazem quando o frete ou as datas da viagem mudam.
--   Antes da viagem acontecer, o vencimento usa a data prevista; depois, a saída/entrega reais.
--
-- Pagamentos (criados sozinhos)
--   abastecimento/despesa — pix_empresa e a_prazo: a pagar; proprio_bolso: a pagar ao motorista
--                           (reembolso); cartao_empresa: já pago na data; adiantamento: não gera
--                           (o dinheiro saiu no adiantamento).
--   adiantamento          — o adiantamento ao motorista da viagem: pago na saída da viagem.
--   pago_em/recebido_em só o gestor marca (RLS: só gestor acessa estas tabelas).

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.recebimentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  viagem_id uuid not null,
  complemento_id uuid references public.complementos (id) on delete cascade,
  origem text not null check (origem in ('frete', 'complemento')),
  ordem integer not null default 1,
  descricao text not null,
  percentual numeric(5,2),
  base text not null default 'entrega' check (base in ('saida', 'entrega')),
  dias integer not null default 0 check (dias >= 0),
  tipo_dias text not null default 'corridos' check (tipo_dias in ('corridos', 'uteis')),
  dia_semana smallint check (dia_semana between 0 and 6),
  valor numeric(12,2) not null check (valor >= 0),
  vencimento date,
  recebido_em date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, viagem_id) references public.viagens (tenant_id, id) on delete cascade
);
create unique index recebimentos_parcela_unica on public.recebimentos (viagem_id, ordem) where origem = 'frete';
create unique index recebimentos_complemento_unico on public.recebimentos (complemento_id) where complemento_id is not null;
create index recebimentos_pendentes_idx on public.recebimentos (tenant_id, vencimento) where recebido_em is null;

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  viagem_id uuid,
  abastecimento_id uuid references public.abastecimentos (id) on delete cascade,
  despesa_id uuid references public.despesas (id) on delete cascade,
  origem text not null check (origem in ('abastecimento', 'despesa', 'adiantamento')),
  descricao text not null,
  favorecido text,
  forma text,
  chave_pix text,
  valor numeric(12,2) not null check (valor >= 0),
  vencimento date,
  pago_em date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, viagem_id) references public.viagens (tenant_id, id) on delete cascade
);
create unique index pagamentos_abastecimento_unico on public.pagamentos (abastecimento_id) where abastecimento_id is not null;
create unique index pagamentos_despesa_unico on public.pagamentos (despesa_id) where despesa_id is not null;
create unique index pagamentos_adiantamento_unico on public.pagamentos (viagem_id) where origem = 'adiantamento';
create index pagamentos_pendentes_idx on public.pagamentos (tenant_id, vencimento) where pago_em is null;

do $$
declare
  t text;
begin
  foreach t in array array['recebimentos', 'pagamentos']
  loop
    execute format('create trigger tocar_atualizado_em before update on public.%I for each row execute function app.tocar_atualizado_em()', t);
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

-- ---------------------------------------------------------------------------
-- Datas
-- ---------------------------------------------------------------------------
create function app.dia_local(p timestamptz) returns date
language sql immutable set search_path = '' as $$
  select (p at time zone 'America/Sao_Paulo')::date
$$;

-- Base + prazo (corridos ou úteis = segunda a sexta), empurrado para o dia da semana do cliente
create function app.vencimento_da_regra(p_base date, p_dias integer, p_tipo text, p_dia_semana smallint)
returns date language plpgsql immutable set search_path = '' as $$
declare
  d date := p_base;
  faltam integer := p_dias;
begin
  if d is null then
    return null;
  end if;
  if p_tipo = 'uteis' then
    while faltam > 0 loop
      d := d + 1;
      if extract(isodow from d) < 6 then
        faltam := faltam - 1;
      end if;
    end loop;
  else
    d := d + p_dias;
  end if;
  if p_dia_semana is not null then
    while extract(dow from d) <> p_dia_semana loop
      d := d + 1;
    end loop;
  end if;
  return d;
end;
$$;

-- Data de partida da regra: saída/entrega reais; antes disso, a data prevista
create function app.base_da_viagem(v public.viagens, p_base text) returns date
language sql stable set search_path = '' as $$
  select case
    when p_base = 'saida' then coalesce(app.dia_local(v.iniciada_em), v.data_prevista)
    else coalesce(app.dia_local(v.data_hora_chegada), v.data_prevista)
  end
$$;

-- ---------------------------------------------------------------------------
-- Recebimentos do frete
-- ---------------------------------------------------------------------------
-- Valor que as parcelas do frete cobrem: frete total sem os complementos (eles têm o próprio)
create function app.frete_das_parcelas(p_viagem_id uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select v.valor_frete_total - coalesce(
    (select sum(c.valor) from public.complementos c where c.viagem_id = v.id and c.tipo = 'complemento'), 0)
  from public.viagens v where v.id = p_viagem_id
$$;

-- Refaz valor e vencimento do que ainda não foi recebido (a última parcela fica com os centavos)
create function app.recalcular_recebimentos(p_viagem_id uuid) returns void
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
  where r.viagem_id = p_viagem_id and r.origem = 'frete' and r.recebido_em is null and r.ordem <> v_ultima;

  select coalesce(sum(case when r.recebido_em is null then round(v_total * r.percentual / 100, 2) else r.valor end), 0)
    into v_outras
  from public.recebimentos r
  where r.viagem_id = p_viagem_id and r.origem = 'frete' and r.ordem <> v_ultima;
  update public.recebimentos r
  set valor = greatest(v_total - v_outras, 0)
  where r.viagem_id = p_viagem_id and r.origem = 'frete' and r.recebido_em is null and r.ordem = v_ultima;

  update public.recebimentos r
  set vencimento = app.vencimento_da_regra(app.base_da_viagem(v, r.base), r.dias, r.tipo_dias, r.dia_semana)
  where r.viagem_id = p_viagem_id and r.recebido_em is null;
end;
$$;

-- Botão "Gerar recebimentos": cria as parcelas da forma de recebimento da viagem. Gerar de
-- novo troca as parcelas ainda não recebidas (as recebidas ficam).
create function public.gerar_recebimentos(p_viagem_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.viagens%rowtype;
  f public.formas_recebimento%rowtype;
  p jsonb;
  i integer := 0;
  n integer;
begin
  if not app.eh_gestor() then
    raise exception 'Apenas o gestor gera recebimentos' using errcode = '42501';
  end if;
  select * into v from public.viagens where id = p_viagem_id and tenant_id = app.tenant_id();
  if v.id is null then
    raise exception 'Viagem não encontrada' using errcode = 'P0002';
  end if;
  if v.forma_recebimento_id is null then
    raise exception 'Escolha a forma de recebimento da viagem antes de gerar' using errcode = '22023';
  end if;
  select * into f from public.formas_recebimento where id = v.forma_recebimento_id;
  n := jsonb_array_length(f.parcelas);

  delete from public.recebimentos
  where viagem_id = p_viagem_id and origem = 'frete' and recebido_em is null;

  for p in select * from jsonb_array_elements(f.parcelas) loop
    i := i + 1;
    if exists (select 1 from public.recebimentos where viagem_id = p_viagem_id and origem = 'frete' and ordem = i) then
      continue; -- parcela já recebida
    end if;
    insert into public.recebimentos
      (tenant_id, viagem_id, origem, ordem, descricao, percentual, base, dias, tipo_dias, dia_semana, valor)
    values
      (v.tenant_id, p_viagem_id, 'frete', i,
       case when n = 1 then 'Frete' else format('Frete — parcela %s de %s', i, n) end,
       (p->>'percentual')::numeric, p->>'base', (p->>'dias')::int, p->>'tipo_dias',
       nullif(p->>'dia_semana', '')::smallint, 0);
  end loop;

  perform app.recalcular_recebimentos(p_viagem_id);
end;
$$;

revoke all on function public.gerar_recebimentos(uuid) from public, anon;
grant execute on function public.gerar_recebimentos(uuid) to authenticated;

-- Complemento lançado pelo gestor → recebimento próprio, no prazo da última parcela da forma
create function app.sincronizar_recebimento_complemento() returns trigger
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
    set valor = excluded.valor, descricao = excluded.descricao
    where public.recebimentos.recebido_em is null;

  perform app.recalcular_recebimentos(v.id);
  return null;
end;
$$;

create trigger complementos_recebimento after insert or update or delete on public.complementos
  for each row execute function app.sincronizar_recebimento_complemento();

-- ---------------------------------------------------------------------------
-- Pagamentos dos lançamentos (abastecimento e despesa)
-- ---------------------------------------------------------------------------
create function app.sincronizar_pagamento_lancamento() returns trigger
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
    return null; -- o pagamento sai junto (on delete cascade)
  end if;

  -- adiantamento: o dinheiro já saiu no adiantamento da viagem
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
      set descricao = excluded.descricao, favorecido = excluded.favorecido, forma = excluded.forma,
          chave_pix = excluded.chave_pix, valor = excluded.valor, vencimento = excluded.vencimento,
          pago_em = coalesce(public.pagamentos.pago_em, excluded.pago_em);
  else
    insert into public.pagamentos
      (tenant_id, viagem_id, despesa_id, origem, descricao, favorecido, forma, chave_pix, valor, vencimento, pago_em)
    values
      (new.tenant_id, new.viagem_id, new.id, 'despesa', v_desc, v_favorecido, new.forma_pagamento,
       new.chave_pix, v_valor, v_venc, v_pago)
    on conflict (despesa_id) where despesa_id is not null do update
      set descricao = excluded.descricao, favorecido = excluded.favorecido, forma = excluded.forma,
          chave_pix = excluded.chave_pix, valor = excluded.valor, vencimento = excluded.vencimento,
          pago_em = coalesce(public.pagamentos.pago_em, excluded.pago_em);
  end if;
  return null;
end;
$$;

create trigger abastecimentos_pagamento after insert or update on public.abastecimentos
  for each row execute function app.sincronizar_pagamento_lancamento();
create trigger despesas_pagamento after insert or update on public.despesas
  for each row execute function app.sincronizar_pagamento_lancamento();

-- ---------------------------------------------------------------------------
-- Viagem: adiantamento como pagamento (pago na saída) e recebimentos acompanhando a viagem
-- ---------------------------------------------------------------------------
create function app.viagem_financeiro() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_motorista text;
begin
  -- o frete total muda pelo trigger de antes (lançamentos), sem aparecer no SET do update:
  -- por isso o gatilho é em qualquer update e a comparação é feita aqui
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
      set favorecido = excluded.favorecido, valor = excluded.valor, vencimento = excluded.vencimento,
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

create trigger viagens_financeiro after insert or update on public.viagens
  for each row execute function app.viagem_financeiro();

-- ---------------------------------------------------------------------------
-- O "pago em" sai do lançamento: passa para o pagamento (e é migrado)
-- ---------------------------------------------------------------------------
-- dispara os triggers acima para o que já existe (cria os pagamentos)
update public.abastecimentos set forma_pagamento = forma_pagamento;
update public.despesas set forma_pagamento = forma_pagamento;
update public.viagens set valor_adiantamento = valor_adiantamento where valor_adiantamento > 0;

update public.pagamentos p set pago_em = a.pago_em
from public.abastecimentos a where p.abastecimento_id = a.id and a.pago_em is not null;
update public.pagamentos p set pago_em = d.pago_em
from public.despesas d where p.despesa_id = d.id and d.pago_em is not null;

drop trigger abastecimentos_so_gestor_marca_pago on public.abastecimentos;
drop trigger despesas_so_gestor_marca_pago on public.despesas;
drop function app.so_gestor_marca_pago();
alter table public.abastecimentos drop column pago_em;
alter table public.despesas drop column pago_em;
