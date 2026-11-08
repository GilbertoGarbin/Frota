import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { CampoData } from '@/components/ui/campo-data';
import { CartaoResumo, Grade, Secao } from '@/components/ui/cartao';
import { Janela } from '@/components/ui/janela';
import { LinhaForm } from '@/components/ui/linha-form';
import { Mensagem, type ConteudoMensagem } from '@/components/ui/mensagem';
import { Segmentado } from '@/components/ui/segmentado';
import { Seletor } from '@/components/ui/seletor';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import {
  CATEGORIAS_CUSTO_FIXO,
  excluirCustoFixo,
  listarCustosFixos,
  rotuloCategoriaCustoFixo,
  salvarCustoFixo,
  type CategoriaCustoFixo,
  type CustoFixo,
} from '@/services/gestao.service';
import { listarVeiculos, type Veiculo } from '@/services/veiculos.service';
import { emCentavos, emReais, somar } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import {
  formatarData,
  formatarDecimal,
  formatarMoeda,
  hojeIso,
  lerData,
  lerDecimal,
  mascararDecimal,
  mesAtual,
  periodoDoMes,
  rotuloMes,
} from '@/utils/formato';

const GERAL = 'geral';
const TODOS = 'todos';
const CAMINHOES = 'caminhoes';

const PERIODICIDADE = [
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'anual', rotulo: 'Anual' },
] as const;
type Periodicidade = (typeof PERIODICIDADE)[number]['valor'];

const COR_TOTAL = '#EC4899'; // a mesma dos custos fixos no gráfico do Financeiro
const COR_CAMINHOES = '#D97706';
const COR_GERAL = '#8B5CF6';

/** O custo vale no mês? (compara por mês, como o banco faz no resumo financeiro) */
function vigenteNoMes(custo: CustoFixo, inicioMes: string, fimMes: string): boolean {
  return custo.inicio.slice(0, 7) <= fimMes.slice(0, 7) && (!custo.fim || custo.fim.slice(0, 7) >= inicioMes.slice(0, 7));
}

async function carregarTela() {
  const [custos, veiculos] = await Promise.all([listarCustosFixos(), listarVeiculos()]);
  return { custos, veiculos };
}

// Custos Fixos — o que o caminhão custa mesmo parado: de um caminhão (parcela, seguro, IPVA…)
// ou geral da transportadora (contador, escritório…), dividido igualmente entre os caminhões ativos.
export default function CustosFixos() {
  const { dados, erro, recarregar } = useCarregar(carregarTela);
  const [editando, setEditando] = useState<CustoFixo | null | undefined>(undefined);
  // janela por cima com a lista de custos: de um caminhão (id), do geral (GERAL),
  // de todos os caminhões (CAMINHOES) ou todos (TODOS)
  const [detalhe, setDetalhe] = useState<string | null>(null);
  // custo novo aberto pela janela de detalhe já vem com o caminhão dela
  const [veiculoDoNovo, setVeiculoDoNovo] = useState<string | null>(null);

  const custos = dados?.custos ?? [];
  const veiculos = dados?.veiculos ?? [];
  const ativos = veiculos.filter((v) => v.status !== 'inativo');
  const placaDe = (id: string | null) => (id ? (veiculos.find((v) => v.id === id)?.placa ?? '—') : null);

  const mes = mesAtual();
  const { inicio, fim } = periodoDoMes(mes);
  const vigentes = custos.filter((c) => vigenteNoMes(c, inicio, fim));
  const doGeral = vigentes.filter((c) => !c.veiculo_id);
  const dosCaminhoes = vigentes.filter((c) => c.veiculo_id);
  const totalGeral = somar(doGeral.map((c) => c.valor_mensal));
  const totalCaminhoes = somar(dosCaminhoes.map((c) => c.valor_mensal));
  // só para exibir; a conta que vale (no resultado por placa) é feita no banco
  const parteGeral = ativos.length > 0 ? emReais(Math.round(emCentavos(totalGeral) / ativos.length)) : 0;

  // um cartão por caminhão ativo (e pelo inativo que ainda tem custo próprio no mês)
  const porCaminhao = veiculos
    .map((v) => {
      const ativo = v.status !== 'inativo';
      const proprio = somar(dosCaminhoes.filter((c) => c.veiculo_id === v.id).map((c) => c.valor_mensal));
      const geral = ativo ? parteGeral : 0;
      return { veiculo: v, proprio, geral, total: somar([proprio, geral]), mostrar: ativo || proprio > 0 };
    })
    .filter((x) => x.mostrar);

  const todasColunas: Coluna<CustoFixo>[] = [
    {
      titulo: 'Descrição',
      flex: 2,
      celula: (c) => (
        <View style={styles.celulaDupla}>
          <Text style={styles.forte}>{c.descricao}</Text>
          <Text style={styles.suave}>{rotuloCategoriaCustoFixo(c.categoria)}</Text>
        </View>
      ),
    },
    {
      titulo: 'Caminhão',
      celula: (c) => {
        const placa = placaDe(c.veiculo_id);
        return (
          <View style={[styles.chip, placa ? styles.chipCaminhao : styles.chipGeral]}>
            <MaterialCommunityIcons
              name={placa ? 'truck-outline' : 'office-building-outline'}
              size={14}
              color={placa ? COR_CAMINHOES : COR_GERAL}
            />
            <Text style={[styles.chipTexto, placa ? styles.chipTextoCaminhao : styles.chipTextoGeral]}>{placa ?? 'Geral'}</Text>
          </View>
        );
      },
    },
    {
      titulo: 'Por mês',
      flex: 1.3,
      celula: (c) => (
        <View style={styles.celulaDupla}>
          <Text style={styles.forte}>{formatarMoeda(c.valor_mensal)}</Text>
          <Text style={styles.suave}>
            {c.periodicidade === 'anual' && c.valor_anual != null ? `${formatarMoeda(c.valor_anual)} por ano` : 'mensal'}
          </Text>
        </View>
      ),
    },
    {
      titulo: 'Vigência',
      flex: 1.3,
      celula: (c) => `${formatarData(c.inicio).slice(3)} até ${c.fim ? formatarData(c.fim).slice(3) : 'sem fim'}`,
    },
    {
      titulo: 'Situação',
      celula: (c) =>
        vigenteNoMes(c, inicio, fim) ? <Selo tipo="sucesso">Vigente</Selo> : <Selo tipo="neutro">Fora do mês</Selo>,
    },
  ];

  // o que a janela mostra em cada caso
  const janela = (() => {
    if (detalhe === null) return null;
    const vigentesDe = (lista: CustoFixo[]) => somar(lista.filter((c) => vigenteNoMes(c, inicio, fim)).map((c) => c.valor_mensal));
    // na lista de um caminhão (ou só do geral) a coluna Caminhão seria sempre igual
    const semCaminhao = todasColunas.filter((c) => c.titulo !== 'Caminhão');
    if (detalhe === TODOS || detalhe === CAMINHOES) {
      const lista = detalhe === TODOS ? custos : custos.filter((c) => c.veiculo_id);
      return {
        titulo: detalhe === TODOS ? 'Todos os custos fixos' : 'Custos fixos ligados aos caminhões',
        subtitulo: undefined,
        rotuloTotal: `Total por mês · ${rotuloMes(mes)}`,
        total: vigentesDe(lista),
        linhaTotal: `${lista.filter((c) => vigenteNoMes(c, inicio, fim)).length} custo(s) vigente(s)`,
        lista,
        colunas: todasColunas,
        parteGeral: null,
        veiculoDoNovo: null,
        tituloNovo: '+ Novo custo fixo',
      };
    }
    if (detalhe === GERAL) {
      const lista = custos.filter((c) => !c.veiculo_id);
      return {
        titulo: 'Custos fixos gerais',
        subtitulo: 'Da transportadora inteira, divididos igualmente entre os caminhões ativos',
        rotuloTotal: `Total geral · ${rotuloMes(mes)}`,
        total: totalGeral,
        linhaTotal:
          ativos.length > 0
            ? `${formatarMoeda(parteGeral)} para cada um dos ${ativos.length} caminhão(ões) ativo(s)`
            : 'Nenhum caminhão ativo para dividir',
        lista,
        colunas: semCaminhao,
        parteGeral: null,
        veiculoDoNovo: GERAL,
        tituloNovo: '+ Custo geral',
      };
    }
    const veiculo = veiculos.find((v) => v.id === detalhe);
    const lista = custos.filter((c) => c.veiculo_id === detalhe);
    const geral = porCaminhao.find((x) => x.veiculo.id === detalhe)?.geral ?? 0;
    const proprio = vigentesDe(lista);
    return {
      titulo: `Custos fixos · ${veiculo?.placa ?? ''}`,
      subtitulo: veiculo?.modelo,
      rotuloTotal: `Quanto este caminhão custa parado · ${rotuloMes(mes)}`,
      total: somar([proprio, geral]),
      linhaTotal: `Próprio ${formatarMoeda(proprio)} + parte do geral ${formatarMoeda(geral)}`,
      lista,
      colunas: semCaminhao,
      parteGeral: totalGeral > 0 ? geral : null,
      veiculoDoNovo: detalhe,
      tituloNovo: `+ Custo para ${veiculo?.placa ?? 'o caminhão'}`,
    };
  })();

  return (
    <Pagina
      titulo="Custos Fixos"
      acao={<Botao titulo="+ Novo custo fixo" compacto onPress={() => setEditando(null)} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {dados ? (
        <>
          <Grade>
            <CartaoResumo
              rotulo={`Total por mês · ${rotuloMes(mes)}`}
              cor={COR_TOTAL}
              valor={formatarMoeda(somar(vigentes.map((c) => c.valor_mensal)))}
              detalhe={`${vigentes.length} custo(s) vigente(s) · toque para ver todos`}
              onPress={() => setDetalhe(TODOS)}
            />
            <CartaoResumo
              rotulo="Ligados aos caminhões"
              cor={COR_CAMINHOES}
              apagado={totalCaminhoes === 0}
              valor={formatarMoeda(totalCaminhoes)}
              detalhe={`${dosCaminhoes.length} custo(s) · parcela, seguro, IPVA…`}
              onPress={() => setDetalhe(CAMINHOES)}
            />
            <CartaoResumo
              rotulo="Geral da transportadora"
              cor={COR_GERAL}
              apagado={totalGeral === 0}
              valor={formatarMoeda(totalGeral)}
              detalhe={
                ativos.length > 0
                  ? `${formatarMoeda(parteGeral)} para cada caminhão ativo (${ativos.length})`
                  : 'Nenhum caminhão ativo para dividir'
              }
              onPress={() => setDetalhe(GERAL)}
            />
          </Grade>

          {porCaminhao.length > 0 ? (
            <Secao titulo={`Quanto cada caminhão custa parado · ${rotuloMes(mes)}`}>
              <View style={styles.caminhoes}>
                {porCaminhao.map(({ veiculo, proprio, geral, total }) => {
                  // proporção próprio × geral para a barrinha (só desenho)
                  const fracao = total > 0 ? proprio / total : 0;
                  return (
                    <Pressable
                      key={veiculo.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${veiculo.placa}: ${formatarMoeda(total)} por mês. Ver os custos deste caminhão`}
                      onPress={() => setDetalhe(veiculo.id)}
                      style={({ hovered, pressed }) => [styles.caminhao, (hovered || pressed) && styles.caminhaoSobre]}>
                      <View style={styles.caminhaoTopo}>
                        <View style={styles.caminhaoIcone}>
                          <MaterialCommunityIcons name="truck-outline" size={18} color={Cores.primaria} />
                        </View>
                        <View style={styles.caminhaoNome}>
                          <Text style={styles.placa}>{veiculo.placa}</Text>
                          <Text style={styles.suave} numberOfLines={1}>
                            {veiculo.modelo}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.caminhaoTotal, total === 0 && styles.zerado]}>{formatarMoeda(total)}</Text>
                      <View style={styles.barra}>
                        {total > 0 ? (
                          <>
                            <View style={[styles.barraParte, { flex: fracao, backgroundColor: COR_CAMINHOES }]} />
                            <View style={[styles.barraParte, { flex: 1 - fracao, backgroundColor: COR_GERAL }]} />
                          </>
                        ) : null}
                      </View>
                      <View style={styles.legenda}>
                        <Text style={styles.suave}>
                          <Text style={styles.pontoCaminhao}>● </Text>
                          Próprio {formatarMoeda(proprio)}
                        </Text>
                        <Text style={styles.suave}>
                          <Text style={styles.pontoGeral}>● </Text>
                          Geral {formatarMoeda(geral)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.suave}>Toque num caminhão ou num dos cartões acima para ver a lista de custos.</Text>
            </Secao>
          ) : null}
          {custos.length === 0 ? <Aviso tipo="info">Nenhum custo fixo cadastrado ainda.</Aviso> : null}
        </>
      ) : erro ? null : (
        <ActivityIndicator color={Cores.primaria} />
      )}
      {janela && dados ? (
        <DetalheCustos
          {...janela}
          totalGeral={totalGeral}
          caminhoesAtivos={ativos.length}
          vigenteNoMes={(c) => vigenteNoMes(c, inicio, fim)}
          aoEditar={setEditando}
          aoNovo={() => {
            setVeiculoDoNovo(janela.veiculoDoNovo);
            setEditando(null);
          }}
          aoVerGeral={() => setDetalhe(GERAL)}
          aoFechar={() => setDetalhe(null)}
        />
      ) : null}
      {editando !== undefined ? (
        <FormCustoFixo
          custo={editando}
          veiculos={veiculos}
          veiculoInicial={editando ? null : veiculoDoNovo}
          aoFechar={(salvou) => {
            setEditando(undefined);
            setVeiculoDoNovo(null);
            if (salvou) recarregar();
          }}
        />
      ) : null}
    </Pagina>
  );
}

type PropsDetalhe = {
  titulo: string;
  subtitulo?: string;
  rotuloTotal: string;
  total: number;
  linhaTotal: string;
  lista: CustoFixo[];
  colunas: Coluna<CustoFixo>[];
  /** parte do custo geral que cabe ao caminhão (só na janela de um caminhão) */
  parteGeral: number | null;
  tituloNovo: string;
  totalGeral: number;
  caminhoesAtivos: number;
  vigenteNoMes: (c: CustoFixo) => boolean;
  aoEditar: (c: CustoFixo) => void;
  aoNovo: () => void;
  aoVerGeral: () => void;
  aoFechar: () => void;
};

/** Janela por cima da página com a lista de custos (de um caminhão, do geral ou de todos). */
function DetalheCustos({
  titulo,
  subtitulo,
  rotuloTotal,
  total,
  linhaTotal,
  lista,
  colunas,
  parteGeral,
  tituloNovo,
  totalGeral,
  caminhoesAtivos,
  vigenteNoMes: vigente,
  aoEditar,
  aoNovo,
  aoVerGeral,
  aoFechar,
}: PropsDetalhe) {
  // vigentes primeiro, depois os encerrados/futuros
  const ordenados = [...lista].sort((a, b) => Number(vigente(b)) - Number(vigente(a)));

  return (
    <Janela visivel titulo={titulo} subtitulo={subtitulo} aoFechar={aoFechar}>
      <View style={styles.detalheTotal}>
        <Text style={styles.suave}>{rotuloTotal}</Text>
        <Text style={styles.detalheValor}>{formatarMoeda(total)}</Text>
        <Text style={styles.suave}>{linhaTotal}</Text>
      </View>

      <Tabela
        aoTocar={aoEditar}
        colunas={colunas}
        itens={ordenados}
        chave={(c) => c.id}
        vazio="Nenhum custo fixo aqui ainda."
      />

      {parteGeral !== null ? (
        <Pressable
          accessibilityRole="button"
          onPress={aoVerGeral}
          style={({ hovered, pressed }) => [styles.itemGeral, (hovered || pressed) && styles.itemSobre]}>
          <MaterialCommunityIcons name="office-building-outline" size={18} color={COR_GERAL} />
          <View style={styles.itemTextos}>
            <Text style={styles.forte}>+ Parte do custo geral</Text>
            <Text style={styles.suave}>
              {formatarMoeda(totalGeral)} ÷ {caminhoesAtivos} caminhão(ões) ativo(s) · toque para ver os gerais
            </Text>
          </View>
          <Text style={styles.forte}>{formatarMoeda(parteGeral)}</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={Cores.textoSuave} />
        </Pressable>
      ) : null}

      <View style={styles.botoes}>
        <Botao titulo={tituloNovo} onPress={aoNovo} />
        <Botao titulo="Fechar" variante="link" onPress={aoFechar} />
      </View>
    </Janela>
  );
}

type PropsForm = {
  custo: CustoFixo | null;
  veiculos: Veiculo[];
  veiculoInicial: string | null;
  aoFechar: (salvou: boolean) => void;
};

function FormCustoFixo({ custo, veiculos, veiculoInicial, aoFechar }: PropsForm) {
  const [veiculoId, setVeiculoId] = useState<string>(custo?.veiculo_id ?? veiculoInicial ?? GERAL);
  const [categoria, setCategoria] = useState<CategoriaCustoFixo | null>((custo?.categoria as CategoriaCustoFixo) ?? null);
  const [descricao, setDescricao] = useState(custo?.descricao ?? '');
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>((custo?.periodicidade as Periodicidade) ?? 'mensal');
  const [valor, setValor] = useState(
    custo ? formatarDecimal(custo.periodicidade === 'anual' && custo.valor_anual != null ? custo.valor_anual : custo.valor_mensal) : '',
  );
  const [inicio, setInicio] = useState(formatarData(custo?.inicio ?? `${hojeIso().slice(0, 7)}-01`));
  const [fim, setFim] = useState(formatarData(custo?.fim));
  const [mensagem, setMensagem] = useState<ConteudoMensagem | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  const opcoesVeiculo = [
    { valor: GERAL, rotulo: 'Geral da transportadora' },
    ...veiculos
      .filter((v) => v.status !== 'inativo' || v.id === custo?.veiculo_id)
      .map((v) => ({ valor: v.id, rotulo: `${v.placa} · ${v.modelo}` })),
  ];
  const opcoesCategoria = CATEGORIAS_CUSTO_FIXO.map((c) => ({ valor: c.valor, rotulo: c.rotulo }));
  const ajudaCategoria = CATEGORIAS_CUSTO_FIXO.find((c) => c.valor === categoria)?.ajuda || undefined;

  const valorLido = lerDecimal(valor);
  const valorValido = valorLido !== null && !Number.isNaN(valorLido) && valorLido > 0;
  // prévia; o banco guarda o mesmo arredondamento (valor anual ÷ 12, ao centavo)
  const porMes = periodicidade === 'anual' && valorValido ? emReais(Math.round(emCentavos(valorLido) / 12)) : null;

  function aoEscolherCategoria(c: CategoriaCustoFixo) {
    setCategoria(c);
    if (c === 'ipva_licenciamento') setPeriodicidade('anual');
  }

  async function executar(acao: () => Promise<void>) {
    setMensagem(null);
    setSalvando(true);
    try {
      await acao();
      aoFechar(true);
    } catch (e) {
      setMensagem({ titulo: 'Não foi possível salvar', texto: mensagemDeErro(e) });
      setSalvando(false);
    }
  }

  function aoSalvar() {
    const faltam = [!descricao.trim() && 'Descrição', !categoria && 'Categoria', !valorValido && 'Valor'].filter(
      (x): x is string => !!x,
    );
    if (faltam.length) return setMensagem({ titulo: 'Preencha os campos obrigatórios', itens: faltam });
    const inicioIso = lerData(inicio);
    const fimIso = lerData(fim);
    if (!inicioIso) return setMensagem({ titulo: 'Confira as datas', texto: 'Data de início inválida. Use dia/mês/ano.' });
    if (fimIso === undefined) return setMensagem({ titulo: 'Confira as datas', texto: 'Data de fim inválida. Use dia/mês/ano.' });
    if (fimIso && fimIso < inicioIso) return setMensagem({ titulo: 'Confira as datas', texto: 'O fim não pode ser antes do início.' });
    executar(() =>
      salvarCustoFixo(custo?.id ?? null, {
        descricao: descricao.trim(),
        categoria,
        veiculo_id: veiculoId === GERAL ? null : veiculoId,
        periodicidade,
        // no anual o banco refaz valor_mensal a partir do valor_anual
        valor_mensal: periodicidade === 'anual' ? (porMes ?? valorLido!) : valorLido!,
        valor_anual: periodicidade === 'anual' ? valorLido : null,
        inicio: inicioIso,
        fim: fimIso,
      }),
    );
  }

  return (
    <Janela visivel titulo={custo ? 'Editar custo fixo' : 'Novo custo fixo'} aoFechar={() => aoFechar(false)}>
      <Mensagem mensagem={mensagem} aoFechar={() => setMensagem(null)} />
      <LinhaForm minimo={240}>
        <Seletor
          rotulo="Caminhão *"
          opcoes={opcoesVeiculo}
          valor={veiculoId}
          onChange={setVeiculoId}
          ajuda="Geral = da transportadora inteira (contador, escritório). Na tabela por caminhão, é dividido igualmente entre os caminhões ativos."
        />
        <Seletor
          rotulo="Categoria *"
          opcoes={opcoesCategoria}
          valor={categoria}
          onChange={aoEscolherCategoria}
          ajuda={ajudaCategoria}
        />
      </LinhaForm>
      <Campo rotulo="Descrição *" value={descricao} onChangeText={setDescricao} placeholder="Ex.: Seguro Porto — apólice 2026" />
      <LinhaForm minimo={200}>
        <Segmentado rotulo="Cobrança" opcoes={PERIODICIDADE} valor={periodicidade} onChange={setPeriodicidade} />
        <Campo
          rotulo={periodicidade === 'anual' ? 'Valor do ano (R$) *' : 'Valor mensal (R$) *'}
          value={valor}
          onChangeText={(t) => setValor(mascararDecimal(t))}
          keyboardType="numeric"
          inputMode="decimal"
        />
      </LinhaForm>
      {porMes !== null ? <Text style={styles.nota}>Entra {formatarMoeda(porMes)} por mês no resultado (valor do ano ÷ 12).</Text> : null}
      <LinhaForm minimo={200}>
        <CampoData
          rotulo="Vale a partir de *"
          ajuda="O custo entra no resultado a partir do mês desta data."
          valor={inicio}
          onChange={setInicio}
        />
        <CampoData
          rotulo="Vale até"
          ajuda="Deixe vazio se o custo continua. Preencha para encerrar (ex.: última parcela, venda do caminhão)."
          valor={fim}
          onChange={setFim}
        />
      </LinhaForm>
      <View style={styles.botoes}>
        <Botao titulo="Salvar" onPress={aoSalvar} carregando={salvando} />
        <Botao titulo="Cancelar" variante="link" onPress={() => aoFechar(false)} />
      </View>
      {custo ? (
        confirmandoExcluir ? (
          <Botao titulo="Confirmar exclusão" variante="perigo" onPress={() => executar(() => excluirCustoFixo(custo.id))} />
        ) : (
          <Botao titulo="Excluir custo fixo" variante="link" onPress={() => setConfirmandoExcluir(true)} />
        )
      ) : null}
    </Janela>
  );
}

const styles = StyleSheet.create({
  celulaDupla: { gap: 2 },
  forte: { fontSize: 14, fontWeight: '600', color: Cores.texto },
  suave: { fontSize: 12, color: Cores.textoSuave },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipCaminhao: { backgroundColor: '#FEF3C7' },
  chipGeral: { backgroundColor: '#EDE9FE' },
  chipTexto: { fontSize: 12, fontWeight: '700' },
  chipTextoCaminhao: { color: '#92400E' },
  chipTextoGeral: { color: '#5B21B6' },
  caminhoes: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.md },
  caminhao: {
    flexGrow: 1,
    flexBasis: 200,
    maxWidth: 320,
    gap: Espaco.sm,
    padding: Espaco.md,
    borderRadius: Raio.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.fundo,
  },
  detalheTotal: { gap: 2, padding: Espaco.md, borderRadius: Raio.md, backgroundColor: Cores.fundo },
  detalheValor: { fontSize: 24, fontWeight: '700', color: Cores.texto },
  itemGeral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    paddingHorizontal: Espaco.md,
    paddingVertical: Espaco.sm,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: '#F5F3FF',
  },
  itemSobre: { backgroundColor: Cores.chipClaro },
  itemTextos: { flex: 1, gap: 2 },
  caminhaoSobre: { boxShadow: '0 4px 14px rgba(15, 23, 42, 0.10)' },
  caminhaoTopo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.sm },
  caminhaoIcone: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Cores.chipClaro,
  },
  caminhaoNome: { flexShrink: 1 },
  placa: { fontSize: 15, fontWeight: '700', color: Cores.texto },
  caminhaoTotal: { fontSize: 20, fontWeight: '700', color: Cores.texto },
  zerado: { color: Cores.textoSuave },
  barra: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: Cores.borda },
  barraParte: { height: 6 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: Espaco.sm },
  pontoCaminhao: { color: COR_CAMINHOES },
  pontoGeral: { color: COR_GERAL },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  nota: { fontSize: 11, color: Cores.textoSuave },
});
