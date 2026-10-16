-- Pagamento direto ao posto (como as transportadoras fazem na estrada):
--   pix_empresa — o motorista abastece, passa a chave PIX do posto e a empresa paga na hora;
--   a_prazo     — o motorista assina a nota e a empresa paga até o vencimento.
-- Nos dois casos o dinheiro não sai do adiantamento nem do bolso do motorista: os totais da
-- viagem (gasto do adiantamento, próprio bolso) continuam olhando só as formas antigas.
-- pago_em marca quando a empresa quitou; só o gestor preenche.

do $$
declare
  t text;
begin
  foreach t in array array['abastecimentos', 'despesas']
  loop
    execute format('alter table public.%I drop constraint %I', t, t || '_forma_pagamento_check');
    execute format($f$
      alter table public.%I add constraint %I check (
        forma_pagamento in ('adiantamento', 'cartao_empresa', 'proprio_bolso', 'pix_empresa', 'a_prazo')
      )
    $f$, t, t || '_forma_pagamento_check');
    execute format('alter table public.%I add column chave_pix text', t);
    execute format('alter table public.%I add column vencimento date', t);
    execute format('alter table public.%I add column pago_em date', t);
    execute format($f$
      create index %I on public.%I (tenant_id) where forma_pagamento in ('pix_empresa', 'a_prazo') and pago_em is null
    $f$, t || '_a_pagar_idx', t);
  end loop;
end;
$$;

-- O motorista informa chave PIX e vencimento, mas não marca como pago.
create function app.so_gestor_marca_pago() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not app.eh_gestor() then
    if tg_op = 'INSERT' then
      new.pago_em := null;
    else
      new.pago_em := old.pago_em;
    end if;
  end if;
  return new;
end;
$$;

create trigger abastecimentos_so_gestor_marca_pago
  before insert or update on public.abastecimentos
  for each row execute function app.so_gestor_marca_pago();
create trigger despesas_so_gestor_marca_pago
  before insert or update on public.despesas
  for each row execute function app.so_gestor_marca_pago();
