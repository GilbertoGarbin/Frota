-- Despesa paga com o adiantamento, do próprio bolso ou com nota a prazo precisa do comprovante
-- (é o que o gestor confere na prestação de contas e o que vai pagar ao fornecedor).
-- No app do motorista o caminho do arquivo é gravado junto com a despesa (o envio da foto vem
-- antes na fila), então a regra vale também para quem lança sem sinal.
alter table public.despesas add constraint despesas_comprovante_obrigatorio
  check (forma_pagamento not in ('adiantamento', 'proprio_bolso', 'a_prazo') or comprovante_path is not null);
