import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { CampoData } from '@/components/ui/campo-data';
import { Grade, Indicador } from '@/components/ui/cartao';
import { Janela } from '@/components/ui/janela';
import { LinhaForm } from '@/components/ui/linha-form';
import { Mensagem, type ConteudoMensagem } from '@/components/ui/mensagem';
import { Segmentado } from '@/components/ui/segmentado';
import { Seletor } from '@/components/ui/seletor';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores, Espaco } from '@/constants/tema';
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

const PERIODICIDADE = [
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'anual', rotulo: 'Anual' },
] as const;
type Periodicidade = (typeof PERIODICIDADE)[number]['valor'];

/** O que todo caminhão costuma ter; serve para avisar o que falta cadastrar. */
const ESSENCIAIS_DO_CAMINHAO: { rotulo: string; categorias: CategoriaCustoFixo[] }[] = [
  { rotulo: 'parcela ou depreciação', categorias: ['financiamento', 'depreciacao'] },
  { rotulo: 'seguro', categorias: ['seguro'] },
  { rotulo: 'IPVA e licenciamento', categorias: ['ipva_licenciamento'] },
];

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
  const [filtro, setFiltro] = useState<string>(TODOS);

  const custos = dados?.custos ?? [];
  const veiculos = dados?.veiculos ?? [];
  const ativos = veiculos.filter((v) => v.status !== 'inativo');
  const placaDe = (id: string | null) => (id ? (veiculos.find((v) => v.id === id)?.placa ?? '—') : 'Geral');

  const mes = mesAtual();
  const { inicio, fim } = periodoDoMes(mes);
  const vigentes = custos.filter((c) => vigenteNoMes(c, inicio, fim));
  const totalGeral = somar(vigentes.filter((c) => !c.veiculo_id).map((c) => c.valor_mensal));
  const totalCaminhoes = somar(vigentes.filter((c) => c.veiculo_id).map((c) => c.valor_mensal));
  // só para exibir; a conta que vale (no resultado por placa) é feita no banco
  const parteGeral = ativos.length > 0 ? emReais(Math.round(emCentavos(totalGeral) / ativos.length)) : 0;

  const faltando = ativos
    .map((v) => {
      const doCaminhao = vigentes.filter((c) => c.veiculo_id === v.id);
      const falta = ESSENCIAIS_DO_CAMINHAO.filter(
        (e) => !doCaminhao.some((c) => e.categorias.includes(c.categoria as CategoriaCustoFixo)),
      ).map((e) => e.rotulo);
      return { placa: v.placa, falta };
    })
    .filter((x) => x.falta.length > 0);

  const listados = custos.filter((c) =>
    filtro === TODOS ? true : filtro === GERAL ? !c.veiculo_id : c.veiculo_id === filtro,
  );

  const opcoesFiltro = [
    { valor: TODOS, rotulo: 'Todos' },
    { valor: GERAL, rotulo: 'Geral da transportadora' },
    ...veiculos.map((v) => ({ valor: v.id, rotulo: v.placa })),
  ];

  const colunas: Coluna<CustoFixo>[] = [
    { titulo: 'Descrição', flex: 2, celula: (c) => c.descricao },
    { titulo: 'Caminhão', celula: (c) => placaDe(c.veiculo_id) },
    { titulo: 'Categoria', flex: 1.5, celula: (c) => rotuloCategoriaCustoFixo(c.categoria) },
    {
      titulo: 'Valor mensal',
      flex: 1.5,
      celula: (c) =>
        c.periodicidade === 'anual' && c.valor_anual != null
          ? `${formatarMoeda(c.valor_mensal)} (${formatarMoeda(c.valor_anual)}/ano)`
          : formatarMoeda(c.valor_mensal),
    },
    {
      titulo: 'Vigência',
      flex: 1.5,
      celula: (c) => `${formatarData(c.inicio).slice(3)} até ${c.fim ? formatarData(c.fim).slice(3) : 'sem data de fim'}`,
    },
    {
      titulo: 'Situação',
      celula: (c) =>
        vigenteNoMes(c, inicio, fim) ? <Selo tipo="sucesso">Vigente</Selo> : <Selo tipo="neutro">Fora do mês</Selo>,
    },
  ];

  return (
    <Pagina
      titulo="Custos Fixos"
      acao={<Botao titulo="+ Novo custo fixo" compacto onPress={() => setEditando(null)} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {dados ? (
        <>
          <Grade>
            <Indicador
              rotulo={`Total em ${rotuloMes(mes)}`}
              tom="destaque"
              valor={formatarMoeda(somar(vigentes.map((c) => c.valor_mensal)))}
              detalhe={`${vigentes.length} custo(s) vigente(s) — entra no resultado líquido do mês`}
            />
            <Indicador
              rotulo="Dos caminhões"
              valor={formatarMoeda(totalCaminhoes)}
              detalhe="Parcela, seguro, IPVA… ligados a uma placa"
            />
            <Indicador
              rotulo="Geral da transportadora"
              valor={formatarMoeda(totalGeral)}
              detalhe={
                ativos.length > 0
                  ? `${formatarMoeda(parteGeral)} para cada um dos ${ativos.length} caminhão(ões) ativo(s)`
                  : 'Nenhum caminhão ativo para dividir'
              }
            />
          </Grade>
          {faltando.length > 0 ? (
            <Aviso tipo="info">
              {`Pode estar faltando custo fixo em ${rotuloMes(mes)}:\n` +
                faltando.map((x) => `• ${x.placa}: ${x.falta.join(', ')}`).join('\n')}
            </Aviso>
          ) : null}
          <View style={styles.filtro}>
            <Seletor rotulo="Caminhão" compacto opcoes={opcoesFiltro} valor={filtro} onChange={setFiltro} />
          </View>
          <Tabela
            aoTocar={setEditando}
            colunas={colunas}
            itens={listados}
            chave={(c) => c.id}
            vazio={custos.length === 0 ? 'Nenhum custo fixo cadastrado ainda.' : 'Nenhum custo fixo neste filtro.'}
          />
        </>
      ) : erro ? null : (
        <ActivityIndicator color={Cores.primaria} />
      )}
      {editando !== undefined ? (
        <FormCustoFixo
          custo={editando}
          veiculos={veiculos}
          veiculoInicial={editando ? null : filtro !== TODOS && filtro !== GERAL ? filtro : null}
          aoFechar={(salvou) => {
            setEditando(undefined);
            if (salvou) recarregar();
          }}
        />
      ) : null}
    </Pagina>
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
  filtro: { maxWidth: 280 },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  nota: { fontSize: 11, color: Cores.textoSuave },
});
