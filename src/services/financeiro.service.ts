import type { Tables } from '@/db/database.types';
import { supabase } from '@/lib/supabase';

// Contas do financeiro (ver a migration recebimentos_pagamentos): recebimentos e pagamentos
// ligados à viagem; o banco cria e recalcula, aqui só se lê e se marca recebido/pago.

export type Recebimento = Tables<'recebimentos'>;
export type Pagamento = Tables<'pagamentos'>;

/** Viagem resumida para mostrar junto da conta */
export type ViagemDaConta = { id: string; origem: string; destino: string; cliente: string | null; data_prevista: string };

export type ContaReceber = Recebimento & { viagem: ViagemDaConta | null };
export type ContaPagar = Pagamento & { viagem: ViagemDaConta | null };

const CAMPOS_VIAGEM = 'viagem:viagens(id, origem, destino, cliente, data_prevista)';

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
