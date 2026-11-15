-- Permissões do motorista no app, por motorista (só o admin da transportadora muda):
--   pode_cadastrar_viagem: cadastrar a própria viagem no app (criar_viagem_motorista)
--   pode_carga_extra:      lançar carga extra (complementos do tipo carga_complementar)
-- Quem já existe continua podendo tudo (padrão true). O app esconde os botões; o banco recusa.

alter table public.motoristas
  add column pode_cadastrar_viagem boolean not null default true,
  add column pode_carga_extra boolean not null default true;

-- Gestor (não admin) cadastra e edita motoristas, mas não mexe nas permissões:
-- no cadastro valem as padrão; na edição ficam as que estavam.
create function app.motorista_permissoes_so_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or app.eh_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.pode_cadastrar_viagem := true;
    new.pode_carga_extra := true;
  else
    new.pode_cadastrar_viagem := old.pode_cadastrar_viagem;
    new.pode_carga_extra := old.pode_carga_extra;
  end if;
  return new;
end;
$$;

create trigger motorista_permissoes_so_admin before insert or update on public.motoristas
  for each row execute function app.motorista_permissoes_so_admin();

-- Permissão do motorista logado
create function app.motorista_pode(p_permissao text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case p_permissao
             when 'cadastrar_viagem' then m.pode_cadastrar_viagem
             when 'carga_extra' then m.pode_carga_extra
           end
    from public.motoristas m
    where m.id = app.motorista_id() and m.tenant_id = app.tenant_id()
  ), false)
$$;

-- ---------------------------------------------------------------------------
-- Cadastrar viagem: confere a permissão (reenvio da fila de uma viagem já criada passa)
-- ---------------------------------------------------------------------------
create or replace function public.criar_viagem_motorista(
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

  if exists (select 1 from public.viagens where id = p_id) then
    return; -- reenvio da fila
  end if;

  if not app.motorista_pode('cadastrar_viagem') then
    raise exception 'O admin não liberou o cadastro de viagens para você'
      using errcode = '42501';
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

-- ---------------------------------------------------------------------------
-- Carga extra: motorista só lança com permissão
-- ---------------------------------------------------------------------------
drop policy motorista_so_carga_inserir on public.complementos;
create policy motorista_so_carga_inserir on public.complementos as restrictive
  for insert to authenticated
  with check (
    (select app.eh_gestor())
    or (origem_lancamento = 'motorista' and tipo = 'carga_complementar' and (select app.motorista_pode('carga_extra')))
  );

revoke all on function app.motorista_pode(text) from public;
grant execute on function app.motorista_pode(text) to authenticated;
