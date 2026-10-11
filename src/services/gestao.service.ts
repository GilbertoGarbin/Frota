import type { Tables, TablesInsert } from '@/db/database.types';
import { lerArquivo } from '@/lib/arquivo';
import { supabase } from '@/lib/supabase';
import type { Anexo } from '@/services/anexo.service';
import { listarVeiculos, type Veiculo } from '@/services/veiculos.service';

// Manutenções, custos fixos, pneus e relatórios do gestor.

export type Manutencao = Tables<'manutencoes'>;
export type CustoFixo = Tables<'custos_fixos'>;
export type Pneu = Tables<'pneus'>;

export type TipoManutencao = 'preventiva' | 'corretiva' | 'borracharia';
export const TIPOS_MANUTENCAO: { valor: TipoManutencao; rotulo: string }[] = [
  { valor: 'preventiva', rotulo: 'Preventiva' },
  { valor: 'corretiva', rotulo: 'Corretiva' },
  { valor: 'borracharia', rotulo: 'Borracharia' },
];

export type EstadoPneu = 'bom' | 'atencao' | 'troca';
export type LadoPneu = 'esquerdo' | 'direito';
export type PosicaoPneu = 'unico' | 'externo' | 'interno';

// --- Manutenções --------------------------------------------------------------

export type ViagemResumo = Pick<Tables<'viagens'>, 'id' | 'veiculo_id' | 'origem' | 'destino' | 'data_prevista'>;
export type TelaManutencoes = { manutencoes: Manutencao[]; veiculos: Veiculo[]; viagens: ViagemResumo[] };

export async function carregarTelaManutencoes(): Promise<TelaManutencoes> {
  const [manutencoes, veiculos, viagens] = await Promise.all([
    supabase.from('manutencoes').select('*').order('data', { ascending: false }),
    listarVeiculos(),
    // as mais recentes bastam para vincular uma manutenção a uma viagem
    supabase
      .from('viagens')
      .select('id, veiculo_id, origem, destino, data_prevista')
      .order('data_prevista', { ascending: false })
      .limit(60),
  ]);
  if (manutencoes.error) throw manutencoes.error;
  if (viagens.error) throw viagens.error;
  return { manutencoes: manutencoes.data, veiculos, viagens: viagens.data };
}

export type DadosManutencao = Pick<
  TablesInsert<'manutencoes'>,
  'veiculo_id' | 'tipo' | 'descricao' | 'valor' | 'data' | 'km' | 'proxima_em_km' | 'oficina' | 'pago' | 'nota_fiscal_path' | 'viagem_id'
>;

export async function salvarManutencao(id: string | null, dados: DadosManutencao): Promise<void> {
  const { error } = id
    ? await supabase.from('manutencoes').update(dados).eq('id', id)
    : await supabase.from('manutencoes').insert(dados);
  if (error) throw error;
}

/** Envia a nota fiscal para o bucket privado e devolve o caminho a gravar na manutenção. */
export async function enviarNotaFiscal(tenantId: string, anexo: Anexo): Promise<string> {
  const caminho = `${tenantId}/manutencoes/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${anexo.extensao}`;
  const { error } = await supabase.storage
    .from('comprovantes')
    .upload(caminho, await lerArquivo(anexo.uri), { contentType: anexo.tipoConteudo });
  if (error) throw error;
  return caminho;
}

export async function excluirManutencao(id: string): Promise<void> {
  const { error } = await supabase.from('manutencoes').delete().eq('id', id);
  if (error) throw error;
}

// --- Custos fixos --------------------------------------------------------------

export async function listarCustosFixos(): Promise<CustoFixo[]> {
  const { data, error } = await supabase.from('custos_fixos').select('*').order('descricao');
  if (error) throw error;
  return data;
}

export type DadosCustoFixo = Pick<
  TablesInsert<'custos_fixos'>,
  'descricao' | 'categoria' | 'valor_mensal' | 'inicio' | 'fim'
>;

export async function salvarCustoFixo(id: string | null, dados: DadosCustoFixo): Promise<void> {
  const { error } = id
    ? await supabase.from('custos_fixos').update(dados).eq('id', id)
    : await supabase.from('custos_fixos').insert(dados);
  if (error) throw error;
}

export async function excluirCustoFixo(id: string): Promise<void> {
  const { error } = await supabase.from('custos_fixos').delete().eq('id', id);
  if (error) throw error;
}

// --- Pneus -----------------------------------------------------------------------

export async function listarPneus(veiculoId: string): Promise<Pneu[]> {
  const { data, error } = await supabase
    .from('pneus')
    .select('*')
    .eq('veiculo_id', veiculoId)
    .order('eixo')
    .order('lado')
    .order('posicao');
  if (error) throw error;
  return data;
}

export type DadosPneu = Pick<
  TablesInsert<'pneus'>,
  'veiculo_id' | 'eixo' | 'lado' | 'posicao' | 'estado' | 'marca' | 'observacao'
>;

export async function salvarPneu(id: string | null, dados: DadosPneu): Promise<void> {
  const { error } = id
    ? await supabase.from('pneus').update(dados).eq('id', id)
    : await supabase.from('pneus').insert(dados);
  if (error) throw error;
}

export async function excluirPneu(id: string): Promise<void> {
  const { error } = await supabase.from('pneus').delete().eq('id', id);
  if (error) throw error;
}

// --- Relatórios (somas feitas no banco) --------------------------------------------

export type ResumoFinanceiro = {
  faturamento: number;
  combustivel: number;
  despesas: number;
  comissoes: number;
  manutencoes: number;
  custos_operacionais: number;
  custos_fixos: number;
  resultado: number;
  km_rodado: number;
  viagens: number;
  viagens_combustivel_estimado: number;
  adiantamentos_abertos: number;
  adiantamento_a_devolver: number;
  adiantamento_a_reembolsar: number;
};

export async function buscarResumoFinanceiro(inicio: string, fim: string): Promise<ResumoFinanceiro> {
  const { data, error } = await supabase.rpc('resumo_financeiro', { p_inicio: inicio, p_fim: fim });
  if (error) throw error;
  return data[0];
}

export type DesempenhoVeiculo = {
  veiculo_id: string;
  placa: string;
  modelo: string;
  viagens: number;
  viagens_combustivel_estimado: number;
  km_rodado: number;
  faturamento: number;
  combustivel: number;
  comissoes: number;
  despesas: number;
  manutencoes: number;
  resultado: number;
  margem_percentual: number | null;
};

export async function buscarDesempenhoPorVeiculo(inicio: string, fim: string): Promise<DesempenhoVeiculo[]> {
  const { data, error } = await supabase.rpc('desempenho_por_veiculo', { p_inicio: inicio, p_fim: fim });
  if (error) throw error;
  return data;
}

export type Alerta = {
  destino: 'motoristas' | 'manutencoes' | 'pneus';
  gravidade: 'perigo' | 'aviso';
  mensagem: string;
  referencia_id: string;
};

export async function buscarAlertas(): Promise<Alerta[]> {
  const { data, error } = await supabase.rpc('alertas_gestor');
  if (error) throw error;
  // mais graves primeiro
  return (data as Alerta[]).sort((a, b) => (a.gravidade === b.gravidade ? 0 : a.gravidade === 'perigo' ? -1 : 1));
}

export type Contagens = { viagensEmAndamento: number; viagensProgramadas: number; motoristas: number; veiculos: number };

export async function buscarContagens(): Promise<Contagens> {
  const contar = async (tabela: 'viagens' | 'motoristas' | 'veiculos', status?: string) => {
    let consulta = supabase.from(tabela).select('id', { count: 'exact', head: true });
    if (status) consulta = consulta.eq('status', status);
    const { count, error } = await consulta;
    if (error) throw error;
    return count ?? 0;
  };
  const [viagensEmAndamento, viagensProgramadas, motoristas, veiculos] = await Promise.all([
    contar('viagens', 'em_andamento'),
    contar('viagens', 'programada'),
    contar('motoristas', 'ativo'),
    contar('veiculos'),
  ]);
  return { viagensEmAndamento, viagensProgramadas, motoristas, veiculos };
}
