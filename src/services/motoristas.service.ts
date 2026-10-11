import type { Tables, TablesInsert } from '@/db/database.types';
import { supabase } from '@/lib/supabase';
import { listarVeiculos, type Veiculo } from '@/services/veiculos.service';

export type Motorista = Tables<'motoristas'>;
export type ModeloRemuneracao = 'comissionado' | 'assalariado';
export type StatusMotorista = 'ativo' | 'inativo';

export type DadosMotorista = Pick<
  TablesInsert<'motoristas'>,
  | 'nome'
  | 'cpf'
  | 'telefone'
  | 'cnh_numero'
  | 'cnh_validade'
  | 'veiculo_vinculado_id'
  | 'modelo_remuneracao'
  | 'comissao_percentual'
  | 'salario_fixo'
  | 'status'
>;

export type TelaMotoristas = {
  motoristas: Motorista[];
  veiculos: Veiculo[];
  /** ids dos motoristas que têm um aparelho ativado */
  comAparelho: Set<string>;
};

export async function carregarTelaMotoristas(): Promise<TelaMotoristas> {
  const [motoristas, veiculos, aparelhos] = await Promise.all([
    supabase.from('motoristas').select('*').order('nome'),
    listarVeiculos(),
    supabase.from('usuarios').select('motorista_id').eq('papel', 'motorista').eq('ativo', true),
  ]);
  if (motoristas.error) throw motoristas.error;
  if (aparelhos.error) throw aparelhos.error;
  return {
    motoristas: motoristas.data,
    veiculos,
    comAparelho: new Set(aparelhos.data.flatMap((a) => (a.motorista_id ? [a.motorista_id] : []))),
  };
}

export async function salvarMotorista(id: string | null, dados: DadosMotorista): Promise<void> {
  const { error } = id
    ? await supabase.from('motoristas').update(dados).eq('id', id)
    : await supabase.from('motoristas').insert(dados);
  if (error) throw error;
}

/** Gera (ou troca) o código de ativação. O código só existe nesta resposta: mostre na hora. */
export async function gerarCodigoAtivacao(motoristaId: string): Promise<string> {
  const { data, error } = await supabase.rpc('gerar_codigo_ativacao', { p_motorista_id: motoristaId });
  if (error) throw error;
  return data;
}

export async function revogarAparelho(motoristaId: string): Promise<void> {
  const { error } = await supabase.rpc('revogar_aparelho', { p_motorista_id: motoristaId });
  if (error) throw error;
}
