import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
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

type PropsResumo = {
  rotulo: string;
  valor: string;
  detalhe?: string;
  /** cor da faixa à esquerda e do valor */
  cor: string;
  /** valor em cinza (ex.: atrasado zerado), mantendo a faixa colorida */
  apagado?: boolean;
  /** fundo colorido para chamar atenção (ex.: há contas atrasadas) */
  fundo?: string;
};

/** Cartão de total com faixa colorida à esquerda. Usar dentro de uma Grade. */
export function CartaoResumo({ rotulo, valor, detalhe, cor, apagado, fundo }: PropsResumo) {
  return (
    <View style={[styles.resumo, { borderLeftColor: cor }, fundo ? { backgroundColor: fundo } : null]}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={[styles.valorResumo, { color: apagado ? Cores.texto : cor }]}>{valor}</Text>
      {detalhe ? <Text style={styles.detalhe}>{detalhe}</Text> : null}
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

type PropsRecolhivel = {
  titulo: string;
  /** linha de resumo ao lado do título (ex.: "2 abastecimentos · R$ 2.950,58") */
  resumo: string;
  /** selos ao lado do resumo (ex.: "a pagar") */
  extra?: ReactNode;
  acao?: ReactNode;
  /** conteúdo que fica sempre visível (ex.: formulário de lançamento aberto) */
  topo?: ReactNode;
  children: ReactNode;
};

/** Seção que mostra só o resumo; tocar no cabeçalho abre e fecha a lista. */
export function SecaoRecolhivel({ titulo, resumo, extra, acao, topo, children }: PropsRecolhivel) {
  const [aberta, setAberta] = useState(false);
  return (
    <View style={styles.secao}>
      <View style={styles.secaoCabecalho}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: aberta }}
          accessibilityLabel={`${titulo}: ${resumo}. ${aberta ? 'Fechar' : 'Abrir'} a lista`}
          onPress={() => setAberta((a) => !a)}
          style={styles.recolhivelBotao}>
          <MaterialCommunityIcons name={aberta ? 'chevron-up' : 'chevron-down'} size={22} color={Cores.textoSuave} />
          <View style={styles.recolhivelTextos}>
            <Text accessibilityRole="header" style={styles.secaoTitulo}>
              {titulo}
            </Text>
            <View style={styles.linhaRotulo}>
              <Text style={styles.recolhivelResumo}>{resumo}</Text>
              {extra}
            </View>
          </View>
        </Pressable>
        {acao}
      </View>
      {topo}
      {aberta ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  recolhivelBotao: { flexDirection: 'row', alignItems: 'center', gap: Espaco.sm, flexGrow: 1, flexShrink: 1, minWidth: 200 },
  recolhivelTextos: { flexShrink: 1, gap: 2 },
  recolhivelResumo: { fontSize: 14, color: Cores.textoSuave },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.md },
  indicador: { flexGrow: 1, flexBasis: 200, gap: 4, padding: Espaco.lg, borderRadius: Raio.md },
  borda: { borderWidth: 1, borderColor: Cores.borda },
  resumo: {
    flexGrow: 1,
    flexBasis: 200,
    gap: 2,
    paddingHorizontal: Espaco.lg,
    paddingVertical: Espaco.md,
    borderRadius: Raio.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderLeftWidth: 4,
    backgroundColor: Cores.branco,
  },
  valorResumo: { fontSize: 20, fontWeight: '700' },
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
