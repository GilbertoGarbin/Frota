-- Clientes (embarcadores) da transportadora: cadastro simples. A viagem pode apontar para um
-- cliente cadastrado (cliente_id) ou só ter o nome digitado (cliente), para o frete avulso —
-- ex.: uma mudança de pessoa física que não vale cadastrar.
-- A condição de pagamento de cada cliente (parcelas e prazos) vem numa etapa seguinte.

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.tenant_id() references public.tenants (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  -- CPF ou CNPJ, só dígitos
  documento text check (documento is null or documento ~ '^([0-9]{11}|[0-9]{14})$'),
  telefone text,
  cidade text,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, id)
);

create unique index clientes_documento_unico on public.clientes (tenant_id, documento) where documento is not null;
create index clientes_nome_idx on public.clientes (tenant_id, lower(nome));

create trigger tocar_atualizado_em before update on public.clientes
  for each row execute function app.tocar_atualizado_em();

revoke all on table public.clientes from anon;
grant select, insert, update, delete on table public.clientes to authenticated;
grant all on table public.clientes to service_role;
alter table public.clientes enable row level security;
create policy gestor_tudo on public.clientes for all to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()))
  with check (tenant_id = (select app.tenant_id()) and (select app.eh_gestor()));

-- Viagem ↔ cliente cadastrado (opcional)
alter table public.viagens add column cliente_id uuid;
alter table public.viagens add constraint viagens_cliente_fk
  foreign key (tenant_id, cliente_id) references public.clientes (tenant_id, id);
create index viagens_cliente_idx on public.viagens (cliente_id) where cliente_id is not null;

-- Com cliente cadastrado, o nome da viagem acompanha o cadastro (o motorista e as listas
-- continuam lendo viagens.cliente, como antes).
create function app.viagem_nome_do_cliente() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.cliente_id is not null then
    select c.nome into new.cliente from public.clientes c
    where c.id = new.cliente_id and c.tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;

create trigger viagens_nome_do_cliente before insert or update of cliente_id, cliente on public.viagens
  for each row execute function app.viagem_nome_do_cliente();
