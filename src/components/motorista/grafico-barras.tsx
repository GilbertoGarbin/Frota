import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';

export type Barra = {
  /** rótulo do eixo (ex.: "Nov") */
  rotulo: string;
  /** rótulo completo para leitura e leitor de tela (ex.: "Novembro 2026") */
  rotuloCompleto: string;
  valor: number;
  /** valor já formatado (ex.: "R$ 1.540,00") */
  texto: string;
};

type Props = {
  titulo: string;
  barras: Barra[];
  selecionada: number;
  aoTocar: (indice: number) => void;
};

const ALTURA = 140;
// Barra escolhida no azul do app; as outras no mesmo tom, mais claro (uma cor só: é quantidade, não categoria)
const COR_SELECIONADA = Cores.primaria;
const COR_OUTRAS = '#A9C8FB';

/** Gráfico de barras simples (uma série), feito com View: funciona igual no celular e na web, sem sinal. */
export function GraficoBarras({ titulo, barras, selecionada, aoTocar }: Props) {
  const maximo = Math.max(...barras.map((b) => b.valor), 0);
  const escolhida = barras[selecionada];

  return (
    <View style={styles.caixa}>
      <Text style={styles.titulo}>{titulo}</Text>
      {escolhida ? (
        <Text style={styles.destaque}>
          {escolhida.rotuloCompleto}: <Text style={styles.destaqueValor}>{escolhida.texto}</Text>
        </Text>
      ) : null}

      <View style={styles.area}>
        {barras.map((b, i) => {
          const altura = maximo > 0 ? Math.max((b.valor / maximo) * ALTURA, b.valor > 0 ? 4 : 0) : 0;
          const ativa = i === selecionada;
          return (
            <Pressable
              key={b.rotuloCompleto}
              accessibilityRole="button"
              accessibilityLabel={`${b.rotuloCompleto}: ${b.texto}`}
              accessibilityState={{ selected: ativa }}
              onPress={() => aoTocar(i)}
              style={styles.coluna}>
              <View style={styles.trilho}>
                <View style={[styles.barra, { height: altura, backgroundColor: ativa ? COR_SELECIONADA : COR_OUTRAS }]} />
              </View>
              <Text style={[styles.rotulo, ativa && styles.rotuloAtivo]}>{b.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    gap: Espaco.sm,
    padding: Espaco.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  titulo: { fontSize: 16, fontWeight: '700', color: Cores.texto },
  destaque: { fontSize: 13, color: Cores.textoSuave },
  destaqueValor: { fontSize: 15, fontWeight: '700', color: Cores.texto },
  area: {
    flexDirection: 'row',
    gap: 2,
    paddingTop: Espaco.sm,
  },
  coluna: { flex: 1, alignItems: 'center', gap: Espaco.xs },
  trilho: {
    height: ALTURA,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Cores.borda,
  },
  barra: { width: '70%', maxWidth: 36, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  rotulo: { fontSize: 12, color: Cores.textoSuave },
  rotuloAtivo: { color: Cores.texto, fontWeight: '700' },
});
