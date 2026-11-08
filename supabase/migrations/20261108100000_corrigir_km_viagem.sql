-- Frota — corrigir o km de uma viagem
--
-- O gestor pode corrigir km inicial/final de uma viagem iniciada ou finalizada (odômetro digitado
-- errado). O combustível já se refazia (trigger viagem_recalcular). Faltava o km atual do caminhão:
-- ele só subia ("km_atual < km_final"), então um km final digitado a mais ficava no caminhão para
-- sempre (e disparava alerta de manutenção vencida).
--
-- Agora, quando o km final de uma viagem finalizada diminui e o km atual do caminhão era
-- justamente o km errado dela, o km atual volta para o maior km conhecido do caminhão:
-- km final das viagens finalizadas, km dos abastecimentos e das manutenções.

create or replace function app.viagem_recalcular() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'programada' then
    return null;
  end if;

  if tg_op <> 'DELETE' and new.status = 'finalizada' then
    update public.veiculos
    set km_atual = new.km_final
    where id = new.veiculo_id and km_atual < new.km_final;
  end if;

  -- km final corrigido para menos: o caminhão não pode ficar com o km errado
  if tg_op = 'UPDATE' and old.status = 'finalizada' and old.km_final is not null
     and (new.km_final is distinct from old.km_final or new.veiculo_id is distinct from old.veiculo_id) then
    update public.veiculos ve
    set km_atual = greatest(
      coalesce((select max(x.km_final) from public.viagens x
                where x.veiculo_id = ve.id and x.status = 'finalizada'), 0),
      coalesce((select max(a.km) from public.abastecimentos a where a.veiculo_id = ve.id), 0),
      coalesce((select max(m.km) from public.manutencoes m where m.veiculo_id = ve.id), 0)
    )
    where ve.id = old.veiculo_id and ve.km_atual = old.km_final;
  end if;

  if tg_op <> 'INSERT' then
    perform app.recalcular_combustivel(old.veiculo_id);
  end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.veiculo_id is distinct from old.veiculo_id) then
    perform app.recalcular_combustivel(new.veiculo_id);
  end if;
  return null;
end;
$$;
