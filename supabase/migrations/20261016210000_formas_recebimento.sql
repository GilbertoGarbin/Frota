-- Formas de recebimento do frete (como o cliente paga a transportadora): cadastradas uma vez
-- e usadas por clientes e viagens. Cada forma tem parcelas:
--   percentual  — parte do frete total (as parcelas somam 100)
--   base        — 'saida' (início da viagem) ou 'entrega' (fim da viagem)
--   dias        — prazo a partir da base
--   tipo_dias   — 'corridos' ou 'uteis' (segunda a sexta)
--   dia_semana  — se o cliente só paga num dia da semana (0 = domingo … 6 = sábado), o
--                 vencimento vai para esse dia seguinte; null = qualquer dia
-- Ex.: 70% na saída + 30% com 10 dias corridos após a entrega.
-- O cálculo dos vencimentos e a lista "A receber" vêm numa etapa seguinte.

create table public.formas_recebimento (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.tenant_id() references public.tenants (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  parcelas jsonb not null,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, id)
);

create unique index formas_recebimento_nome_unico on public.formas_recebimento (tenant_id, lower(trim(nome)));

-- Confere as parcelas: formato, valores e soma de 100%
create function app.validar_parcelas_recebimento() returns trigger
language plpgsql set search_path = '' as $$
declare
  p jsonb;
  v_soma numeric := 0;
begin
  if jsonb_typeof(new.parcelas) <> 'array' or jsonb_array_length(new.parcelas) = 0 then
    raise exception 'Informe ao menos uma parcela' using errcode = '22023';
  end if;
  for p in select * from jsonb_array_elements(new.parcelas) loop
    if (p->>'percentual') is null or (p->>'percentual')::numeric <= 0 or (p->>'percentual')::numeric > 100 then
      raise exception 'Percentual da parcela deve ser maior que 0 e até 100' using errcode = '22023';
    end if;
    if coalesce(p->>'base', '') not in ('saida', 'entrega') then
      raise exception 'Parcela sem "a partir de" (saída ou entrega)' using errcode = '22023';
    end if;
    if (p->>'dias') is null or (p->>'dias')::int < 0 then
      raise exception 'Prazo da parcela inválido' using errcode = '22023';
    end if;
    if coalesce(p->>'tipo_dias', '') not in ('corridos', 'uteis') then
      raise exception 'Prazo deve ser em dias corridos ou úteis' using errcode = '22023';
    end if;
    if p ? 'dia_semana' and jsonb_typeof(p->'dia_semana') <> 'null'
       and ((p->>'dia_semana')::int < 0 or (p->>'dia_semana')::int > 6) then
      raise exception 'Dia da semana inválido' using errcode = '22023';
    end if;
    v_soma := v_soma + (p->>'percentual')::numeric;
  end loop;
  if v_soma <> 100 then
    raise exception 'As parcelas devem somar 100%% (somam %)', v_soma || '%' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger formas_recebimento_validar before insert or update on public.formas_recebimento
  for each row execute function app.validar_parcelas_recebimento();
create trigger tocar_atualizado_em before update on public.formas_recebimento
  for each row execute function app.tocar_atualizado_em();

revoke all on table public.formas_recebimento from anon;
grant select, insert, update, delete on table public.formas_recebimento to authenticated;
grant all on table public.formas_recebimento to service_role;
alter table public.formas_recebimento enable row level security;
create policy gestor_tudo on public.formas_recebimento for all to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()))
  with check (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()));

-- Forma padrão do cliente e forma da viagem
alter table public.clientes add column forma_recebimento_id uuid;
alter table public.clientes add constraint clientes_forma_recebimento_fk
  foreign key (tenant_id, forma_recebimento_id) references public.formas_recebimento (tenant_id, id);

alter table public.viagens add column forma_recebimento_id uuid;
alter table public.viagens add constraint viagens_forma_recebimento_fk
  foreign key (tenant_id, forma_recebimento_id) references public.formas_recebimento (tenant_id, id);

-- Viagem: nome do cliente cadastrado, forma padrão do cliente quando nenhuma foi escolhida, e o
-- nome da forma em forma_pagamento_frete (é o texto que o motorista vê no app).
create or replace function app.viagem_nome_do_cliente() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.cliente_id is not null then
    select c.nome, coalesce(new.forma_recebimento_id, c.forma_recebimento_id)
      into new.cliente, new.forma_recebimento_id
    from public.clientes c
    where c.id = new.cliente_id and c.tenant_id = new.tenant_id;
  end if;
  if new.forma_recebimento_id is not null then
    select f.nome into new.forma_pagamento_frete from public.formas_recebimento f
    where f.id = new.forma_recebimento_id and f.tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;

drop trigger viagens_nome_do_cliente on public.viagens;
create trigger viagens_nome_do_cliente
  before insert or update of cliente_id, cliente, forma_recebimento_id, forma_pagamento_frete on public.viagens
  for each row execute function app.viagem_nome_do_cliente();
