-- Preço por litro com 4 casas: o posto dá desconto sobre o total da nota (ex.: 420 L a 8,26
-- com 18,4% = R$ 2.830,88), e o preço real fica 6,7402. Com 3 casas o total calculado
-- (litros × preço) saía alguns centavos diferente da nota.
-- A coluna total é gerada a partir do preço: sai e volta com a mesma fórmula.
alter table public.abastecimentos drop column total;
alter table public.abastecimentos alter column preco_litro type numeric(10,4);
alter table public.abastecimentos
  add column total numeric(12,2) generated always as (round(litros * preco_litro, 2)) stored;
