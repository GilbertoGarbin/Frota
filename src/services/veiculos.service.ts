import type { Tables, TablesInsert } from '@/db/database.types';
import { supabase } from '@/lib/supabase';

export type Veiculo = Tables<'veiculos'>;
export type StatusVeiculo = 'ativo' | 'em_manutencao' | 'inativo';

export const STATUS_VEICULO: { valor: StatusVeiculo; rotulo: string }[] = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'em_manutencao', rotulo: 'Em manutenção' },
  { valor: 'inativo', rotulo: 'Inativo' },
];

// Campos que o gestor edita; consumo e preço de referência calculados são do banco.
export type DadosVeiculo = Pick<
  TablesInsert<'veiculos'>,
  'placa' | 'modelo' | 'km_atual' | 'status' | 'consumo_medio_informado'
>;

export async function listarVeiculos(): Promise<Veiculo[]> {
  const { data, error } = await supabase.from('veiculos').select('*').order('placa');
  if (error) throw error;
  return data;
}

export async function salvarVeiculo(id: string | null, dados: DadosVeiculo): Promise<void> {
  const { error } = id
    ? await supabase.from('veiculos').update(dados).eq('id', id)
    : await supabase.from('veiculos').insert(dados);
  if (error) throw error;
}
