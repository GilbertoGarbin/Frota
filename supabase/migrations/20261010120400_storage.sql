-- Frota — armazenamento de comprovantes e documentos
-- Bucket privado. Caminho do arquivo: {tenant_id}/{viagem_id}/{uuid}.{ext}
-- (a primeira pasta isola o tenant; a segunda permite limitar o motorista às viagens dele)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprovantes', 'comprovantes', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Converte texto em uuid sem estourar erro quando o caminho é inválido
create function app.uuid_ou_nulo(p_texto text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p_texto::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function app.uuid_ou_nulo(text) from public;
grant execute on function app.uuid_ou_nulo(text) to authenticated, service_role;

create policy comprovantes_ler on storage.objects for select to authenticated
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = (select app.tenant_id())::text
    and (
      (select app.eh_gestor())
      or app.viagem_do_motorista(app.uuid_ou_nulo((storage.foldername(name))[2]))
    )
  );

create policy comprovantes_enviar on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = (select app.tenant_id())::text
    and (
      (select app.eh_gestor())
      or app.viagem_aberta_do_motorista(app.uuid_ou_nulo((storage.foldername(name))[2]))
    )
  );

create policy comprovantes_gestor_excluir on storage.objects for delete to authenticated
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = (select app.tenant_id())::text
    and (select app.eh_gestor())
  );
