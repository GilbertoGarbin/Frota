-- Completa o financeiro para o que já existia antes das tabelas de contas: o gatilho da viagem
-- ignora gravação sem mudança, então o adiantamento antigo e os complementos são criados aqui.
insert into public.pagamentos (tenant_id, viagem_id, origem, descricao, favorecido, forma, valor, vencimento, pago_em)
select v.tenant_id, v.id, 'adiantamento', 'Adiantamento ao motorista', m.nome, 'adiantamento', v.valor_adiantamento,
       coalesce(app.dia_local(v.iniciada_em), v.data_prevista), app.dia_local(v.iniciada_em)
from public.viagens v
join public.motoristas m on m.id = v.motorista_id
where v.valor_adiantamento > 0
  and not exists (select 1 from public.pagamentos p where p.viagem_id = v.id and p.origem = 'adiantamento');

update public.complementos set valor = valor where tipo = 'complemento';
