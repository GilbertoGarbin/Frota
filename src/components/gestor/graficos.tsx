import { StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco } from '@/constants/tema';
import { formatarDecimal, formatarMoeda, formatarPercentual } from '@/utils/formato';

// Gráficos simples feitos com View (web e celular, sem biblioteca). Só exibição:
// os valores já vêm somados do banco.

export const COR_FATURAMENTO = Cores.primaria;
export const COR_CUSTOS = '#F59E0B';

/** "R$ 12,3 mil" — rótulo curto para eixos e barras */
function moedaCurta(valor: number): string {
  const abs = Math.abs(valor);
  if (abs >= 1_000_000) return `R$ ${formatarDecimal(valor / 1_000_000, 1)} mi`;
  if (abs >= 1_000) return `R$ ${formatarDecimal(valor / 1_000, 1)} mil`;
  return formatarMoeda(valor);
}

export type PontoMes = { rotulo: string; faturamento: number; custos: number; resultado: number; atual?: boolean };

const ALTURA = 150;

/** Barras lado a lado (faturamento × custos) por mês, com o lucro embaixo. */
export function GraficoMeses({ meses }: { meses: PontoMes[] }) {
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.faturamento, m.custos]));
  const altura = (v: number) => Math.max(2, Math.round((Math.max(0, v) / maximo) * ALTURA));
  return (
    <View style={styles.grafico}>
      <View style={styles.legenda}>
        <Legenda cor={COR_FATURAMENTO} texto="Faturamento" />
        <Legenda cor={COR_CUSTOS} texto="Custos" />
        <Text style={styles.legendaTexto}>· lucro embaixo de cada mês</Text>
      </View>
      <View style={styles.colunas}>
        {meses.map((m) => (
          <View
            key={m.rotulo}
            style={styles.coluna}
            accessibilityLabel={`${m.rotulo}: faturamento ${formatarMoeda(m.faturamento)}, custos ${formatarMoeda(m.custos)}, lucro ${formatarMoeda(m.resultado)}`}>
            <View style={[styles.barras, { height: ALTURA }]}>
              <View style={[styles.barra, { height: altura(m.faturamento), backgroundColor: COR_FATURAMENTO }]} />
              <View style={[styles.barra, { height: altura(m.custos), backgroundColor: COR_CUSTOS }]} />
            </View>
            <Text style={[styles.mes, m.atual && styles.mesAtual]}>{m.rotulo}</Text>
            <Text style={[styles.lucro, { color: m.resultado >= 0 ? Cores.sucessoTexto : Cores.perigo }]}>
              {moedaCurta(m.resultado)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <View style={styles.itemLegenda}>
      <View style={[styles.quadrado, { backgroundColor: cor }]} />
      <Text style={styles.legendaTexto}>{texto}</Text>
    </View>
  );
}

export type Fatia = { rotulo: string; valor: number; cor: string };

/** Para onde foi o dinheiro: uma barra por item, do maior para o menor, com o % do total. */
export function BarrasComposicao({ fatias }: { fatias: Fatia[] }) {
  const total = fatias.reduce((t, f) => t + Math.max(0, f.valor), 0);
  if (total <= 0) return <Text style={styles.vazio}>Nenhum custo lançado neste mês.</Text>;
  const ordenadas = [...fatias].sort((a, b) => b.valor - a.valor);
  return (
    <View style={styles.composicao}>
      {ordenadas.map((f) => {
        const parte = Math.max(0, f.valor) / total;
        return (
          <View key={f.rotulo} style={styles.fatia}>
            <View style={styles.fatiaTopo}>
              <Text style={styles.fatiaRotulo}>{f.rotulo}</Text>
              <Text style={styles.fatiaValor}>
                {formatarMoeda(f.valor)}
                <Text style={styles.fatiaParte}>{`  ${formatarPercentual(Math.round(parte * 1000) / 10)}`}</Text>
              </Text>
            </View>
            <View style={styles.trilho}>
              <View style={[styles.preenchido, { width: `${parte * 100}%`, backgroundColor: f.cor }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grafico: { gap: Espaco.md },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  itemLegenda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quadrado: { width: 10, height: 10, borderRadius: 2 },
  legendaTexto: { fontSize: 12, color: Cores.textoSuave },
  colunas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Espaco.sm,
    borderTopWidth: 1,
    borderTopColor: Cores.borda,
    paddingTop: Espaco.sm,
  },
  coluna: { flex: 1, alignItems: 'center', gap: 4, minWidth: 0 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderBottomWidth: 1, borderBottomColor: Cores.borda },
  barra: { width: 16, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  mes: { fontSize: 12, color: Cores.textoSuave },
  mesAtual: { fontWeight: '700', color: Cores.texto },
  lucro: { fontSize: 11, fontWeight: '600' },
  vazio: { fontSize: 13, color: Cores.textoSuave },
  composicao: { gap: Espaco.md },
  fatia: { gap: 4 },
  fatiaTopo: { flexDirection: 'row', justifyContent: 'space-between', gap: Espaco.sm },
  fatiaRotulo: { fontSize: 13, color: Cores.texto },
  fatiaValor: { fontSize: 13, fontWeight: '600', color: Cores.texto },
  fatiaParte: { fontSize: 12, fontWeight: '400', color: Cores.textoSuave },
  trilho: { height: 8, borderRadius: 4, backgroundColor: Cores.fundo, overflow: 'hidden' },
  preenchido: { height: 8, borderRadius: 4 },
});
