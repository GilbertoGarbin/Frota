import type { FormaPagamento } from '@/services/viagens.service';

// Opções dos lançamentos da viagem, as mesmas no app do motorista e no painel do gestor.

export const PAGAMENTOS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: 'adiantamento', rotulo: 'Adiantamento' },
  { valor: 'cartao_empresa', rotulo: 'Cartão da empresa' },
  { valor: 'proprio_bolso', rotulo: 'Próprio bolso' },
  { valor: 'pix_empresa', rotulo: 'Empresa paga por PIX' },
  { valor: 'a_prazo', rotulo: 'Nota a prazo' },
];

export const COMBUSTIVEIS = [
  { valor: 'diesel_s10', rotulo: 'Diesel S10' },
  { valor: 'diesel_s500', rotulo: 'Diesel S500' },
  { valor: 'arla32', rotulo: 'Arla 32' },
] as const;
export type Combustivel = (typeof COMBUSTIVEIS)[number]['valor'];

export const CATEGORIAS_DESPESA = ['Alimentação', 'Pedágio', 'Estacionamento', 'Hospedagem', 'Borracharia', 'Outros'].map(
  (c) => ({ valor: c, rotulo: c }),
);

/** Despesa paga assim precisa do comprovante (o banco também exige: despesas_comprovante_obrigatorio). */
export const despesaExigeComprovante = (forma: FormaPagamento | null) =>
  forma === 'adiantamento' || forma === 'proprio_bolso' || forma === 'a_prazo';
