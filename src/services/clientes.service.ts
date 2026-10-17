import type { Tables, TablesInsert } from '@/db/database.types';
import { supabase } from '@/lib/supabase';

export type Cliente = Tables<'clientes'>;
export type DadosCliente = Pick<TablesInsert<'clientes'>, 'nome' | 'documento' | 'telefone' | 'cidade' | 'ativo' | 'forma_recebimento_id'>;

export async function listarClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase.from('clientes').select('*').order('nome');
  if (error) throw error;
  return data;
}

export async function salvarCliente(id: string | null, dados: DadosCliente): Promise<void> {
  const { error } = id
    ? await supabase.from('clientes').update(dados).eq('id', id)
    : await supabase.from('clientes').insert(dados);
  if (error) throw error;
}
