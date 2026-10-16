-- Complemento de frete precisa dizer de onde para onde e o que está levando.
alter table public.complementos add constraint complementos_complemento_descrito
  check (tipo <> 'complemento' or length(trim(coalesce(descricao, ''))) > 0);
