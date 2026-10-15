-- No Supabase, auth.users.email é varchar(255): as funções que devolvem o e-mail como text
-- davam "structure of query does not match function result type" (tela Usuários do admin e
-- tela da plataforma vazias). Mesmo código de contas_e_assinatura, com o e-mail convertido.

create or replace function public.usuarios_da_empresa()
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
           case when u.papel = 'motorista' then m.cpf::text else au.email::text end,
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

create or replace function public.plataforma_empresas()
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
           a.id, a.nome, au.email::text, au.last_sign_in_at
    from public.tenants t
    cross join lateral (
      select app.limite_assinatura(t.assinatura_status, t.trial_expira_em, t.pago_ate) as limite
    ) lim
    left join public.usuarios a on a.tenant_id = t.id and a.papel = 'admin'
    left join auth.users au on au.id = a.id
    order by t.criado_em desc;
end;
$$;

create or replace function public.plataforma_usuarios(p_tenant_id uuid)
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
           case when u.papel = 'motorista' then m.cpf::text else au.email::text end,
           u.ativo, u.primeiro_acesso, au.last_sign_in_at
    from public.usuarios u
    join auth.users au on au.id = u.id
    left join public.motoristas m on m.id = u.motorista_id
    where u.tenant_id = p_tenant_id
      and not coalesce(au.is_anonymous, false)
    order by case u.papel when 'admin' then 0 when 'gestor' then 1 else 2 end, 2;
end;
$$;
