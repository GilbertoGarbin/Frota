import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { tomDaMargem } from '@/components/gestor/detalhe-viagem';
import { BarrasComposicao, COR_CUSTOS, GraficoMeses, type PontoMes } from '@/components/gestor/graficos';
import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { CartaoResumo, Grade, Indicador, Secao } from '@/components/ui/cartao';
import { SeletorMes } from '@/components/ui/seletor-mes';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores, Espaco } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { dataDeHoje, listarPagamentos, listarRecebimentos } from '@/services/financeiro.service';
import {
  buscarDesempenhoPorVeiculo,
  buscarResumoFinanceiro,
  type DesempenhoVeiculo,
  type ResumoFinanceiro,
} from '@/services/gestao.service';
import { emCentavos, emReais, somar } from '@/utils/dinheiro';
import {
  deslocarMes,
  formatarDecimal,
  formatarKm,
  formatarMoeda,
  formatarPercentual,
  mesAtual,
  periodoDoMes,
  rotuloMes,
  type Mes,
} from '@/utils/formato';

const MESES_GRAFICO = 6;
const LARANJA = '#D97706';
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type ContaResumida = { valor: number; vencimento: string | null; quitado: string | null };

// Contas a receber/pagar: em aberto (cartões) e quitadas no mês (caixa, igual ao Extrato)
async function carregarContas(): Promise<{ receber: ContaResumida[]; pagar: ContaResumida[] }> {
  const [receber, pagar] = await Promise.all([listarRecebimentos(), listarPagamentos()]);
  return {
    receber: receber.map((r) => ({ valor: r.valor_final ?? r.valor, vencimento: r.vencimento, quitado: r.recebido_em })),
    pagar: pagar.map((p) => ({ valor: p.valor_final ?? p.valor, vencimento: p.vencimento, quitado: p.pago_em })),
  };
}

function emAberto(lista: ContaResumida[]) {
  const hoje = dataDeHoje();
  const abertas = lista.filter((c) => !c.quitado);
  return {
    total: somar(abertas.map((c) => c.valor)),
    atrasado: somar(abertas.filter((c) => c.vencimento && c.vencimento < hoje).map((c) => c.valor)),
  };
}

const quitadoNoPeriodo = (lista: ContaResumida[], inicio: string, fim: string) =>
  somar(lista.filter((c) => c.quitado && c.quitado >= inicio && c.quitado <= fim).map((c) => c.valor));

const custosTotais = (r: ResumoFinanceiro) => somar([r.custos_operacionais, r.custos_fixos]);

// Razões entre totais do banco (só exibição): margem em % e variação com uma casa
const margemDe = (r: ResumoFinanceiro) => (r.faturamento > 0 ? Math.round((r.resultado * 1000) / r.faturamento) / 10 : null);

/** "+12,3% vs. set"; maiorEhMelhor diz se subir é bom (faturamento) ou ruim (custos) */
function variacao(atual: number, anterior: number, mesAnterior: Mes, maiorEhMelhor: boolean) {
  const nome = MESES_CURTOS[mesAnterior.mes - 1];
  if (anterior === 0) return atual === 0 ? undefined : { texto: `sem base em ${nome}`, bom: null };
  const pct = Math.round(((atual - anterior) * 1000) / Math.abs(anterior)) / 10;
  return {
    texto: `${pct > 0 ? '+' : ''}${formatarDecimal(pct, 1)}% vs. ${nome}`,
    bom: pct === 0 ? null : pct > 0 === maiorEhMelhor,
  };
}

// Tela 6 — Financeiro: painel do mês (resultado, caixa, evolução, composição) e desempenho por placa
export default function Financeiro() {
  const router = useRouter();
  const [mes, setMes] = useState(mesAtual);
  const { inicio, fim } = periodoDoMes(mes);
  const buscar = useCallback(async () => {
    // mês escolhido e os 5 anteriores (gráfico e comparação com o mês passado)
    const meses = Array.from({ length: MESES_GRAFICO }, (_, i) => deslocarMes(mes, i - (MESES_GRAFICO - 1)));
    const [resumos, veiculos] = await Promise.all([
      Promise.all(
        meses.map((m) => {
          const p = periodoDoMes(m);
          return buscarResumoFinanceiro(p.inicio, p.fim);
        }),
      ),
      buscarDesempenhoPorVeiculo(inicio, fim),
    ]);
    return { meses, resumos, veiculos };
  }, [mes, inicio, fim]);
  const { dados: contas } = useCarregar(carregarContas);
  const { dados, erro } = useCarregar(buscar);

  const r = dados?.resumos[MESES_GRAFICO - 1];
  const anterior = dados?.resumos[MESES_GRAFICO - 2];
  const mesAnterior = deslocarMes(mes, -1);
  const nomeAnterior = MESES_CURTOS[mesAnterior.mes - 1];

  // Indicadores por km: razão entre dois totais que o banco já somou (só exibição)
  const porKm = (valor: number) => (r && r.km_rodado > 0 ? `${formatarMoeda(Math.round((valor * 100) / r.km_rodado) / 100)}/km` : '—');

  const colunas: Coluna<DesempenhoVeiculo>[] = [
    { titulo: 'Placa', celula: (v) => v.placa },
    { titulo: 'Km rodado', celula: (v) => formatarKm(v.km_rodado) },
    { titulo: 'Faturamento', celula: (v) => formatarMoeda(v.faturamento) },
    { titulo: 'Combustível', celula: (v) => `${formatarMoeda(v.combustivel)}${v.viagens_combustivel_estimado > 0 ? ' *' : ''}` },
    { titulo: 'Comissão', celula: (v) => formatarMoeda(v.comissoes) },
    { titulo: 'Despesas', celula: (v) => formatarMoeda(v.despesas) },
    { titulo: 'Manutenção', celula: (v) => formatarMoeda(v.manutencoes) },
    { titulo: 'Resultado', celula: (v) => formatarMoeda(v.resultado) },
    {
      titulo: 'Margem',
      celula: (v) => {
        const tom = tomDaMargem(v.margem_percentual);
        return <Selo tipo={tom === 'neutro' ? 'neutro' : tom}>{formatarPercentual(v.margem_percentual)}</Selo>;
      },
    },
  ];

  let conteudo = null;
  if (r && anterior && dados) {
    const margem = margemDe(r);
    const margemAnterior = margemDe(anterior);
    const difMargem = margem !== null && margemAnterior !== null ? Math.round((margem - margemAnterior) * 10) / 10 : null;

    const pontos: PontoMes[] = dados.meses.map((m, i) => ({
      rotulo: MESES_CURTOS[m.mes - 1],
      faturamento: dados.resumos[i].faturamento,
      custos: custosTotais(dados.resumos[i]),
      resultado: dados.resumos[i].resultado,
      atual: i === MESES_GRAFICO - 1,
    }));

    const aReceber = contas ? emAberto(contas.receber) : null;
    const aPagar = contas ? emAberto(contas.pagar) : null;
    const entrou = contas ? quitadoNoPeriodo(contas.receber, inicio, fim) : 0;
    const saiu = contas ? quitadoNoPeriodo(contas.pagar, inicio, fim) : 0;
    const saldo = emReais(emCentavos(entrou) - emCentavos(saiu));

    conteudo = (
      <>
        <Grade>
          <CartaoResumo
            rotulo="Faturamento"
            valor={formatarMoeda(r.faturamento)}
            cor={Cores.primaria}
            variacao={variacao(r.faturamento, anterior.faturamento, mesAnterior, true)}
            detalhe={`· ${r.viagens} viagem(ns)`}
          />
          <CartaoResumo
            rotulo="Custos"
            valor={formatarMoeda(custosTotais(r))}
            cor={LARANJA}
            variacao={variacao(custosTotais(r), custosTotais(anterior), mesAnterior, false)}
          />
          <CartaoResumo
            rotulo="Lucro líquido"
            valor={formatarMoeda(r.resultado)}
            cor={r.resultado >= 0 ? Cores.sucessoTexto : Cores.perigo}
            variacao={variacao(r.resultado, anterior.resultado, mesAnterior, true)}
          />
          <CartaoResumo
            rotulo="Margem"
            valor={formatarPercentual(margem)}
            cor={margem !== null && margem < 10 ? Cores.perigo : Cores.sucessoTexto}
            apagado={margem === null}
            variacao={
              difMargem === null
                ? undefined
                : {
                    texto: `${difMargem > 0 ? '+' : ''}${formatarDecimal(difMargem, 1)} p.p. vs. ${nomeAnterior}`,
                    bom: difMargem === 0 ? null : difMargem > 0,
                  }
            }
          />
        </Grade>

        {aReceber && aPagar ? (
          <Grade>
            <CartaoResumo
              rotulo="A receber"
              valor={formatarMoeda(aReceber.total)}
              cor={Cores.sucessoTexto}
              detalhe={aReceber.atrasado > 0 ? `${formatarMoeda(aReceber.atrasado)} atrasado` : 'Nada atrasado'}
              onPress={() => router.push('/gestor/receber')}
            />
            <CartaoResumo
              rotulo="A pagar"
              valor={formatarMoeda(aPagar.total)}
              cor={LARANJA}
              detalhe={aPagar.atrasado > 0 ? `${formatarMoeda(aPagar.atrasado)} atrasado` : 'Nada atrasado'}
              onPress={() => router.push('/gestor/pagar')}
            />
            <CartaoResumo
              rotulo="Caixa do mês"
              valor={formatarMoeda(saldo)}
              cor={saldo > 0 ? Cores.sucessoTexto : saldo < 0 ? '#DC2626' : Cores.primaria}
              fundo={saldo > 0 ? Cores.sucessoFundo : saldo < 0 ? Cores.perigoFundo : undefined}
              detalhe={`Entrou ${formatarMoeda(entrou)} · saiu ${formatarMoeda(saiu)}`}
              onPress={() => router.push('/gestor/extrato')}
            />
          </Grade>
        ) : null}

        <View style={styles.duas}>
          <View style={styles.metade}>
            <Secao titulo="Últimos 6 meses">
              <GraficoMeses meses={pontos} />
            </Secao>
          </View>
          <View style={styles.metade}>
            <Secao titulo="Para onde foi o dinheiro">
              <BarrasComposicao
                fatias={[
                  { rotulo: 'Combustível', valor: r.combustivel, cor: COR_CUSTOS },
                  { rotulo: 'Comissões', valor: r.comissoes, cor: '#8B5CF6' },
                  { rotulo: 'Despesas de viagem', valor: r.despesas, cor: '#0EA5E9' },
                  { rotulo: 'Manutenções', valor: r.manutencoes, cor: '#64748B' },
                  { rotulo: 'Custos fixos', valor: r.custos_fixos, cor: '#EC4899' },
                ]}
              />
            </Secao>
          </View>
        </View>

        <Grade>
          <Indicador
            rotulo="Custo por km (CPK)"
            valor={porKm(custosTotais(r))}
            detalhe={`${formatarKm(r.km_rodado)} rodados no mês`}
          />
          <Indicador rotulo="Faturamento por km" valor={porKm(r.faturamento)} />
          <Indicador
            rotulo="Adiantamentos em aberto"
            tom={r.adiantamentos_abertos > 0 ? 'destaque' : 'neutro'}
            valor={`${r.adiantamentos_abertos} viagem(ns)`}
            detalhe={`A devolver: ${formatarMoeda(r.adiantamento_a_devolver)} · A reembolsar: ${formatarMoeda(r.adiantamento_a_reembolsar)}`}
            onPress={() => router.navigate({ pathname: '/gestor/viagens', params: { filtro: 'adiantamento' } })}
          />
        </Grade>

        <Secao titulo="Desempenho por placa">
          <Tabela
            colunas={colunas}
            itens={dados.veiculos}
            chave={(v) => v.veiculo_id}
            vazio="Nenhuma viagem finalizada nem manutenção neste mês."
            larguraMinima={1040}
          />
          {r.viagens_combustivel_estimado > 0 ? (
            <Text style={styles.nota}>
              * Valores de combustível de {r.viagens_combustivel_estimado} viagem(ns) ainda estimados — serão
              corrigidos no próximo abastecimento com tanque cheio.
            </Text>
          ) : null}
          <Text style={styles.nota}>Margem: verde a partir de 30%, vermelho abaixo de 10%.</Text>
        </Secao>

        {Platform.OS === 'web' ? (
          <Botao titulo="Imprimir / salvar em PDF" variante="contorno" onPress={() => window.print()} />
        ) : null}
      </>
    );
  }

  return (
    <Pagina
      titulo="Financeiro"
      subtitulo={`Fechamento de ${rotuloMes(mes)}.`}
      acao={<SeletorMes mes={mes} onChange={setMes} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {conteudo ?? (erro ? null : <ActivityIndicator color={Cores.primaria} />)}
    </Pagina>
  );
}

const styles = StyleSheet.create({
  duas: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.md },
  metade: { flexGrow: 1, flexBasis: 420, minWidth: 0 },
  nota: { fontSize: 13, color: Cores.textoSuave },
});
