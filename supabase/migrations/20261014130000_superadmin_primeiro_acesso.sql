-- Super admin também pode receber uma senha temporária: no primeiro login é obrigado a trocar,
-- como os usuários das transportadoras (usuarios.primeiro_acesso).

alter table public.plataforma_admins
  add column primeiro_acesso boolean not null default false;

-- Uma linha se o usuário logado é super admin; nenhuma se não é.
-- (sou_superadmin() continua para as versões anteriores do app.)
create function public.minha_plataforma()
returns table (primeiro_acesso boolean)
language sql stable security definer set search_path = '' as $$
  select p.primeiro_acesso from public.plataforma_admins p where p.usuario_id = auth.uid()
$$;

revoke execute on function public.minha_plataforma() from public, anon;
grant execute on function public.minha_plataforma() to authenticated;

-- Depois de trocar a senha temporária (supabase.auth.updateUser) o app chama esta
create or replace function public.concluir_primeiro_acesso() returns void
language sql security definer set search_path = '' as $$
  update public.usuarios set primeiro_acesso = false, atualizado_em = now()
  where id = auth.uid();
  update public.plataforma_admins set primeiro_acesso = false
  where usuario_id = auth.uid();
$$;
