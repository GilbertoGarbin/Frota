-- Novo tipo de valor adicional lançado pelo gestor: "complemento" (complemento de frete
-- combinado com o cliente). Soma ao frete total e à base da comissão, como os demais.
alter table public.complementos drop constraint complementos_tipo_check;
alter table public.complementos add constraint complementos_tipo_check
  check (tipo in ('carga_complementar', 'complemento', 'diaria_espera', 'pedagio_adicional', 'reentrega', 'outro'));
