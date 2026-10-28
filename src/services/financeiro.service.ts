import type { Tables } from '@/db/database.types';
import { supabase } from '@/lib/supabase';

// Contas do financeiro (ver a migration recebimentos_pagamentos): recebimentos e pagamentos
// ligados à viagem; o banco cria e recalcula, aqui só se lê e se marca recebido/pago.

export type Recebimento = Tables<'recebimentos'>;
export type Pagamento = Tables<'pagamentos'>;

/** Viagem resumida para mostrar junto da conta */
export type ViagemDaConta = {
  id: string;
  origem: string;
  destino: string;
  cliente: string | null;
  cliente_id: string | null;
  data_prevista: string;
};

export type ContaReceber = Recebimento & { viagem: ViagemDaConta | null };
export type ContaPagar = Pagamento & { viagem: ViagemDaConta | null };

const CAMPOS_VIAGEM = 'viagem:viagens(id, origem, destino, cliente, cliente_id, data_prevista)';

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function listarRecebimentos(): Promise<ContaReceber[]> {
  const { data, error } = await supabase
    .from('recebimentos')
    .select(`*, ${CAMPOS_VIAGEM}`)
    .order('vencimento', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as unknown as ContaReceber[];
}

export async function listarPagamentos(): Promise<ContaPagar[]> {
  const { data, error } = await supabase
    .from('pagamentos')
    .select(`*, ${CAMPOS_VIAGEM}`)
    .order('vencimento', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as unknown as ContaPagar[];
}

export async function marcarRecebido(id: string, recebido: boolean): Promise<void> {
  const { error } = await supabase.from('recebimentos').update({ recebido_em: recebido ? hoje() : null }).eq('id', id);
  if (error) throw error;
}

export async function marcarPagamento(id: string, pago: boolean): Promise<void> {
  const { error } = await supabase.from('pagamentos').update({ pago_em: pago ? hoje() : null }).eq('id', id);
  if (error) throw error;
}

/** Cria (ou refaz, mantendo as já recebidas) as parcelas da forma de recebimento da viagem. */
export async function gerarRecebimentos(viagemId: string): Promise<void> {
  const { error } = await supabase.rpc('gerar_recebimentos', { p_viagem_id: viagemId });
  if (error) throw error;
}

export type Situacao = 'em_dia' | 'atrasado' | 'quitado';

/** Atrasado = venceu antes de hoje e não foi quitado */
export function situacaoDaConta(vencimento: string | null, quitadoEm: string | null): Situacao {
  if (quitadoEm) return 'quitado';
  return vencimento && vencimento < hoje() ? 'atrasado' : 'em_dia';
}

export const dataDeHoje = hoje;

export type DadosConta = {
  descricao: string;
  valor: number;
  vencimento: string | null;
  juros: number;
  desconto: number;
  observacao: string | null;
  /** data em que foi recebida/paga; null = em aberto */
  quitadoEm: string | null;
  /** só pagamentos */
  favorecido?: string | null;
  chavePix?: string | null;
};

/**
 * Grava a edição de uma conta. Valor e vencimento mudados à mão ficam marcados como manuais:
 * o recálculo automático (frete, datas da viagem, lançamento) não os sobrescreve mais.
 */
export async function salvarConta(
  tipo: 'receber' | 'pagar',
  id: string,
  dados: DadosConta,
  mudou: { valor: boolean; vencimento: boolean },
): Promise<void> {
  const comum = {
    descricao: dados.descricao,
    valor: dados.valor,
    vencimento: dados.vencimento,
    juros: dados.juros,
    desconto: dados.desconto,
    observacao: dados.observacao,
    ...(mudou.valor ? { valor_manual: true } : {}),
    ...(mudou.vencimento ? { vencimento_manual: true } : {}),
  };
  const { error } =
    tipo === 'receber'
      ? await supabase.from('recebimentos').update({ ...comum, recebido_em: dados.quitadoEm }).eq('id', id)
      : await supabase
          .from('pagamentos')
          .update({ ...comum, pago_em: dados.quitadoEm, favorecido: dados.favorecido ?? null, chave_pix: dados.chavePix ?? null })
          .eq('id', id);
  if (error) throw error;
}
