-- Frota — contas: admin da empresa, super admin da plataforma, login por senha para todos
-- e assinatura por transportadora (mesmo modelo do FLUXO).
--
-- Papéis em usuarios:
--   admin     — um por transportadora (quem criou a conta). Faz tudo, inclusive cadastrar usuários.
--   gestor    — usa o painel inteiro, mas não cadastra usuários.
--   motorista — entra com CPF + senha (no app ou na web).
-- Super admin (dono do sistema) fica fora das transportadoras, na tabela plataforma_admins.
--
-- Contas de gestor e motorista são criadas pelo admin pela Edge Function gerenciar-usuario
-- (precisa da service_role para criar o login), sempre com senha temporária: no primeiro
-- login a pessoa é obrigada a trocar (usuarios.primeiro_acesso).
--
-- Assinatura (tenants.assinatura_status):
--   trial      — período de avaliação até trial_expira_em
--   ativo      — pago até pago_ate (null = sem data de fim)
--   inadimplente, cancelado, bloqueado — ver app.assinatura_liberada
--   vitalicio  — sem limite
-- Vencido o prazo, ainda há carencia_dias de tolerância. Depois disso app.tenant_id() fica
-- nulo e o RLS fecha tudo: o bloqueio vale no servidor, não só na tela.

-- ---------------------------------------------------------------------------
-- Papel admin: um por transportadora
-- ---------------------------------------------------------------------------
alter table public.usuarios drop constraint usuarios_papel_check;
alter table public.usuarios add constraint usuarios_papel_check
  check (papel in ('admin', 'gestor', 'motorista'));

-- Senha temporária: obriga a trocar no próximo login
alter table public.usuarios add column primeiro_acesso boolean not null default false;

-- O gestor mais antigo de cada transportadora vira o admin
update public.usuarios u
set papel = 'admin'
where u.papel = 'gestor'
  and u.id = (
    select g.id from public.usuarios g
    where g.tenant_id = u.tenant_id and g.papel = 'gestor'
    order by g.criado_em, g.id
    limit 1
  );

create unique index usuarios_um_admin_por_tenant on public.usuarios (tenant_id) where papel = 'admin';

-- ---------------------------------------------------------------------------
-- Assinatura da transportadora
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column assinatura_status text not null default 'trial'
    check (assinatura_status in ('trial', 'ativo', 'inadimplente', 'bloqueado', 'cancelado', 'vitalicio')),
  add column trial_expira_em timestamptz,
  add column pago_ate timestamptz,
  add column carencia_dias integer not null default 10 check (carencia_dias >= 0);

-- Transportadoras que já existiam foram criadas antes da cobrança: ficam vitalícias.
-- O super admin pode mudar isso pela tela da plataforma.
update public.tenants set assinatura_status = 'vitalicio';

-- Só o nome da transportadora é alterável pelo app; assinatura, só pelas funções abaixo
revoke update on table public.tenants from authenticated;
grant update (nome, atualizado_em) on table public.tenants to authenticated;

-- Data até quando a assinatura vale (sem contar a carência). Nulo = sem limite.
create function app.limite_assinatura(p_status text, p_trial_expira_em timestamptz, p_pago_ate timestamptz)
returns timestamptz
language sql immutable set search_path = '' as $$
  select case p_status
    when 'trial' then p_trial_expira_em
    when 'ativo' then p_pago_ate
    when 'inadimplente' then p_pago_ate
    else null
  end
$$;

create function app.assinatura_liberada(
  p_status text, p_trial_expira_em timestamptz, p_pago_ate timestamptz, p_carencia_dias integer
) returns boolean
language sql stable set search_path = '' as $$
  select case
    when p_status = 'vitalicio' then true
    when p_status in ('bloqueado', 'cancelado') then false
    else coalesce(
      now() < app.limite_assinatura(p_status, p_trial_expira_em, p_pago_ate)
              + make_interval(days => p_carencia_dias),
      true)
  end
$$;

-- Dias (arredondados para cima) entre agora e uma data; nunca negativo
create function app.dias_ate(p_data timestamptz) returns integer
language sql stable set search_path = '' as $$
  select greatest(0, ceil(extract(epoch from (p_data - now())) / 86400))::integer
$$;

-- ---------------------------------------------------------------------------
-- Identidade: admin conta como gestor; transportadora bloqueada perde o acesso
-- ---------------------------------------------------------------------------
create or replace function app.tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select u.tenant_id
  from public.usuarios u
  join public.tenants t on t.id = u.tenant_id
  left join public.motoristas m on m.id = u.motorista_id
  where u.id = auth.uid()
    and u.ativo
    and (u.papel in ('admin', 'gestor') or m.status = 'ativo')
    and app.assinatura_liberada(t.assinatura_status, t.trial_expira_em, t.pago_ate, t.carencia_dias)
$$;

create or replace function app.eh_gestor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.papel() in ('admin', 'gestor'), false)
$$;

create function app.eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.papel() = 'admin', false)
$$;

-- ---------------------------------------------------------------------------
-- Super admin da plataforma (dono do sistema). Fora de qualquer transportadora,
-- por isso esta é a única tabela sem tenant_id. Ninguém lê nem grava pela API:
-- só as funções security definer abaixo.
-- Para tornar alguém super admin (SQL Editor do Supabase):
--   insert into public.plataforma_admins (usuario_id)
--   select id from auth.users where email = 'seu@email.com';
-- ---------------------------------------------------------------------------
create table public.plataforma_admins (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.plataforma_admins enable row level security;
revoke all on table public.plataforma_admins from anon, authenticated;
grant all on table public.plataforma_admins to service_role;

create function app.eh_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plataforma_admins p where p.usuario_id = auth.uid())
$$;

grant execute on function
  app.eh_admin(),
  app.eh_superadmin(),
  app.limite_assinatura(text, timestamptz, timestamptz),
  app.assinatura_liberada(text, timestamptz, timestamptz, integer),
  app.dias_ate(timestamptz)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Cadastro pelo site: quem cria a transportadora vira o admin dela, com período de avaliação
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
  if app.eh_superadmin() then
    raise exception 'A conta da plataforma não pertence a uma transportadora' using errcode = '42501';
  end if;

  insert into public.tenants (nome, assinatura_status, trial_expira_em)
  values (p_nome, 'trial', now() + interval '30 days')
  returning id into v_tenant;
  insert into public.usuarios (id, tenant_id, papel, nome)
  values (v_uid, v_tenant, 'admin', p_nome_usuario);
  return v_tenant;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quem sou eu. Devolve a linha mesmo com a assinatura vencida, para o app mostrar o aviso
-- (o resto do banco já está fechado por app.tenant_id()).
-- ---------------------------------------------------------------------------
drop function public.meu_acesso();
create function public.meu_acesso()
returns table (
  papel text,
  tenant_id uuid,
  tenant_nome text,
  nome text,
  motorista_id uuid,
  primeiro_acesso boolean,
  assinatura_status text,
  assinatura_liberada boolean,
  -- -1 = sem limite; 0 = vencida
  assinatura_dias_restantes integer,
  assinatura_em_carencia boolean,
  assinatura_dias_carencia integer
)
language sql stable security definer set search_path = '' as $$
  select
    u.papel, u.tenant_id, t.nome, coalesce(m.nome, u.nome), u.motorista_id, u.primeiro_acesso,
    t.assinatura_status,
    app.assinatura_liberada(t.assinatura_status, t.trial_expira_em, t.pago_ate, t.carencia_dias),
    case when lim.limite is null then -1 else app.dias_ate(lim.limite) end,
    coalesce(lim.limite <= now(), false)
      and app.assinatura_liberada(t.assinatura_status, t.trial_expira_em, t.pago_ate, t.carencia_dias),
    case when lim.limite is null then 0
         else app.dias_ate(lim.limite + make_interval(days => t.carencia_dias)) end
  from public.usuarios u
  join public.tenants t on t.id = u.tenant_id
  left join public.motoristas m on m.id = u.motorista_id
  cross join lateral (
    select app.limite_assinatura(t.assinatura_status, t.trial_expira_em, t.pago_ate) as limite
  ) lim
  where u.id = auth.uid()
    and u.ativo
    and (u.papel <> 'motorista' or m.status = 'ativo')
$$;

create function public.sou_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.eh_superadmin()
$$;

-- Depois de trocar a senha temporária (supabase.auth.updateUser) o app chama esta
create function public.concluir_primeiro_acesso() returns void
language sql security definer set search_path = '' as $$
  update public.usuarios set primeiro_acesso = false, atualizado_em = now()
  where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Admin da transportadora: usuários da empresa
-- ---------------------------------------------------------------------------
create function public.usuarios_da_empresa()
returns table (
  id uuid,
  nome text,
  papel text,
  -- e-mail (admin e gestor) ou CPF (motorista)
  login text,
  motorista_id uuid,
  ativo boolean,
  primeiro_acesso boolean,
  ultimo_login timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.eh_admin() then
    raise exception 'Apenas o admin da transportadora gerencia usuários' using errcode = '42501';
  end if;
  return query
    select u.id, coalesce(m.nome, u.nome), u.papel,
           case when u.papel = 'motorista' then m.cpf else au.email end,
           u.motorista_id, u.ativo, u.primeiro_acesso, au.last_sign_in_at
    from public.usuarios u
    join auth.users au on au.id = u.id
    left join public.motoristas m on m.id = u.motorista_id
    where u.tenant_id = app.tenant_id()
      -- aparelhos ativados pelo código antigo (sessão anônima) não contam como login:
      -- o motorista aparece como "sem acesso" e o admin cria o login com CPF e senha
      and not coalesce(au.is_anonymous, false)
    order by case u.papel when 'admin' then 0 when 'gestor' then 1 else 2 end, 2;
end;
$$;

-- Liga/desliga o acesso de um gestor ou motorista da própria transportadora
create function public.definir_acesso_usuario(p_usuario_id uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_alvo public.usuarios%rowtype;
begin
  if not app.eh_admin() then
    raise exception 'Apenas o admin da transportadora gerencia usuários' using errcode = '42501';
  end if;
  select * into v_alvo from public.usuarios u where u.id = p_usuario_id and u.tenant_id = app.tenant_id();
  if v_alvo.id is null then
    raise exception 'Usuário não encontrado' using errcode = 'P0002';
  end if;
  if v_alvo.papel = 'admin' then
    raise exception 'O acesso do admin não pode ser desligado' using errcode = '42501';
  end if;
  if p_ativo and v_alvo.motorista_id is not null then
    -- um acesso ativo por motorista: religar este desliga qualquer outro
    update public.usuarios set ativo = false
    where motorista_id = v_alvo.motorista_id and id <> v_alvo.id and ativo;
  end if;
  update public.usuarios set ativo = p_ativo, atualizado_em = now() where id = v_alvo.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Super admin: todas as transportadoras, usuários e assinatura
-- ---------------------------------------------------------------------------
create function public.plataforma_empresas()
returns table (
  tenant_id uuid,
  nome text,
  criado_em timestamptz,
  assinatura_status text,
  trial_expira_em timestamptz,
  pago_ate timestamptz,
  assinatura_liberada boolean,
  assinatura_dias_restantes integer,
  qtd_usuarios integer,
  qtd_motoristas integer,
  qtd_veiculos integer,
  admin_id uuid,
  admin_nome text,
  admin_email text,
  admin_ultimo_login timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.eh_superadmin() then
    raise exception 'Apenas o administrador da plataforma' using errcode = '42501';
  end if;
  return query
    select t.id, t.nome, t.criado_em, t.assinatura_status, t.trial_expira_em, t.pago_ate,
           app.assinatura_liberada(t.assinatura_status, t.trial_expira_em, t.pago_ate, t.carencia_dias),
           case when lim.limite is null then -1 else app.dias_ate(lim.limite) end,
           (select count(*)::integer from public.usuarios u where u.tenant_id = t.id and u.ativo),
           (select count(*)::integer from public.motoristas m where m.tenant_id = t.id and m.status = 'ativo'),
           (select count(*)::integer from public.veiculos v where v.tenant_id = t.id and v.status <> 'inativo'),
           a.id, a.nome, au.email, au.last_sign_in_at
    from public.tenants t
    cross join lateral (
      select app.limite_assinatura(t.assinatura_status, t.trial_expira_em, t.pago_ate) as limite
    ) lim
    left join public.usuarios a on a.tenant_id = t.id and a.papel = 'admin'
    left join auth.users au on au.id = a.id
    order by t.criado_em desc;
end;
$$;

create function public.plataforma_usuarios(p_tenant_id uuid)
returns table (
  id uuid,
  nome text,
  papel text,
  login text,
  ativo boolean,
  primeiro_acesso boolean,
  ultimo_login timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.eh_superadmin() then
    raise exception 'Apenas o administrador da plataforma' using errcode = '42501';
  end if;
  return query
    select u.id, coalesce(m.nome, u.nome), u.papel,
           case when u.papel = 'motorista' then m.cpf else au.email end,
           u.ativo, u.primeiro_acesso, au.last_sign_in_at
    from public.usuarios u
    join auth.users au on au.id = u.id
    left join public.motoristas m on m.id = u.motorista_id
    where u.tenant_id = p_tenant_id
      and not coalesce(au.is_anonymous, false)
    order by case u.papel when 'admin' then 0 when 'gestor' then 1 else 2 end, 2;
end;
$$;

-- p_acao: 'ativar' (soma p_dias a partir de hoje ou do fim do período pago), 'vitalicio', 'bloquear'
create function public.plataforma_assinatura(p_tenant_id uuid, p_acao text, p_dias integer default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.eh_superadmin() then
    raise exception 'Apenas o administrador da plataforma' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants t where t.id = p_tenant_id) then
    raise exception 'Transportadora não encontrada' using errcode = 'P0002';
  end if;

  if p_acao = 'ativar' then
    if p_dias is null or p_dias <= 0 then
      raise exception 'Informe os dias de assinatura' using errcode = '22023';
    end if;
    update public.tenants t
    set assinatura_status = 'ativo',
        pago_ate = greatest(
          now(),
          case when t.assinatura_status in ('ativo', 'inadimplente') then coalesce(t.pago_ate, now()) else now() end
        ) + make_interval(days => p_dias),
        atualizado_em = now()
    where t.id = p_tenant_id;
  elsif p_acao = 'vitalicio' then
    update public.tenants
    set assinatura_status = 'vitalicio', pago_ate = null, atualizado_em = now()
    where id = p_tenant_id;
  elsif p_acao = 'bloquear' then
    update public.tenants set assinatura_status = 'bloqueado', atualizado_em = now()
    where id = p_tenant_id;
  else
    raise exception 'Ação inválida: %', p_acao using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------------
revoke all on function
  public.meu_acesso(),
  public.sou_superadmin(),
  public.concluir_primeiro_acesso(),
  public.usuarios_da_empresa(),
  public.definir_acesso_usuario(uuid, boolean),
  public.plataforma_empresas(),
  public.plataforma_usuarios(uuid),
  public.plataforma_assinatura(uuid, text, integer)
from public, anon;

grant execute on function
  public.meu_acesso(),
  public.sou_superadmin(),
  public.concluir_primeiro_acesso(),
  public.usuarios_da_empresa(),
  public.definir_acesso_usuario(uuid, boolean),
  public.plataforma_empresas(),
  public.plataforma_usuarios(uuid),
  public.plataforma_assinatura(uuid, text, integer)
to authenticated, service_role;
