import type { Database, Tables } from '@/db/database.types';
import { armazem } from '@/db/armazem';
import type { ItemFila, TabelaLancamento } from '@/db/armazem.tipos';
import { apagarArquivo, lerArquivo } from '@/lib/arquivo';
import { supabase } from '@/lib/supabase';
import { percentualDe, somar } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import type { Mes } from '@/utils/formato';

// Dados do app do motorista: cópia local + fila de envio.
// A tela sempre lê da cópia local (funciona sem sinal); o servidor é atualizado pela fila.

export type ViagemMotorista = Database['public']['Functions']['viagens_do_motorista']['Returns'][number];
export type MotoristaPerfil = Tables<'motoristas'>;
export type VeiculoResumo = Pick<Tables<'veiculos'>, 'id' | 'placa' | 'modelo' | 'km_atual' | 'status'>;

type Base<T extends TabelaLancamento, L> = { tabela: T; linha: L; /** ainda não confirmado pelo servidor */ pendente: boolean };

export type RegistroAbastecimento = Base<
  'abastecimentos',
  Pick<
    Tables<'abastecimentos'>,
    | 'id'
    | 'viagem_id'
    | 'data'
    | 'km'
    | 'posto'
    | 'combustivel'
    | 'litros'
    | 'preco_litro'
    | 'tanque_cheio'
    | 'forma_pagamento'
    | 'chave_pix'
    | 'vencimento'
    | 'comprovante_path'
  > & { total: number }
>;
export type RegistroDespesa = Base<
  'despesas',
  Pick<
    Tables<'despesas'>,
    | 'id'
    | 'viagem_id'
    | 'data'
    | 'categoria'
    | 'valor'
    | 'forma_pagamento'
    | 'chave_pix'
    | 'vencimento'
    | 'local'
    | 'descricao'
    | 'observacoes'
    | 'comprovante_path'
  >
>;
export type RegistroParada = Base<
  'paradas',
  Pick<
    Tables<'paradas'>,
    'id' | 'viagem_id' | 'tipo' | 'local_nome' | 'latitude' | 'longitude' | 'avaliacao_estrelas' | 'comentario' | 'data_hora'
  >
>;
export type RegistroComplemento = Base<
  'complementos',
  Pick<
    Tables<'complementos'>,
    | 'id' | 'viagem_id' | 'data' | 'tipo' | 'origem_lancamento' | 'valor' | 'cliente_carga_adicional'
    | 'local_coleta' | 'local_entrega' | 'peso_volume' | 'descricao' | 'comprovante_path'
  >
>;
export type RegistroDocumento = Base<
  'documentos',
  Pick<Tables<'documentos'>, 'id' | 'viagem_id' | 'tipo' | 'arquivo_path' | 'enviado_em'>
>;

export type Registro =
  | RegistroAbastecimento
  | RegistroDespesa
  | RegistroParada
  | RegistroComplemento
  | RegistroDocumento;

export type Perfil = {
  motorista: MotoristaPerfil | null;
  veiculos: VeiculoResumo[];
  sincronizado_em: string | null;
  /** padrão da transportadora para viagem criada no aparelho (ausente na cópia antiga = exige) */
  exige_canhoto?: boolean;
};

export type DadosLocais = { viagens: ViagemMotorista[]; registros: Registro[]; perfil: Perfil; fila: ItemFila[] };

const PERFIL_VAZIO: Perfil = { motorista: null, veiculos: [], sincronizado_em: null };

export async function lerDadosLocais(): Promise<DadosLocais> {
  const [viagens, registros, perfis, fila] = await Promise.all([
    armazem.ler<ViagemMotorista>('viagens'),
    armazem.ler<Registro>('registros'),
    armazem.ler<Perfil>('perfil'),
    armazem.fila(),
  ]);
  return { viagens, registros, perfil: perfis[0] ?? PERFIL_VAZIO, fila };
}

// ---------------------------------------------------------------------------
// Valores "ao vivo" da viagem em andamento
// ---------------------------------------------------------------------------

/**
 * Frete, comissão e adiantamento da viagem em andamento, somando os lançamentos que estão no
 * aparelho (enviados ou não). É o que permite ver o saldo mudar na hora, mesmo sem sinal.
 * O servidor faz a mesma conta e é quem vale depois da sincronização.
 */
export function viagemAoVivo(viagem: ViagemMotorista, registros: Registro[]): ViagemMotorista {
  if (viagem.status !== 'em_andamento') return viagem;
  const daViagem = registros.filter((r) => r.linha.viagem_id === viagem.id);
  const complementos = daViagem.flatMap((r) => (r.tabela === 'complementos' ? [r.linha.valor] : []));
  const gastoCom = (forma: string) =>
    somar(
      daViagem.flatMap((r) => {
        if (r.tabela === 'despesas' && r.linha.forma_pagamento === forma) return [r.linha.valor];
        if (r.tabela === 'abastecimentos' && r.linha.forma_pagamento === forma) return [r.linha.total];
        return [];
      }),
    );
  const freteTotal = somar([viagem.valor_frete, ...complementos]);
  const adiantamentoGasto = gastoCom('adiantamento');
  return {
    ...viagem,
    valor_frete_total: freteTotal,
    comissao_valor: percentualDe(freteTotal, viagem.comissao_percentual),
    adiantamento_gasto: adiantamentoGasto,
    adiantamento_saldo: somar([viagem.valor_adiantamento, -adiantamentoGasto]),
    gasto_proprio_bolso: gastoCom('proprio_bolso'),
  };
}

// ---------------------------------------------------------------------------
// Envio da fila
// ---------------------------------------------------------------------------

type Falha = { transitoria: boolean; mensagem: string };

const REDE = /failed to fetch|network request failed|networkerror|fetch failed|load failed|timed? ?out|aborted/i;

/** Falha transitória (sem sinal, servidor fora, sessão renovando) = tentar de novo depois, sem perder nada. */
function classificar(erro: unknown, status?: number): Falha {
  const mensagem = mensagemDeErro(erro);
  const bruto = erro && typeof erro === 'object' && 'message' in erro ? String(erro.message) : String(erro);
  const transitoria =
    REDE.test(bruto) || status === 0 || status === 401 || status === 408 || status === 429 || (status ?? 0) >= 500;
  return { transitoria, mensagem };
}

async function executar(item: ItemFila): Promise<Falha | null> {
  try {
    if (item.op === 'inserir') {
      // mesmo UUID duas vezes = segunda vez é ignorada (idempotente)
      const { error, status } = await supabase
        .from(item.tabela)
        .upsert(item.linha as never, { onConflict: 'id', ignoreDuplicates: true });
      return error ? classificar(error, status) : null;
    }
    if (item.op === 'rpc') {
      const { error, status } = await supabase.rpc(item.funcao, item.args as never);
      return error ? classificar(error, status) : null;
    }
    const conteudo = await lerArquivo(item.origem);
    const { error } = await supabase.storage
      .from('comprovantes')
      .upload(item.destino, conteudo, { contentType: item.tipoConteudo, upsert: false });
    if (error && !/already exists|duplicate/i.test(error.message)) {
      const detalhes = error as { status?: number; statusCode?: string };
      const status = detalhes.status ?? (detalhes.statusCode ? Number(detalhes.statusCode) : undefined);
      return classificar(error, status);
    }
    await apagarArquivo(item.origem).catch(() => {});
    return null;
  } catch (e) {
    return classificar(e, 0);
  }
}

export type ResultadoFila = 'vazia' | 'sem_conexao' | 'recusado';

/**
 * Envia a fila na ordem. Para no primeiro problema:
 *  - sem conexão → tenta de novo na próxima sincronização;
 *  - servidor recusou → marca o erro e espera o motorista decidir (tentar de novo ou descartar).
 * Nunca pula um item: a ordem importa (ex.: a foto do canhoto antes de finalizar a viagem).
 */
export async function enviarFila(): Promise<ResultadoFila> {
  for (const item of await armazem.fila()) {
    // já recusado: espera o motorista escolher "tentar de novo" ou "descartar"
    if (item.erro) return 'recusado';
    const falha = await executar(item);
    if (!falha) {
      await armazem.removerDaFila(item.seq);
      continue;
    }
    if (falha.transitoria) return 'sem_conexao';
    await armazem.marcarErro(item.seq, falha.mensagem);
    return 'recusado';
  }
  return 'vazia';
}

/** Descarta o item recusado e o registro local que ele criaria (com as operações ligadas a ele). */
export async function descartarItem(item: ItemFila): Promise<void> {
  const fila = await armazem.fila();
  const ligados = item.registroId ? fila.filter((i) => i.registroId === item.registroId) : [item];
  for (const i of ligados) {
    if (i.op === 'upload') await apagarArquivo(i.origem).catch(() => {});
    await armazem.removerDaFila(i.seq);
  }
  if (item.registroId) await armazem.remover('registros', item.registroId);
}

// ---------------------------------------------------------------------------
// Download: só o que o motorista precisa (viagens dele, lançamentos da viagem em andamento)
// ---------------------------------------------------------------------------

const TABELAS: TabelaLancamento[] = ['abastecimentos', 'despesas', 'paradas', 'complementos', 'documentos'];

/**
 * Baixa os dados do servidor e troca a cópia local. Só pode rodar com a fila vazia:
 * enquanto há envio pendente, a cópia local está à frente do servidor.
 */
export async function baixarDados(motoristaId: string): Promise<void> {
  const [viagens, motorista, veiculos, tenant] = await Promise.all([
    supabase.rpc('viagens_do_motorista'),
    supabase.from('motoristas').select('*').eq('id', motoristaId).maybeSingle(),
    supabase.from('veiculos').select('id, placa, modelo, km_atual, status').order('placa'),
    supabase.from('tenants').select('exige_canhoto').maybeSingle(),
  ]);
  if (viagens.error) throw viagens.error;
  if (motorista.error) throw motorista.error;
  if (veiculos.error) throw veiculos.error;
  if (tenant.error) throw tenant.error;

  const emAndamento = viagens.data.filter((v) => v.status === 'em_andamento').map((v) => v.id);
  const registros: Registro[] = [];
  if (emAndamento.length > 0) {
    for (const tabela of TABELAS) {
      const { data, error } = await supabase.from(tabela).select('*').in('viagem_id', emAndamento);
      if (error) throw error;
      for (const linha of data) registros.push({ tabela, linha, pendente: false } as Registro);
    }
  }

  await armazem.substituir('viagens', viagens.data.map((v) => ({ id: v.id, doc: v })));
  await armazem.substituir('registros', registros.map((r) => ({ id: r.linha.id, doc: r })));
  const perfil: Perfil = {
    motorista: motorista.data,
    veiculos: veiculos.data,
    sincronizado_em: new Date().toISOString(),
    exige_canhoto: tenant.data?.exige_canhoto ?? true,
  };
  await armazem.gravar('perfil', 'eu', perfil);
}

/** Lançamentos de uma viagem já finalizada (não ficam no aparelho; precisa de sinal). */
export async function buscarRegistrosDaViagem(viagemId: string): Promise<Registro[]> {
  const registros: Registro[] = [];
  for (const tabela of TABELAS) {
    const { data, error } = await supabase.from(tabela).select('*').eq('viagem_id', viagemId);
    if (error) throw error;
    for (const linha of data) registros.push({ tabela, linha, pendente: false } as Registro);
  }
  return registros;
}

/** Parada frequente na rota (lembrete na tela de confirmar viagem). Sem sinal, não aparece. */
export async function buscarParadaSugerida(
  viagemId: string,
): Promise<{ local_nome: string; media_estrelas: number; vezes: number } | null> {
  const { data, error } = await supabase.rpc('parada_sugerida', { p_viagem_id: viagemId });
  if (error) return null;
  return data[0] ?? null;
}

// ---------------------------------------------------------------------------
// Resumo do mês (chip do Início e Histórico), calculado da cópia local para funcionar sem sinal
// ---------------------------------------------------------------------------

/** A viagem finalizou neste mês? (pela data de chegada, no fuso do aparelho) */
export function chegouNoMes(v: ViagemMotorista, { ano, mes }: Mes): boolean {
  if (v.status !== 'finalizada' || !v.data_hora_chegada) return false;
  const chegada = new Date(v.data_hora_chegada);
  return chegada.getFullYear() === ano && chegada.getMonth() + 1 === mes;
}

export function resumoDoMes(viagens: ViagemMotorista[], mes: Mes) {
  const doMes = viagens.filter((v) => chegouNoMes(v, mes));
  return {
    viagens: doMes,
    km: doMes.reduce((total, v) => total + ((v.km_final ?? 0) - (v.km_inicial ?? 0)), 0),
    comissao: somar(doMes.map((v) => v.comissao_valor)),
  };
}
