-- Juros/multa e desconto nas contas (Financeiro > Editar). valor_final = valor + juros - desconto
-- é o que vale nos totais e no que foi recebido/pago.
alter table public.recebimentos
  add column juros numeric(12,2) not null default 0 check (juros >= 0),
  add column desconto numeric(12,2) not null default 0 check (desconto >= 0),
  add column valor_final numeric(12,2) generated always as (valor + juros - desconto) stored;
alter table public.pagamentos
  add column juros numeric(12,2) not null default 0 check (juros >= 0),
  add column desconto numeric(12,2) not null default 0 check (desconto >= 0),
  add column valor_final numeric(12,2) generated always as (valor + juros - desconto) stored;
