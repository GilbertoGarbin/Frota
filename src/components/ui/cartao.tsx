import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';

type Tom = 'neutro' | 'sucesso' | 'perigo' | 'destaque';

const TOM: Record<Tom, { fundo: string; texto: string }> = {
  neutro: { fundo: Cores.branco, texto: Cores.texto },
  // chips claros no lugar de fundo saturado com texto branco (spec, seção 3)
  sucesso: { fundo: Cores.sucessoFundo, texto: Cores.sucessoTexto },
  perigo: { fundo: Cores.perigoFundo, texto: Cores.perigoTexto },
  destaque: { fundo: Cores.chipClaro, texto: Cores.primariaEscura },
};

type PropsIndicador = {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: Tom;
  /** conteúdo extra ao lado do rótulo (ex.: selo Estimado/Apurado) */
  extra?: ReactNode;
  onPress?: () => void;
};

/** Cartão de número (KPI). Valores calculados nunca têm cara de campo editável. */
export function Indicador({ rotulo, valor, detalhe, tom = 'neutro', extra, onPress }: PropsIndicador) {
  const { fundo, texto } = TOM[tom];
  const conteudo = (
    <>
      <View style={styles.linhaRotulo}>
        <Text style={styles.rotulo}>{rotulo}</Text>
        {extra}
      </View>
      <Text style={[styles.valor, { color: texto }]}>{valor}</Text>
      {detalhe ? <Text style={styles.detalhe}>{detalhe}</Text> : null}
    </>
  );
  const estilo = [styles.indicador, { backgroundColor: fundo }, tom === 'neutro' && styles.borda];
  return onPress ? (
    <Pressable accessibilityRole="link" onPress={onPress} style={estilo}>
      {conteudo}
    </Pressable>
  ) : (
    <View style={estilo}>{conteudo}</View>
  );
}

/**
 * Resumo compacto: vários números num cartão só, separados por linhas finas. Quebra em
 * duas ou três colunas no celular. Para o topo de telas de detalhe.
 */
export function Faixa({ children }: PropsWithChildren) {
  return <View style={styles.faixa}>{children}</View>;
}

/** Um número da Faixa. O tom muda só a cor do valor (sem fundo colorido). */
export function ItemFaixa({ rotulo, valor, detalhe, tom = 'neutro', extra }: Omit<PropsIndicador, 'onPress'>) {
  return (
    <View style={styles.itemFaixa}>
      <View style={styles.linhaRotulo}>
        <Text style={styles.rotuloFaixa}>{rotulo}</Text>
        {extra}
      </View>
      <Text style={[styles.valorFaixa, { color: TOM[tom].texto }]}>{valor}</Text>
      {detalhe ? <Text style={styles.detalheFaixa}>{detalhe}</Text> : null}
    </View>
  );
}

/** Linha de cartões que quebra em telas estreitas */
export function Grade({ children }: PropsWithChildren) {
  return <View style={styles.grade}>{children}</View>;
}

/** Bloco com título, para agrupar conteúdo dentro de uma página */
export function Secao({ titulo, acao, children }: PropsWithChildren<{ titulo: string; acao?: ReactNode }>) {
  return (
    <View style={styles.secao}>
      <View style={styles.secaoCabecalho}>
        <Text accessibilityRole="header" style={styles.secaoTitulo}>
          {titulo}
        </Text>
        {acao}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.md },
  indicador: { flexGrow: 1, flexBasis: 200, gap: 4, padding: Espaco.lg, borderRadius: Raio.md },
  borda: { borderWidth: 1, borderColor: Cores.borda },
  linhaRotulo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.sm, flexWrap: 'wrap' },
  rotulo: { fontSize: 13, color: Cores.textoSuave },
  valor: { fontSize: 22, fontWeight: '700' },
  detalhe: { fontSize: 12, color: Cores.textoSuave },
  faixa: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
    overflow: 'hidden',
  },
  // borda à esquerda e embaixo de cada item: vira grade de linhas finas quando quebra
  itemFaixa: {
    flexGrow: 1,
    flexBasis: 150,
    gap: 2,
    paddingHorizontal: Espaco.lg,
    paddingVertical: Espaco.md,
    marginLeft: -1,
    marginBottom: -1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: Cores.borda,
  },
  rotuloFaixa: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', color: Cores.textoSuave },
  valorFaixa: { fontSize: 18, fontWeight: '700' },
  detalheFaixa: { fontSize: 11, lineHeight: 15, color: Cores.textoSuave },
  secao: {
    gap: Espaco.md,
    padding: Espaco.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  secaoCabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Espaco.md, flexWrap: 'wrap' },
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: Cores.texto },
});
