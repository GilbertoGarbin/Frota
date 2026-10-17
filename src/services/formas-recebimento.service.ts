import type { Json, Tables } from '@/db/database.types';
import { supabase } from '@/lib/supabase';

// Formas de recebimento do frete (como o cliente paga): ver a migration formas_recebimento.

export type ParcelaRecebimento = {
  percentual: number;
  base: 'saida' | 'entrega';
  dias: number;
  tipo_dias: 'corridos' | 'uteis';
  /** 0 = domingo … 6 = sábado; null = qualquer dia */
  dia_semana: number | null;
};

export type FormaRecebimento = Omit<Tables<'formas_recebimento'>, 'parcelas'> & { parcelas: ParcelaRecebimento[] };

export const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export async function listarFormasRecebimento(): Promise<FormaRecebimento[]> {
  const { data, error } = await supabase.from('formas_recebimento').select('*').order('nome');
  if (error) throw error;
  return data.map((f) => ({ ...f, parcelas: f.parcelas as unknown as ParcelaRecebimento[] }));
}

/** Grava a forma e devolve o id (para já selecionar a forma recém-criada). */
export async function salvarFormaRecebimento(
  id: string | null,
  dados: { nome: string; parcelas: ParcelaRecebimento[]; ativo: boolean },
): Promise<string> {
  const linha = { nome: dados.nome, parcelas: dados.parcelas as unknown as Json, ativo: dados.ativo };
  const { data, error } = id
    ? await supabase.from('formas_recebimento').update(linha).eq('id', id).select('id').single()
    : await supabase.from('formas_recebimento').insert(linha).select('id').single();
  if (error) throw error;
  return data.id;
}

function descreverParcela(p: ParcelaRecebimento): string {
  const momento = p.base === 'saida' ? 'na saída' : 'na entrega';
  const prazo =
    p.dias === 0
      ? momento
      : `${p.dias} ${p.dias === 1 ? 'dia' : 'dias'} ${p.tipo_dias === 'uteis' ? 'úteis' : 'corridos'} após a ${p.base === 'saida' ? 'saída' : 'entrega'}`;
  const artigo = p.dia_semana === 0 || p.dia_semana === 6 ? 'no' : 'na';
  const dia = p.dia_semana === null ? '' : `, pago ${artigo} ${DIAS_SEMANA[p.dia_semana]}`;
  return `${p.percentual.toLocaleString('pt-BR')}% ${prazo}${dia}`;
}

/** "70% na saída + 30% 10 dias corridos após a entrega" */
export function descreverParcelas(parcelas: ParcelaRecebimento[]): string {
  return parcelas.map(descreverParcela).join(' + ');
}
