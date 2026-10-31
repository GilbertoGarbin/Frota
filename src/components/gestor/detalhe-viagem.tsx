import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { FormAbastecimentoGestor, FormDespesaGestor, FormDocumentoGestor } from '@/components/gestor/lancamentos-viagem';
import { Pagina } from '@/components/gestor/pagina';
import { CampoAnexo } from '@/components/motorista/base';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { BotaoIcone } from '@/components/ui/botao-icone';
import { Campo } from '@/components/ui/campo';
import { CampoData } from '@/components/ui/campo-data';
import { CartaoResumo, Grade, Secao, SecaoRecolhivel } from '@/components/ui/cartao';
import { Janela } from '@/components/ui/janela';
import { Seletor } from '@/components/ui/seletor';
import { Selo } from '@/components/ui/selo';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';
import { useCarregar } from '@/hooks/use-carregar';
import type { Anexo } from '@/services/anexo.service';
import {
  gerarRecebimentos,
  situacaoDaConta,
  type Pagamento,
  type Recebimento,
} from '@/services/financeiro.service';
import { enviarDocumentoGestor } from '@/services/lancamentos-gestor.service';
import {
  atualizarComplementoGestor,
  atualizarViagem,
  carregarDetalheViagem,
  excluirComplemento,
  excluirViagem,
  finalizarViagemGestor,
  iniciarViagemGestor,
  lancarComplementoGestor,
  ROTULO_COMPLEMENTO,
  ROTULO_PAGAMENTO,
  ROTULO_STATUS,
  sugerirAdiantamento,
  TIPOS_DO_GESTOR,
  urlDoArquivo,
  type Complemento,
  type DetalheViagem as Detalhe,
  type FormaPagamento,
  type StatusViagem,
  type TipoComplemento,
  type Viagem,
} from '@/services/viagens.service';
import { somar } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import {
  formatarData,
  formatarDataHora,
  formatarDecimal,
  formatarKm,
  formatarMoeda,
  formatarPercentual,
  hojeIso,
  lerData,
  lerDecimal,
  mascararDecimal,
  mascararInteiro,
} from '@/utils/formato';

type Props = {
  viagemId: string;
  nomeMotorista: string;
  placa: string;
  aoVoltar: () => void;
  aoEditar: (viagem: Viagem) => void;
};

/** Farol da margem (spec do gestor 6.3/6.5): ≥ 30% saudável, < 10% baixa. */
export function tomDaMargem(percentual: number | null): 'sucesso' | 'perigo' | 'neutro' {
  if (percentual === null) return 'neutro';
  if (percentual >= 30) return 'sucesso';
  if (percentual < 10) return 'perigo';
  return 'neutro';
}

// cor só do cartão de total (texto grande e em negrito, contraste suficiente)
const LARANJA = '#D97706';
// Cor por significado: azul entra, laranja sai, cinza sem dinheiro ou zerado; verde/vermelho só na margem.
const corDeSaida = (valor: number | null) => ((valor ?? 0) > 0 ? LARANJA : Cores.textoSuave);

const COR_DA_MARGEM = {
  sucesso: { cor: Cores.sucessoTexto, fundo: Cores.sucessoFundo },
  perigo: { cor: Cores.perigo, fundo: Cores.perigoFundo },
  neutro: { cor: Cores.texto },
} as const;

export function margemPercentual(v: Viagem): number | null {
  if (v.status !== 'finalizada' || !v.valor_frete_total || v.resultado_operacional === null) return null;
  return Math.round((v.resultado_operacional * 1000) / v.valor_frete_total) / 10;
}

export function SeloCombustivel({ status }: { status: string | null }) {
  if (status === 'apurado') return <Selo tipo="sucesso">Apurado</Selo>;
  if (status === 'estimado') return <Selo tipo="neutro">Estimado</Selo>;
  return null;
}

export function DetalheViagem({ viagemId, nomeMotorista, placa, aoVoltar, aoEditar }: Props) {
  const buscar = useCallback(() => carregarDetalheViagem(viagemId), [viagemId]);
  const { dados, erro, recarregar } = useCarregar(buscar);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);
  // iniciar/finalizar pelo painel (motorista sem app, esquecimento, viagem antiga)
  const [operacao, setOperacao] = useState<'iniciar' | 'finalizar' | null>(null);

  async function executar(acao: () => Promise<void>) {
    setErroAcao(null);
    try {
      await acao();
      recarregar();
    } catch (e) {
      setErroAcao(mensagemDeErro(e));
    }
  }

  if (!dados) {
    return (
      <Pagina titulo="Detalhe da viagem" acao={<Botao titulo="Voltar" variante="contorno" compacto onPress={aoVoltar} />}>
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : <ActivityIndicator color={Cores.primaria} />}
      </Pagina>
    );
  }

  const { viagem: v } = dados;
  const status = v.status as StatusViagem;
  const margem = margemPercentual(v);

  return (
    <Pagina
      titulo={`${v.origem} → ${v.destino}`}
      subtitulo={`${nomeMotorista} · ${placa} · ${formatarData(v.data_prevista)}`}
      subtituloAoLado
      acao={<Botao titulo="Voltar" variante="contorno" compacto onPress={aoVoltar} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {erroAcao ? <Aviso tipo="erro">{erroAcao}</Aviso> : null}

      <View style={styles.linha}>
        <Selo tipo={status === 'finalizada' ? 'sucesso' : status === 'em_andamento' ? 'aviso' : 'info'}>
          {ROTULO_STATUS[status]}
        </Selo>
        {v.cliente ? <Text style={styles.suave}>Cliente: {v.cliente}</Text> : null}
        {v.carga ? <Text style={styles.suave}>Carga: {v.carga}</Text> : null}
        {v.forma_pagamento_frete ? <Text style={styles.suave}>Pagamento do frete: {v.forma_pagamento_frete}</Text> : null}
        {v.exige_canhoto ? null : <Text style={styles.suave}>Não exige canhoto</Text>}
      </View>

      <Grade>
        <CartaoResumo
          estreito
          rotulo="Frete bruto"
          cor={Cores.primaria}
          valor={formatarMoeda(v.valor_frete_total)}
          detalhe={notaDoFrete(dados)}
        />
        <CartaoResumo
          estreito
          rotulo="Combustível"
          cor={corDeSaida(v.combustivel_valor)}
          valor={formatarMoeda(v.combustivel_valor)}
          extra={<SeloCombustivel status={v.combustivel_status} />}
          detalhe={
            v.combustivel_status === 'estimado'
              ? 'Km rodado × consumo médio; corrige no próximo tanque cheio.'
              : v.combustivel_status === 'apurado'
                ? 'Rateado dos abastecimentos com tanque cheio.'
                : 'Calculado ao finalizar.'
          }
        />
        <CartaoResumo
          estreito
          rotulo="Comissão"
          cor={corDeSaida(v.comissao_valor)}
          valor={formatarMoeda(v.comissao_valor)}
          detalhe={v.comissao_percentual > 0 ? `${formatarDecimal(v.comissao_percentual)}% do frete` : 'Motorista assalariado'}
        />
        <CartaoResumo estreito rotulo="Outras despesas" cor={corDeSaida(v.total_despesas)} valor={formatarMoeda(v.total_despesas)} />
        <CartaoResumo
          estreito
          rotulo="Margem"
          {...COR_DA_MARGEM[status === 'finalizada' ? tomDaMargem(margem) : 'neutro']}
          valor={status === 'finalizada' ? formatarMoeda(v.resultado_operacional) : '—'}
          detalhe={status === 'finalizada' ? formatarPercentual(margem) : 'Disponível ao finalizar'}
        />
      </Grade>

      <View style={styles.percurso}>
        <View style={styles.percursoLinha}>
          <Text style={styles.percursoRotulo}>Percurso</Text>
          <Dado rotulo="Km inicial" valor={formatarKm(v.km_inicial)} />
          <Dado rotulo="Km final" valor={formatarKm(v.km_final)} />
          {v.km_inicial !== null && v.km_final !== null ? (
            <Dado rotulo="Rodado" valor={formatarKm(v.km_final - v.km_inicial)} />
          ) : null}
          {v.iniciada_em ? <Dado rotulo="Iniciada" valor={formatarDataHora(v.iniciada_em)} /> : null}
          {v.data_hora_chegada ? (
            <Dado
              rotulo="Chegada"
              valor={`${formatarDataHora(v.data_hora_chegada)}${v.local_chegada ? ` · ${v.local_chegada}` : ''}`}
            />
          ) : null}
          {status === 'em_andamento' && operacao === null ? (
            <View style={[styles.linha, styles.percursoAcoes]}>
              <Botao titulo="Finalizar viagem" compacto onPress={() => setOperacao('finalizar')} />
              <Botao titulo="Editar viagem" variante="contorno" compacto onPress={() => aoEditar(v)} />
            </View>
          ) : null}
          {status === 'finalizada' ? (
            <View style={[styles.linha, styles.percursoAcoes]}>
              <Botao titulo="Editar viagem" variante="contorno" compacto onPress={() => aoEditar(v)} />
            </View>
          ) : null}
          {status === 'programada' && operacao === null ? (
            <View style={[styles.linha, styles.percursoAcoes]}>
              <Botao titulo="Iniciar viagem" compacto onPress={() => setOperacao('iniciar')} />
              <Botao titulo="Editar viagem" variante="contorno" compacto onPress={() => aoEditar(v)} />
              {confirmandoExcluir ? (
                <>
                  <Botao
                    titulo="Confirmar exclusão"
                    variante="perigo"
                    compacto
                    onPress={() =>
                      executar(async () => {
                        await excluirViagem(v.id);
                        aoVoltar();
                      })
                    }
                  />
                  <Botao titulo="Cancelar" variante="link" compacto onPress={() => setConfirmandoExcluir(false)} />
                </>
              ) : (
                <Botao titulo="Excluir viagem" variante="link" compacto onPress={() => setConfirmandoExcluir(true)} />
              )}
            </View>
          ) : null}
        </View>
        {operacao ? (
          <Janela
            visivel
            titulo={operacao === 'iniciar' ? 'Iniciar viagem' : 'Finalizar viagem'}
            aoFechar={() => setOperacao(null)}>
            <FormOperacao
              operacao={operacao}
              viagem={v}
              faltaCanhoto={v.exige_canhoto && !dados.documentos.some((d) => d.tipo === 'canhoto')}
              aoConcluir={() => {
                setOperacao(null);
                recarregar();
              }}
              aoCancelar={() => setOperacao(null)}
            />
          </Janela>
        ) : null}
        {v.observacoes ? <Text style={styles.suave}>Observações: {v.observacoes}</Text> : null}
        {v.observacoes_finais ? <Text style={styles.suave}>Observações finais: {v.observacoes_finais}</Text> : null}
      </View>

      <BlocoRecebimentos
        viagem={v}
        recebimentos={dados.recebimentos}
        aoGerar={() => executar(() => gerarRecebimentos(v.id))}
      />

      <BlocoRegistros
        dados={dados}
        aoErro={setErroAcao}
        placa={placa}
        aoLancar={recarregar}
      />

      {status === 'finalizada' && (v.valor_adiantamento > 0 || v.gasto_proprio_bolso > 0) ? (
        <BlocoPrestacao
          viagem={v}
          aoMarcar={(acertado) => executar(() => atualizarViagem(v.id, { adiantamento_acertado: acertado }))}
        />
      ) : null}

      {/* raramente usados: no fim, lado a lado no computador */}
      <View style={styles.ladoALado}>
        {/* finalizada: o adiantamento não muda mais e os valores já estão na prestação de contas */}
        {status === 'finalizada' && (v.valor_adiantamento > 0 || v.gasto_proprio_bolso > 0) ? null : (
          <View style={styles.metade}>
            <BlocoAdiantamento viagem={v} aoSalvar={(valor) => executar(() => atualizarViagem(v.id, { valor_adiantamento: valor }))} />
          </View>
        )}
        <View style={styles.metade}>
          <BlocoComplementos
            viagem={v}
            complementos={dados.complementos}
            aoLancar={(c) => executar(() => lancarComplementoGestor(v.id, c))}
            aoAtualizar={(id, c) => executar(() => atualizarComplementoGestor(id, c))}
            aoExcluir={(id) => executar(() => excluirComplemento(id))}
          />
        </View>
      </View>
    </Pagina>
  );
}

// "Nunca esconder a composição do valor" (spec do gestor 6.3)
function notaDoFrete({ viagem, complementos }: Detalhe): string | undefined {
  if (complementos.length === 0) return undefined;
  const porTipo = new Map<TipoComplemento, number[]>();
  for (const c of complementos) {
    const tipo = c.tipo as TipoComplemento;
    porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), c.valor]);
  }
  const partes = [...porTipo].map(
    ([tipo, valores]) => `${formatarMoeda(somar(valores))} de ${ROTULO_COMPLEMENTO[tipo].toLowerCase()}`,
  );
  return `Frete base ${formatarMoeda(viagem.valor_frete)}. Inclui ${partes.join(' e ')}.`;
}

function BlocoAdiantamento({ viagem, aoSalvar }: { viagem: Viagem; aoSalvar: (valor: number) => Promise<void> }) {
  const buscar = useCallback(() => sugerirAdiantamento(viagem.origem, viagem.destino), [viagem.origem, viagem.destino]);
  const { dados: sugestao } = useCarregar(buscar);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(formatarDecimal(viagem.valor_adiantamento));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const travado = viagem.status === 'finalizada';
  const definido = viagem.valor_adiantamento > 0;

  async function salvar() {
    const novo = lerDecimal(valor) ?? 0;
    if (Number.isNaN(novo)) return setErro('Valor inválido.');
    setErro(null);
    setSalvando(true);
    await aoSalvar(novo);
    setSalvando(false);
    setEditando(false);
  }

  const textoSugestao =
    sugestao === undefined
      ? 'Buscando a média da rota…'
      : sugestao?.valor != null
        ? `Sugerido: ${formatarMoeda(sugestao.valor)} · média de ${sugestao.quantidade} ${sugestao.quantidade === 1 ? 'viagem' : 'viagens'} nesta rota`
        : 'Sem histórico nesta rota para sugerir um valor.';

  return (
    <View style={styles.percurso}>
      <View style={styles.cabecalhoCartao}>
        <Text style={styles.percursoRotulo}>Adiantamento ao motorista</Text>
        {!travado && !editando ? (
          <Botao titulo={definido ? 'Alterar' : 'Definir'} variante="contorno" compacto onPress={() => setEditando(true)} />
        ) : null}
      </View>
      <View style={styles.percursoLinha}>
        <Dado rotulo="Valor" valor={definido ? formatarMoeda(viagem.valor_adiantamento) : 'Sem adiantamento'} />
        {definido && viagem.status !== 'programada' ? (
          <>
            <Dado rotulo="Gasto" valor={formatarMoeda(viagem.adiantamento_gasto)} />
            <Dado
              rotulo="Saldo"
              valor={formatarMoeda(viagem.adiantamento_saldo)}
              negativo={(viagem.adiantamento_saldo ?? 0) < 0}
            />
          </>
        ) : null}
      </View>

      {editando ? (
        <Janela visivel titulo="Adiantamento ao motorista" aoFechar={() => setEditando(false)}>
          <View style={estilosAdiant.edicao}>
            <View style={estilosAdiant.campo}>
              <Campo
                rotulo="Novo valor (R$)"
                value={valor}
                onChangeText={(t) => setValor(mascararDecimal(t))}
                keyboardType="numeric"
                inputMode="decimal"
              />
            </View>
            {sugestao?.valor != null ? (
              <Botao
                titulo="Usar o sugerido"
                variante="link"
                compacto
                onPress={() => setValor(formatarDecimal(sugestao.valor))}
              />
            ) : null}
            <Botao titulo="Salvar" compacto onPress={salvar} carregando={salvando} />
            <Botao titulo="Cancelar" variante="link" compacto onPress={() => setEditando(false)} />
          </View>
          {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
          <Text style={estilosAdiant.sugestao}>
            {`${textoSugestao} Se o motorista já iniciou a viagem, o valor novo aparece no app dele.`}
          </Text>
        </Janela>
      ) : null}
    </View>
  );
}

const estilosAdiant = StyleSheet.create({
  edicao: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: Espaco.md },
  campo: { width: 200, maxWidth: '100%' },
  sugestao: { fontSize: 13, lineHeight: 19, color: Cores.textoSuave },
});

type PropsComplementos = {
  viagem: Viagem;
  complementos: Complemento[];
  aoLancar: (c: { tipo: TipoComplemento; valor: number; data: string; descricao: string | null }) => Promise<void>;
  aoAtualizar: (id: string, c: { tipo: TipoComplemento; valor: number; data: string; descricao: string | null }) => Promise<void>;
  aoExcluir: (id: string) => Promise<void>;
};

function BlocoComplementos({ viagem, complementos, aoLancar, aoAtualizar, aoExcluir }: PropsComplementos) {
  const [aberto, setAberto] = useState(false);
  // id do lançamento em edição; null = lançamento novo
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoComplemento>('complemento');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(formatarData(hojeIso()));
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const editavel = viagem.status !== 'finalizada';

  async function lancar() {
    const v = lerDecimal(valor);
    const d = lerData(data);
    if (v === null || Number.isNaN(v) || v <= 0) return setErro('Informe o valor.');
    if (!d) return setErro('Data inválida. Use dia/mês/ano.');
    if (tipo === 'complemento' && !descricao.trim()) {
      return setErro('Descreva o complemento: de onde para onde e o que está levando.');
    }
    setErro(null);
    const dados = { tipo, valor: v, data: d, descricao: descricao.trim() || null };
    if (editandoId) await aoAtualizar(editandoId, dados);
    else await aoLancar(dados);
    fechar();
  }

  function fechar() {
    setValor('');
    setDescricao('');
    setEditandoId(null);
    setAberto(false);
  }

  function editar(c: Complemento) {
    setEditandoId(c.id);
    setTipo(c.tipo as TipoComplemento);
    setValor(formatarDecimal(c.valor));
    setData(formatarData(c.data));
    setDescricao(c.descricao ?? '');
    setErro(null);
    setAberto(true);
  }

  return (
    <SecaoRecolhivel
      titulo="Valores adicionais ao frete"
      icone={{ nome: 'cash-plus', cor: Cores.primaria }}
      resumo={resumoLista(complementos.length, 'valor adicional', 'valores adicionais', somar(complementos.map((c) => c.valor)))}
      acao={
        editavel && !aberto ? (
          <BotaoIcone icone="plus" rotulo="Lançar valor adicional" onPress={() => setAberto(true)} />
        ) : undefined
      }>
      {complementos.length === 0 ? (
        <Text style={styles.suave}>Nenhum valor adicional lançado.</Text>
      ) : (
        // o que está sendo editado sai da lista enquanto o formulário está aberto
        complementos.filter((c) => c.id !== editandoId).map((c) => (
          <View key={c.id} style={[styles.item, styles.itemBaixo]}>
            <View style={styles.itemTexto}>
              <Text style={styles.texto}>
                {formatarMoeda(c.valor)} · {ROTULO_COMPLEMENTO[c.tipo as TipoComplemento]}
                <Text style={styles.suave}>
                  {` · ${formatarData(c.data)}`}
                  {c.cliente_carga_adicional ? ` · ${c.cliente_carga_adicional}` : ''}
                  {c.descricao ? ` · ${c.descricao}` : ''}
                </Text>
              </Text>
            </View>
            {/* quem lançou o quê fica sempre visível (spec, seção 2) */}
            <Selo tipo={c.origem_lancamento === 'gestor' ? 'info' : 'neutro'}>
              {c.origem_lancamento === 'gestor' ? 'Lançado pela gestão' : 'Lançado pelo motorista'}
            </Selo>
            {!editavel ? null : removendoId === c.id ? (
              <View style={styles.acoesLinha}>
                <Text style={styles.suave}>Remover?</Text>
                <Botao titulo="Sim" variante="perigo" mini onPress={() => aoExcluir(c.id).then(() => setRemovendoId(null))} />
                <Botao titulo="Não" variante="link" mini onPress={() => setRemovendoId(null)} />
              </View>
            ) : (
              <View style={styles.acoesLinha}>
                {/* a carga complementar é do motorista: o gestor remove, mas não reescreve */}
                {c.origem_lancamento === 'gestor' ? (
                  <Botao titulo="Editar" variante="link" mini onPress={() => editar(c)} />
                ) : null}
                <Botao titulo="Remover" variante="link" mini onPress={() => setRemovendoId(c.id)} />
              </View>
            )}
          </View>
        ))
      )}
      {aberto ? (
        <Janela visivel titulo={editandoId ? 'Editar valor adicional' : 'Novo valor adicional'} aoFechar={fechar}>
          <View style={styles.formularioJanela}>
            {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
            <View style={styles.linhaAdicional}>
              <View style={styles.campoCurto}>
                <Seletor rotulo="Tipo" opcoes={TIPOS_DO_GESTOR} valor={tipo} onChange={setTipo} />
              </View>
              <View style={styles.campoCurto}>
                <Campo
                  rotulo="Valor (R$) *"
                  value={valor}
                  onChangeText={(t) => setValor(mascararDecimal(t))}
                  keyboardType="numeric"
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </View>
              <View style={styles.campoCurto}>
                <CampoData rotulo="Data" valor={data} onChange={setData} />
              </View>
            </View>
            <View>
              {tipo === 'complemento' ? (
                <Campo
                  rotulo="Descrição *"
                  value={descricao}
                  onChangeText={setDescricao}
                  placeholder="De onde para onde e o que está levando"
                />
              ) : (
                <Campo rotulo="Observação (opcional)" value={descricao} onChangeText={setDescricao} />
              )}
            </View>
            <Text style={styles.suave}>Soma ao frete total da viagem e à base da comissão.</Text>
            <View style={styles.linha}>
              <Botao titulo={editandoId ? 'Salvar alteração' : 'Lançar'} compacto onPress={lancar} />
              <Botao titulo="Cancelar" variante="link" compacto onPress={fechar} />
            </View>
          </View>
        </Janela>
      ) : null}
    </SecaoRecolhivel>
  );
}

function BlocoPrestacao({ viagem: v, aoMarcar }: { viagem: Viagem; aoMarcar: (acertado: boolean) => Promise<void> }) {
  const saldo = v.adiantamento_saldo ?? 0;
  return (
    <Secao
      titulo="Prestação de contas do adiantamento"
      acao={
        v.adiantamento_acertado ? (
          <View style={styles.linha}>
            <Selo tipo="sucesso">{`Acertado em ${formatarData(v.adiantamento_acertado_em)}`}</Selo>
            <Botao titulo="Desfazer" variante="link" compacto onPress={() => aoMarcar(false)} />
          </View>
        ) : (
          <Botao titulo="Marcar como acertado" compacto onPress={() => aoMarcar(true)} />
        )
      }>
      <Grade>
        <CartaoResumo rotulo="Adiantamento ao motorista" cor={Cores.primaria} valor={formatarMoeda(v.valor_adiantamento)} />
        <CartaoResumo rotulo="Gasto pelo motorista" cor={corDeSaida(v.adiantamento_gasto)} valor={formatarMoeda(v.adiantamento_gasto)} />
        <CartaoResumo
          rotulo={saldo >= 0 ? 'Saldo a devolver pelo motorista' : 'Saldo a reembolsar ao motorista'}
          cor={saldo >= 0 ? Cores.primaria : Cores.perigo}
          fundo={saldo >= 0 ? Cores.chipClaro : Cores.perigoFundo}
          valor={formatarMoeda(Math.abs(saldo))}
        />
        {v.gasto_proprio_bolso > 0 ? (
          <CartaoResumo
            rotulo="Pago do próprio bolso"
            cor={LARANJA}
            valor={formatarMoeda(v.gasto_proprio_bolso)}
            detalhe="A reembolsar ao motorista, além do saldo do adiantamento."
          />
        ) : null}
      </Grade>
    </Secao>
  );
}

const NOME_DOCUMENTO: Record<string, string> = {
  canhoto: 'Canhoto',
  cte: 'CT-e',
  nota_fiscal: 'Nota fiscal',
  comprovante: 'Comprovante',
  outro: 'Outro documento',
};

const resumoLista = (n: number, um: string, varios: string, total: number, vazio = `Nenhum ${um}`) =>
  n === 0 ? vazio : `${n} ${n === 1 ? um : varios} · ${formatarMoeda(total)}`;

/** Selo com o que ainda falta a empresa pagar ao posto/fornecedor (PIX ou a prazo). */
function seloAPagar(pagamentos: Pagamento[]) {
  const pendentes = pagamentos.filter((p) => !p.pago_em);
  if (pendentes.length === 0) return null;
  return <Selo tipo="aviso">{`${formatarMoeda(somar(pendentes.map((p) => p.valor_final ?? p.valor)))} a pagar`}</Selo>;
}

type PropsRegistros = {
  dados: Detalhe;
  placa: string;
  aoErro: (mensagem: string) => void;
  aoLancar: () => void;
};

type PropsOperacao = {
  operacao: 'iniciar' | 'finalizar';
  viagem: Viagem;
  /** a viagem exige canhoto e ele ainda não foi anexado */
  faltaCanhoto: boolean;
  aoConcluir: () => void;
  aoCancelar: () => void;
};

/** Iniciar (km inicial) ou finalizar (km final, chegada) a viagem pelo painel. */
function FormOperacao({ operacao, viagem, faltaCanhoto, aoConcluir, aoCancelar }: PropsOperacao) {
  const iniciar = operacao === 'iniciar';
  const [km, setKm] = useState('');
  const [data, setData] = useState(formatarData(hojeIso()));
  const [local, setLocal] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { acesso } = useSessao();
  // canhoto anexado aqui mesmo, sem precisar ir ao bloco Documentos
  const [canhoto, setCanhoto] = useState<Anexo | null>(null);
  // já subiu numa tentativa anterior (finalizar falhou depois): não envia de novo
  const [canhotoEnviado, setCanhotoEnviado] = useState(false);
  const pedeCanhoto = !iniciar && faltaCanhoto;

  async function confirmar() {
    const kmLido = lerDecimal(km);
    const dataIso = lerData(data);
    if (kmLido === null || Number.isNaN(kmLido)) return setErro(iniciar ? 'Informe o km inicial.' : 'Informe o km final.');
    if (!dataIso) return setErro('Data inválida. Use dia/mês/ano.');
    if (!iniciar && viagem.km_inicial !== null && kmLido < viagem.km_inicial) {
      return setErro(`O km final não pode ser menor que o km inicial (${formatarKm(viagem.km_inicial)}).`);
    }
    if (pedeCanhoto && !canhotoEnviado && !canhoto) return setErro('Anexe o canhoto: tire a foto ou escolha o arquivo.');
    setErro(null);
    setSalvando(true);
    try {
      if (iniciar) await iniciarViagemGestor(viagem.id, kmLido, dataIso);
      else {
        if (pedeCanhoto && !canhotoEnviado && canhoto && acesso) {
          await enviarDocumentoGestor(acesso.tenantId, viagem.id, 'canhoto', canhoto);
          setCanhotoEnviado(true);
        }
        await finalizarViagemGestor(viagem.id, {
          kmFinal: kmLido,
          dataIso,
          local: local.trim() || null,
          observacoes: observacoes.trim() || null,
        });
      }
      aoConcluir();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <View style={styles.formularioJanela}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {pedeCanhoto ? (
        canhotoEnviado ? (
          <Aviso tipo="sucesso">Canhoto enviado.</Aviso>
        ) : (
          <CampoAnexo rotulo="Canhoto * (foto ou PDF)" anexo={canhoto} onChange={setCanhoto} />
        )
      ) : null}
      <View style={styles.linhaAdicional}>
        <View style={styles.campoCurto}>
          <Campo
            rotulo={iniciar ? 'Km inicial *' : 'Km final *'}
            value={km}
            onChangeText={(t) => setKm(mascararInteiro(t))}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder={iniciar ? 'Odômetro na saída' : 'Odômetro na chegada'}
          />
        </View>
        <View style={styles.campoCurto}>
          <CampoData rotulo={iniciar ? 'Data da saída' : 'Data da chegada'} valor={data} onChange={setData} />
        </View>
        {iniciar ? null : (
          <View style={styles.campoLongo}>
            <Campo rotulo="Local de chegada (opcional)" value={local} onChangeText={setLocal} />
          </View>
        )}
      </View>
      {iniciar ? null : (
        <Campo rotulo="Observações finais (opcional)" value={observacoes} onChangeText={setObservacoes} />
      )}
      <View style={styles.linha}>
        <Botao
          titulo={iniciar ? 'Confirmar saída' : 'Finalizar viagem'}
          compacto
          onPress={confirmar}
          carregando={salvando}
        />
        <Botao titulo="Cancelar" variante="link" compacto onPress={aoCancelar} />
      </View>
    </View>
  );
}

/** "Km inicial" pequeno em cima, valor embaixo */
function Dado({ rotulo, valor, negativo }: { rotulo: string; valor: string; negativo?: boolean }) {
  return (
    <View style={styles.dado}>
      <Text style={styles.dadoRotulo}>{rotulo}</Text>
      <Text style={[styles.dadoValor, negativo && styles.negativo]}>{valor}</Text>
    </View>
  );
}

type PropsRecebimentos = { viagem: Viagem; recebimentos: Recebimento[]; aoGerar: () => Promise<void> };

/** Recebimentos da viagem: parcelas da forma de recebimento e complementos (receber é em Financeiro). */
function BlocoRecebimentos({ viagem, recebimentos, aoGerar }: PropsRecebimentos) {
  const [gerando, setGerando] = useState(false);
  const temParcelas = recebimentos.some((r) => r.origem === 'frete');
  const aReceber = recebimentos.filter((r) => !r.recebido_em);
  const total = somar(recebimentos.map((r) => r.valor_final ?? r.valor));

  async function gerar() {
    setGerando(true);
    await aoGerar();
    setGerando(false);
  }
  const verConta = useVerConta('receber', viagem.id);

  return (
    <SecaoRecolhivel
      titulo="Recebimentos"
      icone={{ nome: 'arrow-down-circle-outline', cor: Cores.primaria }}
      resumo={
        recebimentos.length === 0
          ? viagem.forma_recebimento_id
            ? 'Ainda não gerados'
            : 'Sem forma de recebimento'
          : `${recebimentos.length} ${recebimentos.length === 1 ? 'recebimento' : 'recebimentos'} · ${formatarMoeda(total)}`
      }
      extra={
        aReceber.length > 0 ? (
          <Selo tipo="info">{`${formatarMoeda(somar(aReceber.map((r) => r.valor_final ?? r.valor)))} a receber`}</Selo>
        ) : null
      }
      acao={
        viagem.forma_recebimento_id ? (
          <Botao
            titulo={temParcelas ? 'Gerar de novo' : 'Gerar recebimentos'}
            variante="contorno"
            compacto
            carregando={gerando}
            onPress={gerar}
          />
        ) : undefined
      }>
      {!viagem.forma_recebimento_id ? (
        <Text style={styles.suave}>Escolha a forma de recebimento em “Editar viagem” para gerar as parcelas.</Text>
      ) : null}
      {temParcelas ? (
        <Text style={styles.suave}>“Gerar de novo” refaz as parcelas ainda não recebidas; as recebidas ficam.</Text>
      ) : null}
      {recebimentos.map((r) => {
        const situacao = situacaoDaConta(r.vencimento, r.recebido_em);
        return (
          <View key={r.id} style={[styles.item, styles.itemBaixo]}>
            <View style={styles.itemTexto}>
              <Text style={styles.texto}>
                {`${formatarMoeda(r.valor_final ?? r.valor)} · ${r.descricao}`}
                <Text style={styles.suave}>{r.vencimento ? ` · Vence em ${formatarData(r.vencimento)}` : ' · Sem data'}</Text>
              </Text>
            </View>
            {situacao === 'quitado' ? (
              <Selo tipo="sucesso">{`Recebido em ${formatarData(r.recebido_em)}`}</Selo>
            ) : situacao === 'atrasado' ? (
              <Selo tipo="perigo">Atrasado</Selo>
            ) : (
              <Selo tipo="info">A receber</Selo>
            )}
            <Botao titulo="Ver conta" variante="link" mini onPress={() => verConta(r.id)} />
          </View>
        );
      })}
    </SecaoRecolhivel>
  );
}

/** Abre a conta em Financeiro. Guarda a viagem no endereço para o "voltar" do navegador cair nela de novo. */
function useVerConta(tipo: 'receber' | 'pagar', viagemId: string) {
  const router = useRouter();
  return (conta: string) => {
    router.setParams({ viagem: viagemId });
    router.push({ pathname: tipo === 'receber' ? '/gestor/receber' : '/gestor/pagar', params: { conta } });
  };
}

/** Situação do pagamento ligado ao lançamento (marcar como pago é em Financeiro > Pagar). */
function SituacaoPagamento({ pagamento, viagemId }: { pagamento: Pagamento | undefined; viagemId: string }) {
  const verConta = useVerConta('pagar', viagemId);
  if (!pagamento) return null;
  const atrasado = situacaoDaConta(pagamento.vencimento, pagamento.pago_em) === 'atrasado';
  return (
    <View style={[styles.linha, styles.situacao]}>
      {pagamento.pago_em ? (
        <Selo tipo="sucesso">{`Pago em ${formatarData(pagamento.pago_em)}`}</Selo>
      ) : (
        <>
          <Selo tipo={atrasado ? 'perigo' : 'aviso'}>
            {pagamento.vencimento ? `A pagar · vence ${formatarData(pagamento.vencimento)}` : 'A pagar'}
          </Selo>
          {pagamento.chave_pix ? <Text selectable style={styles.suave}>{`PIX: ${pagamento.chave_pix}`}</Text> : null}
        </>
      )}
      <Botao titulo="Ver conta" variante="link" mini onPress={() => verConta(pagamento.id)} />
    </View>
  );
}

function BlocoRegistros({ dados, placa, aoErro, aoLancar }: PropsRegistros) {
  const { viagem, abastecimentos, despesas, paradas, documentos, pagamentos } = dados;
  const pagamentoDo = (campo: 'abastecimento_id' | 'despesa_id', id: string) => pagamentos.find((p) => p[campo] === id);
  // qual formulário de lançamento está aberto (um por vez)
  const [aberto, setAberto] = useState<'abastecimento' | 'despesa' | 'documento' | null>(null);
  const fechar = () => setAberto(null);
  const salvo = () => {
    setAberto(null);
    aoLancar();
  };
  const botaoLancar = (qual: NonNullable<typeof aberto>, titulo: string) => (
    <BotaoIcone icone="plus" rotulo={titulo} onPress={() => setAberto(qual)} />
  );

  async function abrir(caminho: string) {
    try {
      await Linking.openURL(await urlDoArquivo(caminho));
    } catch (e) {
      aoErro(mensagemDeErro(e));
    }
  }
  const comprovante = (caminho: string | null) =>
    caminho ? <Botao titulo="Comprovante" variante="link" mini onPress={() => abrir(caminho)} /> : null;

  return (
    <>
      <SecaoRecolhivel
        titulo="Abastecimentos"
        icone={{ nome: 'gas-station', cor: LARANJA }}
        resumo={resumoLista(abastecimentos.length, 'abastecimento', 'abastecimentos', somar(abastecimentos.map((a) => a.total)))}
        extra={seloAPagar(pagamentos.filter((p) => p.origem === 'abastecimento'))}
        acao={botaoLancar('abastecimento', 'Lançar abastecimento')}>
        {abastecimentos.length === 0 ? <Text style={styles.suave}>Nenhum abastecimento nesta viagem.</Text> : null}
        {abastecimentos.map((a) => (
          <View key={a.id} style={[styles.item, styles.itemBaixo]}>
            <View style={styles.itemTexto}>
              <Text style={styles.texto}>
                {formatarMoeda(a.total)} · {formatarDecimal(a.litros, a.litros % 1 === 0 ? 0 : 3)} L a {formatarDecimal(a.preco_litro, Math.round(a.preco_litro * 10_000) % 10 === 0 ? 3 : 4)}
                <Text style={styles.suave}>
                  {` · ${formatarData(a.data)} · ${formatarKm(a.km)}`}
                  {a.posto ? ` · ${a.posto}` : ''} · {ROTULO_PAGAMENTO[a.forma_pagamento as FormaPagamento]}
                </Text>
              </Text>
            </View>
            {a.tanque_cheio ? <Selo tipo="info">Tanque cheio</Selo> : null}
            {comprovante(a.comprovante_path)}
            <SituacaoPagamento pagamento={pagamentoDo('abastecimento_id', a.id)} viagemId={viagem.id} />
          </View>
        ))}
      </SecaoRecolhivel>

      <View style={styles.ladoALado}>
        <View style={styles.metade}>
          <SecaoRecolhivel
            titulo="Despesas"
            icone={{ nome: 'receipt-text-outline', cor: LARANJA }}
            resumo={resumoLista(despesas.length, 'despesa', 'despesas', somar(despesas.map((d) => d.valor)), 'Nenhuma despesa')}
            extra={seloAPagar(pagamentos.filter((p) => p.origem === 'despesa'))}
            acao={botaoLancar('despesa', 'Lançar despesa')}>
            {despesas.length === 0 ? <Text style={styles.suave}>Nenhuma despesa nesta viagem.</Text> : null}
            {despesas.map((d) => (
              <View key={d.id} style={styles.item}>
                <View style={styles.itemTexto}>
                  <Text style={styles.texto}>
                    {d.categoria} · {formatarMoeda(d.valor)}
                  </Text>
                  <Text style={styles.suave}>
                    {formatarData(d.data)} · {ROTULO_PAGAMENTO[d.forma_pagamento as FormaPagamento]}
                    {d.local ? ` · ${d.local}` : ''}
                    {d.descricao ? ` · ${d.descricao}` : ''}
                  </Text>
                </View>
                {comprovante(d.comprovante_path)}
                <SituacaoPagamento pagamento={pagamentoDo('despesa_id', d.id)} viagemId={viagem.id} />
              </View>
            ))}
          </SecaoRecolhivel>
        </View>
        <View style={styles.metade}>
          <SecaoRecolhivel
            titulo="Documentos"
            icone={{ nome: 'file-document-outline', cor: Cores.textoSuave }}
            resumo={documentos.length === 0 ? 'Nenhum documento' : `${documentos.length} ${documentos.length === 1 ? 'documento' : 'documentos'}`}
            extra={
              documentos.some((d) => d.tipo === 'canhoto') ? <Selo tipo="sucesso">Canhoto enviado</Selo> : null
            }
            acao={botaoLancar('documento', 'Adicionar documento')}>
            {documentos.length === 0 ? <Text style={styles.suave}>Nenhum documento enviado.</Text> : null}
            {documentos.map((d) => (
              <View key={d.id} style={styles.item}>
                <View style={styles.itemTexto}>
                  <Text style={styles.texto}>{NOME_DOCUMENTO[d.tipo] ?? d.tipo}</Text>
                  <Text style={styles.suave}>Enviado em {formatarDataHora(d.enviado_em)}</Text>
                </View>
                <Botao titulo="Abrir" variante="link" compacto onPress={() => abrir(d.arquivo_path)} />
              </View>
            ))}
          </SecaoRecolhivel>
        </View>
      </View>

      {paradas.length > 0 ? (
        <SecaoRecolhivel titulo="Paradas" icone={{ nome: 'map-marker-outline', cor: Cores.textoSuave }} resumo={`${paradas.length} ${paradas.length === 1 ? 'parada' : 'paradas'}`}>
          {paradas.map((p) => (
            <View key={p.id} style={styles.item}>
              <View style={styles.itemTexto}>
                <Text style={styles.texto}>
                  {p.local_nome} {p.avaliacao_estrelas ? '★'.repeat(p.avaliacao_estrelas) + '☆'.repeat(5 - p.avaliacao_estrelas) : ''}
                </Text>
                <Text style={styles.suave}>
                  {p.tipo} · {formatarDataHora(p.data_hora)}
                  {p.comentario ? ` · ${p.comentario}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </SecaoRecolhivel>
      ) : null}

      {aberto === 'abastecimento' ? (
        <Janela visivel titulo="Novo abastecimento" aoFechar={fechar}>
          <FormAbastecimentoGestor viagem={viagem} placa={placa} aoSalvar={salvo} aoCancelar={fechar} />
        </Janela>
      ) : null}
      {aberto === 'despesa' ? (
        <Janela visivel titulo="Nova despesa" aoFechar={fechar}>
          <FormDespesaGestor viagem={viagem} aoSalvar={salvo} aoCancelar={fechar} />
        </Janela>
      ) : null}
      {aberto === 'documento' ? (
        <Janela visivel titulo="Adicionar documento" aoFechar={fechar}>
          <FormDocumentoGestor viagem={viagem} aoSalvar={salvo} aoCancelar={fechar} />
        </Janela>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  formularioJanela: { gap: Espaco.md },
  acoesLinha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.xs },
  cabecalhoCartao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Espaco.md },
  ladoALado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: Espaco.lg },
  metade: { flexGrow: 1, flexBasis: 380, minWidth: 0 },
  // valores adicionais: valor e data estreitos, a descrição ocupa o resto
  linhaAdicional: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.md },
  campoCurto: { flexGrow: 1, flexBasis: 140, maxWidth: 200 },
  campoLongo: { flexGrow: 1, flexBasis: 260, minWidth: 0 },
  percurso: {
    gap: Espaco.sm,
    paddingHorizontal: Espaco.lg,
    paddingVertical: Espaco.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  percursoLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: Espaco.xl, rowGap: Espaco.sm },
  percursoRotulo: { fontSize: 16, fontWeight: '700', color: Cores.texto },
  percursoAcoes: { marginLeft: 'auto' },
  dado: { gap: 1 },
  dadoRotulo: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', color: Cores.textoSuave },
  dadoValor: { fontSize: 15, fontWeight: '600', color: Cores.texto },
  negativo: { color: Cores.perigo },
  // no celular a situação do pagamento quebra linha em vez de passar da borda
  situacao: { flexShrink: 1, maxWidth: '100%' },
  texto: { fontSize: 14, color: Cores.texto },
  suave: { fontSize: 13, color: Cores.textoSuave },
  formulario: { gap: Espaco.md, paddingBottom: Espaco.md, borderBottomWidth: 1, borderBottomColor: Cores.borda },
  item: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Espaco.md,
    paddingVertical: Espaco.sm,
    borderTopWidth: 1,
    borderTopColor: Cores.borda,
  },
  itemBaixo: { paddingVertical: 2 },
  itemTexto: { flex: 1, minWidth: 200, gap: 2 },
});
