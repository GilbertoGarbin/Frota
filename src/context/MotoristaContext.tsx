import * as Crypto from 'expo-crypto';
import { useNetworkState } from 'expo-network';
import { createContext, use, useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { armazem } from '@/db/armazem';
import type { ItemFila, Operacao, TabelaLancamento } from '@/db/armazem.tipos';
import { useSessao } from '@/context/SessaoContext';
import type { Anexo } from '@/services/anexo.service';
import {
  baixarDados,
  descartarItem,
  enviarFila,
  lerDadosLocais,
  viagemAoVivo,
  type DadosLocais,
  type Registro,
  type ViagemMotorista,
} from '@/services/motorista.service';
import { percentualDe } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';

type ItemNovo = Operacao & { descricao: string; registroId: string | null };

export type DadosNovaViagem = {
  veiculo_id: string;
  origem: string;
  destino: string;
  valor_frete: number;
  data_prevista: string;
  cliente: string | null;
  carga: string | null;
  observacoes: string | null;
};

export type DadosFinalizacao = {
  km_final: number;
  data_hora_chegada: string;
  local_chegada: string | null;
  observacoes_finais: string | null;
};

/** Linha de um lançamento sem os campos que o app preenche sozinho */
type SemIds<R extends Registro> = Omit<R['linha'], 'id' | 'viagem_id' | 'comprovante_path'>;

type Contexto = DadosLocais & {
  carregado: boolean;
  sincronizando: boolean;
  online: boolean;
  /** mensagem do último problema de sincronização que não é item recusado (ex.: falha ao baixar) */
  aviso: string | null;
  sincronizar: () => Promise<void>;
  /** viagem com frete, comissão e adiantamento recalculados pelos lançamentos do aparelho */
  aoVivo: (viagem: ViagemMotorista) => ViagemMotorista;
  lancarDespesa: (viagem: ViagemMotorista, dados: SemIds<Extract<Registro, { tabela: 'despesas' }>>, anexo: Anexo | null) => Promise<void>;
  lancarAbastecimento: (viagem: ViagemMotorista, dados: SemIds<Extract<Registro, { tabela: 'abastecimentos' }>>, anexo: Anexo | null) => Promise<void>;
  lancarComplemento: (
    viagem: ViagemMotorista,
    dados: Omit<SemIds<Extract<Registro, { tabela: 'complementos' }>>, 'tipo' | 'origem_lancamento'>,
    anexo: Anexo | null,
  ) => Promise<void>;
  lancarParada: (viagem: ViagemMotorista, dados: Omit<SemIds<Extract<Registro, { tabela: 'paradas' }>>, 'data_hora'>) => Promise<void>;
  enviarDocumento: (viagem: ViagemMotorista, tipo: string, anexo: Anexo) => Promise<void>;
  /** kmInicial informado = já inicia a viagem ("Confirmar e iniciar") */
  criarViagem: (dados: DadosNovaViagem, kmInicial?: number) => Promise<string>;
  editarViagem: (viagem: ViagemMotorista, dados: DadosNovaViagem) => Promise<void>;
  iniciarViagem: (viagem: ViagemMotorista, kmInicial: number) => Promise<void>;
  finalizarViagem: (viagem: ViagemMotorista, dados: DadosFinalizacao) => Promise<void>;
  tentarDeNovo: (item: ItemFila) => Promise<void>;
  descartar: (item: ItemFila) => Promise<void>;
};

const MotoristaContext = createContext<Contexto | null>(null);

export function useMotorista(): Contexto {
  const valor = use(MotoristaContext);
  if (!valor) throw new Error('useMotorista deve ser usado dentro de <MotoristaProvider>');
  return valor;
}

const VAZIO: DadosLocais = {
  viagens: [],
  registros: [],
  perfil: { motorista: null, veiculos: [], sincronizado_em: null },
  fila: [],
};

export function MotoristaProvider({ children }: PropsWithChildren) {
  const { acesso } = useSessao();
  const tenantId = acesso?.tenantId ?? '';
  const motoristaId = acesso?.motoristaId ?? '';
  const rede = useNetworkState();
  const online = rede.isConnected !== false;

  const [dados, setDados] = useState<DadosLocais>(VAZIO);
  const [carregado, setCarregado] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const emCurso = useRef(false);
  const pedidoDuranteEnvio = useRef(false);

  const recarregarLocal = useCallback(async () => setDados(await lerDadosLocais()), []);

  // Envia o que está pendente e, com a fila vazia, baixa o estado do servidor.
  const sincronizar = useCallback(async () => {
    if (!motoristaId) return;
    if (emCurso.current) {
      pedidoDuranteEnvio.current = true; // roda de novo ao terminar
      return;
    }
    emCurso.current = true;
    setSincronizando(true);
    try {
      do {
        pedidoDuranteEnvio.current = false;
        const resultado = await enviarFila();
        if (resultado === 'vazia') {
          try {
            await baixarDados(motoristaId);
            setAviso(null);
          } catch (e) {
            // sem sinal: segue com a cópia local
            if (!/sem conexão/i.test(mensagemDeErro(e))) setAviso(mensagemDeErro(e));
          }
        }
        await recarregarLocal();
      } while (pedidoDuranteEnvio.current);
    } finally {
      emCurso.current = false;
      setSincronizando(false);
    }
  }, [motoristaId, recarregarLocal]);

  // Abre com a cópia local (instantâneo, funciona sem sinal) e sincroniza em seguida
  useEffect(() => {
    let vigente = true;
    lerDadosLocais().then((locais) => {
      if (!vigente) return;
      setDados(locais);
      setCarregado(true);
      sincronizar();
    });
    return () => {
      vigente = false;
    };
  }, [sincronizar]);

  // Sincroniza quando o sinal volta e quando o app volta para a frente
  useEffect(() => {
    if (online && carregado) sincronizar();
  }, [online, carregado, sincronizar]);
  useEffect(() => {
    const ouvinte = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') sincronizar();
    });
    return () => ouvinte.remove();
  }, [sincronizar]);

  // Sinal fraco: o aparelho diz que está conectado, mas o envio falha. Enquanto houver fila
  // (e nenhum item recusado esperando decisão), tenta de novo a cada 30 s com o app aberto.
  const haFilaParaEnviar = dados.fila.length > 0 && !dados.fila.some((i) => i.erro);
  useEffect(() => {
    if (!haFilaParaEnviar) return;
    const relogio = setInterval(sincronizar, 30_000);
    return () => clearInterval(relogio);
  }, [haFilaParaEnviar, sincronizar]);

  /** Grava no aparelho + põe na fila, tudo antes de tentar a rede. */
  const registrar = useCallback(
    async (opcoes: { registros?: Registro[]; viagem?: ViagemMotorista; itens: ItemNovo[] }) => {
      for (const r of opcoes.registros ?? []) await armazem.gravar('registros', r.linha.id, r);
      if (opcoes.viagem) await armazem.gravar('viagens', opcoes.viagem.id, opcoes.viagem);
      await armazem.enfileirar(opcoes.itens);
      await recarregarLocal();
      sincronizar();
    },
    [recarregarLocal, sincronizar],
  );

  /** Lançamento com comprovante opcional: a foto entra na fila antes da linha e vira também um Documento. */
  const lancar = useCallback(
    async (
      tabela: Exclude<TabelaLancamento, 'documentos'>,
      viagem: ViagemMotorista,
      linhaLocal: Record<string, unknown>,
      linhaServidor: Record<string, unknown>,
      descricao: string,
      anexo: Anexo | null,
    ) => {
      const id = Crypto.randomUUID();
      const caminho = anexo ? `${tenantId}/${viagem.id}/${id}.${anexo.extensao}` : null;
      const comAnexo = tabela === 'paradas' ? {} : { comprovante_path: caminho };
      const registros = [
        { tabela, linha: { id, viagem_id: viagem.id, ...linhaLocal, ...comAnexo }, pendente: true } as Registro,
      ];
      const itens: ItemNovo[] = [];
      if (anexo && caminho) {
        itens.push({ op: 'upload', origem: anexo.uri, destino: caminho, tipoConteudo: anexo.tipoConteudo, descricao: `Foto: ${descricao}`, registroId: id });
      }
      itens.push({ op: 'inserir', tabela, linha: { id, viagem_id: viagem.id, ...linhaServidor, ...comAnexo }, descricao, registroId: id });
      if (anexo && caminho) {
        // "A foto tirada aqui é salva automaticamente na lista de Documentos da viagem" (spec 5.7)
        const documentoId = Crypto.randomUUID();
        const documento = { id: documentoId, viagem_id: viagem.id, tipo: 'comprovante', arquivo_path: caminho };
        registros.push({ tabela: 'documentos', linha: { ...documento, enviado_em: new Date().toISOString() }, pendente: true });
        itens.push({ op: 'inserir', tabela: 'documentos', linha: documento, descricao: `Comprovante: ${descricao}`, registroId: documentoId });
      }
      await registrar({ registros, itens });
    },
    [registrar, tenantId],
  );

  const valor: Contexto = {
    ...dados,
    carregado,
    sincronizando,
    online,
    aviso,
    sincronizar,
    aoVivo: (viagem) => viagemAoVivo(viagem, dados.registros),

    lancarDespesa: (viagem, d, anexo) => lancar('despesas', viagem, d, d, `Despesa — ${d.categoria}`, anexo),

    lancarAbastecimento: (viagem, d, anexo) => {
      // "total" é coluna calculada no banco: não vai na linha enviada
      const { total: _total, ...semTotal } = d;
      return lancar('abastecimentos', viagem, d, { ...semTotal, veiculo_id: viagem.veiculo_id }, 'Abastecimento', anexo);
    },

    lancarComplemento: (viagem, d, anexo) => {
      const linha = { ...d, tipo: 'carga_complementar', origem_lancamento: 'motorista' };
      return lancar('complementos', viagem, linha, linha, 'Carga complementar', anexo);
    },

    lancarParada: (viagem, d) => {
      const linha = { ...d, data_hora: new Date().toISOString() }; // hora capturada no registro (spec 5.6)
      return lancar('paradas', viagem, linha, { ...linha, motorista_id: motoristaId }, `Parada — ${d.local_nome}`, null);
    },

    enviarDocumento: async (viagem, tipo, anexo) => {
      const id = Crypto.randomUUID();
      const caminho = `${tenantId}/${viagem.id}/${id}.${anexo.extensao}`;
      const linha = { id, viagem_id: viagem.id, tipo, arquivo_path: caminho };
      const descricao = tipo === 'canhoto' ? 'Canhoto' : 'Documento';
      await registrar({
        registros: [{ tabela: 'documentos', linha: { ...linha, enviado_em: new Date().toISOString() }, pendente: true }],
        itens: [
          { op: 'upload', origem: anexo.uri, destino: caminho, tipoConteudo: anexo.tipoConteudo, descricao: `Arquivo: ${descricao}`, registroId: id },
          { op: 'inserir', tabela: 'documentos', linha, descricao, registroId: id },
        ],
      });
    },

    criarViagem: async (d, kmInicial) => {
      if (kmInicial !== undefined && dados.viagens.some((v) => v.status === 'em_andamento')) {
        throw new Error('Finalize a viagem em andamento antes de iniciar outra.');
      }
      const id = Crypto.randomUUID();
      const iniciadaEm = new Date().toISOString();
      const m = dados.perfil.motorista;
      const percentual = m?.modelo_remuneracao === 'comissionado' ? m.comissao_percentual : 0;
      const viagem: ViagemMotorista = {
        id,
        ...d,
        status: kmInicial === undefined ? 'programada' : 'em_andamento',
        forma_pagamento_frete: null as never,
        km_inicial: (kmInicial ?? null) as never,
        km_final: null as never,
        valor_frete_total: d.valor_frete,
        comissao_percentual: percentual,
        comissao_valor: percentualDe(d.valor_frete, percentual),
        valor_adiantamento: 0, // só o gestor define (spec do gestor 5a)
        adiantamento_gasto: 0,
        adiantamento_saldo: 0,
        adiantamento_acertado: false,
        gasto_proprio_bolso: 0,
        iniciada_em: (kmInicial === undefined ? null : iniciadaEm) as never,
        data_hora_chegada: null as never,
        local_chegada: null as never,
        observacoes_finais: null as never,
        editavel: kmInicial === undefined,
        atualizado_em: new Date().toISOString(),
      } as ViagemMotorista;
      const itens: ItemNovo[] = [{
          op: 'rpc',
          funcao: 'criar_viagem_motorista',
          args: {
            p_id: id, p_veiculo_id: d.veiculo_id, p_origem: d.origem, p_destino: d.destino, p_valor_frete: d.valor_frete,
            p_data_prevista: d.data_prevista, p_cliente: d.cliente, p_carga: d.carga, p_observacoes: d.observacoes,
          },
          descricao: `Nova viagem ${d.origem} → ${d.destino}`,
          registroId: null,
        }];
      if (kmInicial !== undefined) {
        itens.push({
          op: 'rpc',
          funcao: 'iniciar_viagem',
          args: { p_viagem_id: id, p_km_inicial: kmInicial, p_iniciada_em: iniciadaEm },
          descricao: `Início da viagem ${d.origem} → ${d.destino}`,
          registroId: null,
        });
      }
      await registrar({ viagem, itens });
      return id;
    },

    editarViagem: (viagem, d) =>
      registrar({
        viagem: {
          ...viagem,
          ...d,
          valor_frete_total: d.valor_frete,
          comissao_valor: percentualDe(d.valor_frete, viagem.comissao_percentual),
        } as ViagemMotorista,
        itens: [{
          op: 'rpc',
          funcao: 'editar_viagem_motorista',
          args: {
            p_id: viagem.id, p_veiculo_id: d.veiculo_id, p_origem: d.origem, p_destino: d.destino, p_valor_frete: d.valor_frete,
            p_data_prevista: d.data_prevista, p_cliente: d.cliente, p_carga: d.carga, p_observacoes: d.observacoes,
          },
          descricao: `Edição da viagem ${d.origem} → ${d.destino}`,
          registroId: null,
        }],
      }),

    iniciarViagem: async (viagem, kmInicial) => {
      if (dados.viagens.some((v) => v.status === 'em_andamento' && v.id !== viagem.id)) {
        throw new Error('Finalize a viagem em andamento antes de iniciar outra.');
      }
      const iniciadaEm = new Date().toISOString();
      await registrar({
        viagem: { ...viagem, status: 'em_andamento', km_inicial: kmInicial, iniciada_em: iniciadaEm, editavel: false },
        itens: [{
          op: 'rpc',
          funcao: 'iniciar_viagem',
          args: { p_viagem_id: viagem.id, p_km_inicial: kmInicial, p_iniciada_em: iniciadaEm },
          descricao: `Início da viagem ${viagem.origem} → ${viagem.destino}`,
          registroId: null,
        }],
      });
    },

    finalizarViagem: (viagem, d) =>
      registrar({
        // guarda os valores ao vivo: é o que o Histórico mostra até o servidor responder
        viagem: { ...viagemAoVivo(viagem, dados.registros), ...d, status: 'finalizada' } as ViagemMotorista,
        itens: [{
          op: 'rpc',
          funcao: 'finalizar_viagem',
          args: {
            p_viagem_id: viagem.id, p_km_final: d.km_final, p_data_hora_chegada: d.data_hora_chegada,
            p_local_chegada: d.local_chegada, p_observacoes_finais: d.observacoes_finais,
          },
          descricao: `Finalização da viagem ${viagem.origem} → ${viagem.destino}`,
          registroId: null,
        }],
      }),

    tentarDeNovo: async (item) => {
      await armazem.marcarErro(item.seq, null);
      await recarregarLocal();
      await sincronizar();
    },

    descartar: async (item) => {
      await descartarItem(item);
      await recarregarLocal();
      await sincronizar();
    },
  };

  return <MotoristaContext value={valor}>{children}</MotoristaContext>;
}
