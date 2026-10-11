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
