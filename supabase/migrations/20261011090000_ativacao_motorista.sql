-- Frota — acesso: perfil do usuário logado e ativação do aparelho do motorista
--
-- Fluxo do motorista (decisao_stack_infra.md §2.4):
--   1. Gestor gera um código de ativação (6 dígitos, vale 48 h, uso único).
--   2. O app do motorista abre uma sessão anônima do Supabase Auth (sem e-mail/senha) e
--      chama ativar_aparelho(cpf, código). Se conferir, essa sessão passa a ser o login
--      daquele motorista naquele aparelho — é a "sessão de longa duração".
--   3. O PIN é só desbloqueio local do app; nunca chega ao servidor.
--   4. Revogar = desativar a linha em usuarios. Ativar outro aparelho desativa o anterior.

-- ---------------------------------------------------------------------------
-- Códigos de ativação pendentes. Só o hash é guardado.
-- Sem políticas RLS: ninguém lê nem grava direto, só as funções abaixo.
-- ---------------------------------------------------------------------------
create table public.ativacoes_motorista (
  motorista_id uuid primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  codigo_hash bytea not null,
  expira_em timestamptz not null,
  tentativas smallint not null default 0,
  criado_em timestamptz not null default now(),
  foreign key (tenant_id, motorista_id) references public.motoristas (tenant_id, id) on delete cascade
);

alter table public.ativacoes_motorista enable row level security;
revoke all on table public.ativacoes_motorista from anon, authenticated;
grant all on table public.ativacoes_motorista to service_role;

create function app.hash_codigo(p_motorista_id uuid, p_codigo text) returns bytea
language sql immutable set search_path = '' as $$
  select sha256(convert_to(p_motorista_id::text || ':' || p_codigo, 'UTF8'))
$$;

-- Sessão anônima (aparelho de motorista), em oposição a login com e-mail e senha
create function app.usuario_anonimo() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

revoke all on function app.hash_codigo(uuid, text), app.usuario_anonimo() from public;

-- ---------------------------------------------------------------------------
-- Quem sou eu: papel e transportadora do usuário logado.
-- Sem linhas = sem acesso (ainda não criou a transportadora, aparelho revogado, motorista inativo).
-- ---------------------------------------------------------------------------
create function public.meu_acesso()
returns table (papel text, tenant_id uuid, tenant_nome text, nome text, motorista_id uuid)
language sql stable security definer set search_path = '' as $$
  select u.papel, u.tenant_id, t.nome, coalesce(m.nome, u.nome), u.motorista_id
  from public.usuarios u
  join public.tenants t on t.id = u.tenant_id
  left join public.motoristas m on m.id = u.motorista_id
  where u.id = auth.uid()
    and u.tenant_id = app.tenant_id()
$$;

-- ---------------------------------------------------------------------------
-- Gestor: gera (ou regenera) o código de ativação. O código só é mostrado aqui.
-- ---------------------------------------------------------------------------
create function public.gerar_codigo_ativacao(p_motorista_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := app.tenant_id();
  v_codigo text;
begin
  if v_tenant is null or not app.eh_gestor() then
    raise exception 'Apenas o gestor pode gerar o código de ativação' using errcode = '42501';
  end if;
  if not exists (select 1 from public.motoristas m
                 where m.id = p_motorista_id and m.tenant_id = v_tenant and m.status = 'ativo') then
    raise exception 'Motorista não encontrado ou inativo' using errcode = 'P0002';
  end if;

  -- 6 dígitos a partir de bytes aleatórios seguros (gen_random_uuid)
  v_codigo := lpad(
    ((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text,
    6, '0');

  insert into public.ativacoes_motorista (motorista_id, tenant_id, codigo_hash, expira_em, tentativas)
  values (p_motorista_id, v_tenant, app.hash_codigo(p_motorista_id, v_codigo),
          now() + interval '48 hours', 0)
  on conflict (motorista_id) do update
    set codigo_hash = excluded.codigo_hash,
        expira_em = excluded.expira_em,
        tentativas = 0,
        criado_em = now();

  return v_codigo;
end;
$$;

-- ---------------------------------------------------------------------------
-- Motorista: ativa este aparelho com CPF + código.
-- Devolve false quando não confere (em vez de erro, para a tentativa ficar registrada).
-- Depois de 5 tentativas erradas o código trava e o gestor precisa gerar outro.
-- ---------------------------------------------------------------------------
create function public.ativar_aparelho(p_cpf text, p_codigo text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_codigo text := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
  v_motorista public.motoristas%rowtype;
begin
  if v_uid is null then
    raise exception 'Sessão necessária' using errcode = '28000';
  end if;
  if exists (select 1 from public.usuarios u where u.id = v_uid and u.papel = 'gestor') then
    raise exception 'Esta conta é de gestor' using errcode = '42501';
  end if;

  select m.* into v_motorista
  from public.motoristas m
  join public.ativacoes_motorista a on a.motorista_id = m.id
  where m.cpf = v_cpf
    and m.status = 'ativo'
    and a.expira_em > now()
    and a.tentativas < 5
    and a.codigo_hash = app.hash_codigo(m.id, v_codigo)
  limit 1;

  if v_motorista.id is null then
    update public.ativacoes_motorista a
    set tentativas = a.tentativas + 1
    from public.motoristas m
    where m.id = a.motorista_id and m.cpf = v_cpf and a.tentativas < 5;
    return false;
  end if;

  -- Um aparelho por motorista: o anterior perde o acesso
  update public.usuarios
  set ativo = false
  where motorista_id = v_motorista.id and ativo and id <> v_uid;

  insert into public.usuarios (id, tenant_id, papel, motorista_id, nome, ativo)
  values (v_uid, v_motorista.tenant_id, 'motorista', v_motorista.id, v_motorista.nome, true)
  on conflict (id) do update
    set tenant_id = excluded.tenant_id,
        papel = 'motorista',
        motorista_id = excluded.motorista_id,
        nome = excluded.nome,
        ativo = true;

  delete from public.ativacoes_motorista where motorista_id = v_motorista.id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gestor: revoga o aparelho do motorista (e qualquer código pendente)
-- ---------------------------------------------------------------------------
create function public.revogar_aparelho(p_motorista_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := app.tenant_id();
begin
  if v_tenant is null or not app.eh_gestor() then
    raise exception 'Apenas o gestor pode revogar o aparelho' using errcode = '42501';
  end if;

  update public.usuarios
  set ativo = false
  where tenant_id = v_tenant and motorista_id = p_motorista_id and ativo;

  delete from public.ativacoes_motorista
  where tenant_id = v_tenant and motorista_id = p_motorista_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- criar_tenant: sessão anônima (aparelho de motorista) não pode criar transportadora
-- ---------------------------------------------------------------------------
create or replace function public.criar_tenant(p_nome text, p_nome_usuario text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
begin
  if v_uid is null or app.usuario_anonimo() then
    raise exception 'Entre com e-mail e senha para cadastrar a transportadora' using errcode = '28000';
  end if;
  if exists (select 1 from public.usuarios u where u.id = v_uid) then
    raise exception 'Este usuário já pertence a uma transportadora' using errcode = '23505';
  end if;

  insert into public.tenants (nome) values (p_nome) returning id into v_tenant;
  insert into public.usuarios (id, tenant_id, papel, nome)
  values (v_uid, v_tenant, 'gestor', p_nome_usuario);
  return v_tenant;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------------
revoke all on function
  public.meu_acesso(),
  public.gerar_codigo_ativacao(uuid),
  public.ativar_aparelho(text, text),
  public.revogar_aparelho(uuid)
from public, anon;

grant execute on function
  public.meu_acesso(),
  public.gerar_codigo_ativacao(uuid),
  public.ativar_aparelho(text, text),
  public.revogar_aparelho(uuid)
to authenticated, service_role;
