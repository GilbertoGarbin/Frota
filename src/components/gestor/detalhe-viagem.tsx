import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { FormAbastecimentoGestor, FormDespesaGestor, FormDocumentoGestor } from '@/components/gestor/lancamentos-viagem';
import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { CampoData } from '@/components/ui/campo-data';
import { Faixa, Grade, Indicador, ItemFaixa, Secao, SecaoRecolhivel } from '@/components/ui/cartao';
import { Seletor } from '@/components/ui/seletor';
import { Selo } from '@/components/ui/selo';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import {
  atualizarComplementoGestor,
  atualizarViagem,
  carregarDetalheViagem,
  excluirComplemento,
  excluirViagem,
  finalizarViagemGestor,
  iniciarViagemGestor,
  lancarComplementoGestor,
  marcarPago,
  pagaDireto,
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
      </View>

      <Faixa>
        <ItemFaixa rotulo="Frete bruto" valor={formatarMoeda(v.valor_frete_total)} detalhe={notaDoFrete(dados)} />
        <ItemFaixa
          rotulo="Combustível"
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
        <ItemFaixa
          rotulo="Comissão"
          valor={formatarMoeda(v.comissao_valor)}
          detalhe={v.comissao_percentual > 0 ? `${formatarDecimal(v.comissao_percentual)}% do frete` : 'Motorista assalariado'}
        />
        <ItemFaixa rotulo="Outras despesas" valor={formatarMoeda(v.total_despesas)} />
        <ItemFaixa
          rotulo="Margem"
          tom={status === 'finalizada' ? tomDaMargem(margem) : 'neutro'}
          valor={status === 'finalizada' ? formatarMoeda(v.resultado_operacional) : '—'}
          detalhe={status === 'finalizada' ? formatarPercentual(margem) : 'Disponível ao finalizar'}
        />
      </Faixa>

      <View style={styles.percurso}>
        <View style={styles.percursoLinha}>
          <Text style={styles.percursoRotulo}>Percurso</Text>
          <Dado rotulo="Km inicial" valor={formatarKm(v.km_inicial)} />
          <Dado rotulo="Km final" valor={formatarKm(v.km_final)} />
          {v.km_inicial !== null && v.km_final !== null ? (
            <Dado rotulo="Rodado" valor={formatarKm(v.km_final - v.km_inicial)} />
          ) : null}
          {status === 'em_andamento' && operacao === null ? (
            <View style={[styles.linha, styles.percursoAcoes]}>
              <Botao titulo="Finalizar viagem" compacto onPress={() => setOperacao('finalizar')} />
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
          <FormOperacao
            operacao={operacao}
            viagem={v}
            temCanhoto={dados.documentos.some((d) => d.tipo === 'canhoto')}
            aoConcluir={() => {
              setOperacao(null);
              recarregar();
            }}
            aoCancelar={() => setOperacao(null)}
          />
        ) : null}
        {v.iniciada_em || v.data_hora_chegada ? (
          <Text style={styles.suave}>
            {[
              v.iniciada_em ? `Iniciada em ${formatarDataHora(v.iniciada_em)}` : null,
              v.data_hora_chegada
                ? `Chegada em ${formatarDataHora(v.data_hora_chegada)}${v.local_chegada ? ` · ${v.local_chegada}` : ''}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
        {v.observacoes ? <Text style={styles.suave}>Observações: {v.observacoes}</Text> : null}
        {v.observacoes_finais ? <Text style={styles.suave}>Observações finais: {v.observacoes_finais}</Text> : null}
      </View>

      <BlocoRegistros
        dados={dados}
        aoErro={setErroAcao}
        placa={placa}
        aoLancar={recarregar}
        aoMarcarPago={(tabela, id, pago) => executar(() => marcarPago(tabela, id, pago))}
      />

      {status === 'finalizada' && (v.valor_adiantamento > 0 || v.gasto_proprio_bolso > 0) ? (
        <BlocoPrestacao
          viagem={v}
          aoMarcar={(acertado) => executar(() => atualizarViagem(v.id, { adiantamento_acertado: acertado }))}
        />
      ) : null}

      {/* raramente usados: no fim, lado a lado no computador */}
      <View style={styles.ladoALado}>
        <View style={styles.metade}>
          <BlocoAdiantamento viagem={v} aoSalvar={(valor) => executar(() => atualizarViagem(v.id, { valor_adiantamento: valor }))} />
        </View>
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
      ) : null}

      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {editando ? (
        <Text style={estilosAdiant.sugestao}>
          {`${textoSugestao} Se o motorista já iniciou a viagem, o valor novo aparece no app dele.`}
        </Text>
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
      resumo={resumoLista(complementos.length, 'valor adicional', 'valores adicionais', somar(complementos.map((c) => c.valor)))}
      acao={
        editavel && !aberto ? (
          <Botao titulo="+ Lançar valor adicional" variante="contorno" compacto onPress={() => setAberto(true)} />
        ) : undefined
      }
      topo={
        aberto ? (
          <View style={styles.formulario}>
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
        ) : null
      }>
      {complementos.length === 0 ? (
        <Text style={styles.suave}>Nenhum valor adicional lançado.</Text>
      ) : (
        complementos.map((c) => (
          <View key={c.id} style={styles.item}>
            <View style={styles.itemTexto}>
              <Text style={styles.texto}>
                {ROTULO_COMPLEMENTO[c.tipo as TipoComplemento]} · {formatarMoeda(c.valor)}
              </Text>
              <Text style={styles.suave}>
                {formatarData(c.data)}
                {c.cliente_carga_adicional ? ` · ${c.cliente_carga_adicional}` : ''}
                {c.descricao ? ` · ${c.descricao}` : ''}
              </Text>
            </View>
            {/* quem lançou o quê fica sempre visível (spec, seção 2) */}
            <Selo tipo={c.origem_lancamento === 'gestor' ? 'info' : 'neutro'}>
              {c.origem_lancamento === 'gestor' ? 'Lançado pela gestão' : 'Lançado pelo motorista'}
            </Selo>
            {/* a carga complementar é do motorista: o gestor remove, mas não reescreve */}
            {editavel && c.origem_lancamento === 'gestor' ? (
              <Botao titulo="Editar" variante="link" compacto onPress={() => editar(c)} />
            ) : null}
            {editavel ? <Botao titulo="Remover" variante="link" compacto onPress={() => aoExcluir(c.id)} /> : null}
          </View>
        ))
      )}
    </SecaoRecolhivel>
  );
}

function BlocoPrestacao({ viagem: v, aoMarcar }: { viagem: Viagem; aoMarcar: (acertado: boolean) => Promise<void> }) {
  const saldo = v.adiantamento_saldo ?? 0;
  return (
    <Secao titulo="Prestação de contas do adiantamento">
      <Grade>
        <Indicador rotulo="Adiantamento ao motorista" valor={formatarMoeda(v.valor_adiantamento)} />
        <Indicador rotulo="Gasto pelo motorista" valor={formatarMoeda(v.adiantamento_gasto)} />
        <Indicador
          rotulo={saldo >= 0 ? 'Saldo a devolver pelo motorista' : 'Saldo a reembolsar ao motorista'}
          tom="destaque"
          valor={formatarMoeda(Math.abs(saldo))}
        />
        {v.gasto_proprio_bolso > 0 ? (
          <Indicador
            rotulo="Pago do próprio bolso"
            valor={formatarMoeda(v.gasto_proprio_bolso)}
            detalhe="A reembolsar ao motorista, além do saldo do adiantamento."
          />
        ) : null}
      </Grade>
      {v.adiantamento_acertado ? (
        <View style={styles.linha}>
          <Selo tipo="sucesso">{`Acertado em ${formatarData(v.adiantamento_acertado_em)}`}</Selo>
          <Botao titulo="Desfazer" variante="link" compacto onPress={() => aoMarcar(false)} />
        </View>
      ) : (
        <Botao titulo="Marcar como acertado" compacto onPress={() => aoMarcar(true)} />
      )}
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
function seloAPagar(itens: { forma_pagamento: string; pago_em: string | null; valor: number }[]) {
  const pendentes = itens.filter((i) => pagaDireto(i.forma_pagamento) && !i.pago_em);
  if (pendentes.length === 0) return null;
  return <Selo tipo="aviso">{`${formatarMoeda(somar(pendentes.map((i) => i.valor)))} a pagar`}</Selo>;
}

type PropsRegistros = {
  dados: Detalhe;
  placa: string;
  aoErro: (mensagem: string) => void;
  aoLancar: () => void;
  aoMarcarPago: (tabela: 'abastecimentos' | 'despesas', id: string, pago: boolean) => void;
};

type PagamentoDireto = { forma_pagamento: string; chave_pix: string | null; vencimento: string | null; pago_em: string | null };

/** PIX ou nota a prazo pagos pela empresa: situação e botão para marcar como pago. */
type PropsOperacao = {
  operacao: 'iniciar' | 'finalizar';
  viagem: Viagem;
  temCanhoto: boolean;
  aoConcluir: () => void;
  aoCancelar: () => void;
};

/** Iniciar (km inicial) ou finalizar (km final, chegada) a viagem pelo painel. */
function FormOperacao({ operacao, viagem, temCanhoto, aoConcluir, aoCancelar }: PropsOperacao) {
  const iniciar = operacao === 'iniciar';
  const [km, setKm] = useState('');
  const [data, setData] = useState(formatarData(hojeIso()));
  const [local, setLocal] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    const kmLido = lerDecimal(km);
    const dataIso = lerData(data);
    if (kmLido === null || Number.isNaN(kmLido)) return setErro(iniciar ? 'Informe o km inicial.' : 'Informe o km final.');
    if (!dataIso) return setErro('Data inválida. Use dia/mês/ano.');
    if (!iniciar && viagem.km_inicial !== null && kmLido < viagem.km_inicial) {
      return setErro(`O km final não pode ser menor que o km inicial (${formatarKm(viagem.km_inicial)}).`);
    }
    setErro(null);
    setSalvando(true);
    try {
      if (iniciar) await iniciarViagemGestor(viagem.id, kmLido, dataIso);
      else {
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
    <View style={styles.formulario}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {!iniciar && !temCanhoto ? (
        <Aviso tipo="info">
          Para finalizar, anexe antes o canhoto em Documentos (+ Adicionar documento, tipo Canhoto).
        </Aviso>
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

function SituacaoPagamento({ item, aoMarcar }: { item: PagamentoDireto; aoMarcar: (pago: boolean) => void }) {
  if (!pagaDireto(item.forma_pagamento)) return null;
  return (
    <View style={[styles.linha, styles.situacao]}>
      {item.pago_em ? (
        <>
          <Selo tipo="sucesso">{`Pago em ${formatarData(item.pago_em)}`}</Selo>
          <Botao titulo="Desfazer" variante="link" compacto onPress={() => aoMarcar(false)} />
        </>
      ) : (
        <>
          <Selo tipo="aviso">A pagar</Selo>
          {item.chave_pix ? <Text selectable style={styles.suave}>{`PIX: ${item.chave_pix}`}</Text> : null}
          {item.vencimento ? <Text style={styles.suave}>{`Vence em ${formatarData(item.vencimento)}`}</Text> : null}
          <Botao titulo="Marcar como pago" variante="contorno" compacto onPress={() => aoMarcar(true)} />
        </>
      )}
    </View>
  );
}

function BlocoRegistros({ dados, placa, aoErro, aoLancar, aoMarcarPago }: PropsRegistros) {
  const { viagem, abastecimentos, despesas, paradas, documentos } = dados;
  // qual formulário de lançamento está aberto (um por vez)
  const [aberto, setAberto] = useState<'abastecimento' | 'despesa' | 'documento' | null>(null);
  const fechar = () => setAberto(null);
  const salvo = () => {
    setAberto(null);
    aoLancar();
  };
  const botaoLancar = (qual: NonNullable<typeof aberto>, titulo: string) =>
    aberto === qual ? undefined : <Botao titulo={titulo} variante="contorno" compacto onPress={() => setAberto(qual)} />;

  async function abrir(caminho: string) {
    try {
      await Linking.openURL(await urlDoArquivo(caminho));
    } catch (e) {
      aoErro(mensagemDeErro(e));
    }
  }
  const comprovante = (caminho: string | null) =>
    caminho ? <Botao titulo="Comprovante" variante="link" compacto onPress={() => abrir(caminho)} /> : null;

  return (
    <>
      <SecaoRecolhivel
        titulo="Abastecimentos"
        resumo={resumoLista(abastecimentos.length, 'abastecimento', 'abastecimentos', somar(abastecimentos.map((a) => a.total)))}
        extra={seloAPagar(abastecimentos.map((a) => ({ ...a, valor: a.total ?? 0 })))}
        acao={botaoLancar('abastecimento', '+ Lançar abastecimento')}
        topo={
          aberto === 'abastecimento' ? (
            <FormAbastecimentoGestor viagem={viagem} placa={placa} aoSalvar={salvo} aoCancelar={fechar} />
          ) : null
        }>
        {abastecimentos.length === 0 ? <Text style={styles.suave}>Nenhum abastecimento nesta viagem.</Text> : null}
        {abastecimentos.map((a) => (
          <View key={a.id} style={styles.item}>
            <View style={styles.itemTexto}>
              <Text style={styles.texto}>
                {formatarMoeda(a.total)} · {formatarDecimal(a.litros, a.litros % 1 === 0 ? 0 : 3)} L a {formatarDecimal(a.preco_litro, Math.round(a.preco_litro * 10_000) % 10 === 0 ? 3 : 4)}
              </Text>
              <Text style={styles.suave}>
                {formatarData(a.data)} · {formatarKm(a.km)}
                {a.posto ? ` · ${a.posto}` : ''} · {ROTULO_PAGAMENTO[a.forma_pagamento as FormaPagamento]}
              </Text>
            </View>
            {a.tanque_cheio ? <Selo tipo="info">Tanque cheio</Selo> : null}
            {comprovante(a.comprovante_path)}
            <SituacaoPagamento item={a} aoMarcar={(pago) => aoMarcarPago('abastecimentos', a.id, pago)} />
          </View>
        ))}
      </SecaoRecolhivel>

      <SecaoRecolhivel
        titulo="Despesas"
        resumo={resumoLista(despesas.length, 'despesa', 'despesas', somar(despesas.map((d) => d.valor)), 'Nenhuma despesa')}
        extra={seloAPagar(despesas)}
        acao={botaoLancar('despesa', '+ Lançar despesa')}
        topo={aberto === 'despesa' ? <FormDespesaGestor viagem={viagem} aoSalvar={salvo} aoCancelar={fechar} /> : null}>
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
            <SituacaoPagamento item={d} aoMarcar={(pago) => aoMarcarPago('despesas', d.id, pago)} />
          </View>
        ))}
      </SecaoRecolhivel>

      {paradas.length > 0 ? (
        <SecaoRecolhivel titulo="Paradas" resumo={`${paradas.length} ${paradas.length === 1 ? 'parada' : 'paradas'}`}>
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

      <SecaoRecolhivel
        titulo="Documentos"
        resumo={documentos.length === 0 ? 'Nenhum documento' : `${documentos.length} ${documentos.length === 1 ? 'documento' : 'documentos'}`}
        extra={
          documentos.some((d) => d.tipo === 'canhoto') ? <Selo tipo="sucesso">Canhoto enviado</Selo> : null
        }
        acao={botaoLancar('documento', '+ Adicionar documento')}
        topo={aberto === 'documento' ? <FormDocumentoGestor viagem={viagem} aoSalvar={salvo} aoCancelar={fechar} /> : null}>
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
    </>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
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
  itemTexto: { flex: 1, minWidth: 200, gap: 2 },
});
