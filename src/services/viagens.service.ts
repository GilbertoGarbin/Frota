import type { Tables, TablesInsert, TablesUpdate } from '@/db/database.types';
import { supabase } from '@/lib/supabase';
import type { Motorista } from '@/services/motoristas.service';
import { listarVeiculos, type Veiculo } from '@/services/veiculos.service';

export type Viagem = Tables<'viagens'>;
export type Abastecimento = Tables<'abastecimentos'>;
export type Despesa = Tables<'despesas'>;
export type Complemento = Tables<'complementos'>;
export type Parada = Tables<'paradas'>;
export type Documento = Tables<'documentos'>;

export type StatusViagem = 'programada' | 'em_andamento' | 'finalizada';
export type FormaPagamento = 'adiantamento' | 'cartao_empresa' | 'proprio_bolso';
export type TipoComplemento =
  | 'carga_complementar'
  | 'diaria_espera'
  | 'pedagio_adicional'
  | 'reentrega'
  | 'outro';

export const ROTULO_STATUS: Record<StatusViagem, string> = {
  programada: 'Programada',
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
};
export const ROTULO_PAGAMENTO: Record<FormaPagamento, string> = {
  adiantamento: 'Adiantamento',
  cartao_empresa: 'Cartão da empresa',
  proprio_bolso: 'Próprio bolso',
};
export const ROTULO_COMPLEMENTO: Record<TipoComplemento, string> = {
  carga_complementar: 'Carga complementar',
  diaria_espera: 'Diária de espera',
  pedagio_adicional: 'Pedágio adicional',
  reentrega: 'Reentrega',
  outro: 'Outro',
};
// O que o gestor lança (spec do gestor, 5b). Carga complementar é só do motorista.
export const TIPOS_DO_GESTOR: { valor: TipoComplemento; rotulo: string }[] = [
  { valor: 'diaria_espera', rotulo: 'Diária de espera' },
  { valor: 'pedagio_adicional', rotulo: 'Pedágio adicional' },
  { valor: 'reentrega', rotulo: 'Reentrega' },
  { valor: 'outro', rotulo: 'Outro' },
];

export type TelaViagens = { viagens: Viagem[]; motoristas: Motorista[]; veiculos: Veiculo[] };

export async function carregarTelaViagens(): Promise<TelaViagens> {
  const [viagens, motoristas, veiculos] = await Promise.all([
    supabase.from('viagens').select('*').order('data_prevista', { ascending: false }).order('criado_em', { ascending: false }),
    supabase.from('motoristas').select('*').order('nome'),
    listarVeiculos(),
  ]);
  if (viagens.error) throw viagens.error;
  if (motoristas.error) throw motoristas.error;
  return { viagens: viagens.data, motoristas: motoristas.data, veiculos };
}

export type DadosViagem = Pick<
  TablesInsert<'viagens'>,
  | 'motorista_id'
  | 'veiculo_id'
  | 'cliente'
  | 'origem'
  | 'destino'
  | 'carga'
  | 'data_prevista'
  | 'valor_frete'
  | 'valor_adiantamento'
  | 'forma_pagamento_frete'
  | 'observacoes'
>;

export async function criarViagem(dados: DadosViagem): Promise<void> {
  const { error } = await supabase.from('viagens').insert(dados);
  if (error) throw error;
}

export async function atualizarViagem(id: string, dados: TablesUpdate<'viagens'>): Promise<void> {
  const { error } = await supabase.from('viagens').update(dados).eq('id', id);
  if (error) throw error;
}

export async function excluirViagem(id: string): Promise<void> {
  const { error } = await supabase.from('viagens').delete().eq('id', id);
  if (error) throw error;
}

/** Média dos adiantamentos das viagens finalizadas na mesma rota (null = sem histórico). */
export async function sugerirAdiantamento(
  origem: string,
  destino: string,
): Promise<{ valor: number | null; quantidade: number }> {
  const { data, error } = await supabase.rpc('sugerir_adiantamento', { p_origem: origem, p_destino: destino });
  if (error) throw error;
  const linha = data[0];
  return { valor: linha?.valor ?? null, quantidade: linha?.quantidade ?? 0 };
}

export type DetalheViagem = {
  viagem: Viagem;
  abastecimentos: Abastecimento[];
  despesas: Despesa[];
  complementos: Complemento[];
  paradas: Parada[];
  documentos: Documento[];
};

export async function carregarDetalheViagem(id: string): Promise<DetalheViagem> {
  const [viagem, abastecimentos, despesas, complementos, paradas, documentos] = await Promise.all([
    supabase.from('viagens').select('*').eq('id', id).single(),
    supabase.from('abastecimentos').select('*').eq('viagem_id', id).order('km'),
    supabase.from('despesas').select('*').eq('viagem_id', id).order('data'),
    supabase.from('complementos').select('*').eq('viagem_id', id).order('data'),
    supabase.from('paradas').select('*').eq('viagem_id', id).order('data_hora'),
    supabase.from('documentos').select('*').eq('viagem_id', id).order('enviado_em'),
  ]);
  for (const r of [viagem, abastecimentos, despesas, complementos, paradas, documentos]) {
    if (r.error) throw r.error;
  }
  return {
    viagem: viagem.data!,
    abastecimentos: abastecimentos.data!,
    despesas: despesas.data!,
    complementos: complementos.data!,
    paradas: paradas.data!,
    documentos: documentos.data!,
  };
}

export type DadosComplementoGestor = { tipo: TipoComplemento; valor: number; data: string; descricao: string | null };

export async function lancarComplementoGestor(viagemId: string, dados: DadosComplementoGestor): Promise<void> {
  const { error } = await supabase
    .from('complementos')
    .insert({ viagem_id: viagemId, origem_lancamento: 'gestor', ...dados });
  if (error) throw error;
}

export async function excluirComplemento(id: string): Promise<void> {
  const { error } = await supabase.from('complementos').delete().eq('id', id);
  if (error) throw error;
}

/** Link temporário (10 min) para abrir um comprovante ou documento do bucket privado. */
export async function urlDoArquivo(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(caminho, 600);
  if (error) throw error;
  return data.signedUrl;
}

/** Abastecimento lançado pelo gestor, fora de viagem (ex.: o primeiro tanque cheio do veículo). */
export async function registrarAbastecimentoAvulso(
  dados: Pick<
    TablesInsert<'abastecimentos'>,
    'veiculo_id' | 'km' | 'litros' | 'preco_litro' | 'tanque_cheio' | 'data' | 'posto' | 'combustivel'
  >,
): Promise<void> {
  const { error } = await supabase.from('abastecimentos').insert({ ...dados, forma_pagamento: 'cartao_empresa' });
  if (error) throw error;
}
