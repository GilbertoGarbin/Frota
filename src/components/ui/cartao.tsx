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
  /** comparação com o período anterior; bom = verde, ruim = vermelho, null = cinza */
  variacao?: { texto: string; bom: boolean | null };
  /** conteúdo extra ao lado do rótulo (ex.: selo Estimado/Apurado) */
  extra?: ReactNode;
  /** cabem mais cartões na linha (ex.: cinco no topo do detalhe da viagem) */
  estreito?: boolean;
  onPress?: () => void;
};

/** Cartão de total com faixa colorida à esquerda. Usar dentro de uma Grade. */
export function CartaoResumo({ rotulo, valor, detalhe, cor, apagado, fundo, variacao, extra, estreito, onPress }: PropsResumo) {
  const conteudo = (
    <>
      <View style={styles.linhaRotulo}>
        <Text style={styles.rotulo}>{rotulo}</Text>
        {extra}
      </View>
      <Text style={[styles.valorResumo, { color: apagado ? Cores.texto : cor }]}>{valor}</Text>
      {variacao ? (
        <Text style={styles.detalhe}>
          <Text
            style={[
              styles.variacao,
              { color: variacao.bom === null ? Cores.textoSuave : variacao.bom ? Cores.sucessoTexto : Cores.perigo },
            ]}>
            {variacao.texto}
          </Text>
          {detalhe ? ` ${detalhe}` : ''}
        </Text>
      ) : detalhe ? (
        <Text style={styles.detalhe}>{detalhe}</Text>
      ) : null}
    </>
  );
  const estilo = [styles.resumo, estreito && styles.resumoEstreito, { borderLeftColor: cor }, fundo ? { backgroundColor: fundo } : null];
  return onPress ? (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed, hovered }) => [...estilo, (pressed || hovered) && styles.resumoSobre]}>
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

type PropsRecolhivel = {
  titulo: string;
  /** linha de resumo ao lado do título (ex.: "2 abastecimentos · R$ 2.950,58") */
  resumo: string;
  /** selos ao lado do resumo (ex.: "a pagar") */
  extra?: ReactNode;
  acao?: ReactNode;
  /** conteúdo que fica sempre visível (ex.: formulário de lançamento aberto) */
  topo?: ReactNode;
  /** ícone num círculo e faixa à esquerda, na cor indicada */
  icone?: { nome: keyof typeof MaterialCommunityIcons.glyphMap; cor: string };
  /** já começa com a lista aberta (ex.: voltando da conta de um lançamento) */
  abertaInicial?: boolean;
  children: ReactNode;
};

/** Seção que mostra só o resumo, tudo numa linha; tocar no cabeçalho abre e fecha a lista. */
export function SecaoRecolhivel({ titulo, resumo, extra, acao, topo, icone, abertaInicial = false, children }: PropsRecolhivel) {
  const [aberta, setAberta] = useState(abertaInicial);
  return (
    <View style={[styles.secao, styles.secaoRecolhivel, icone && { borderLeftWidth: 4, borderLeftColor: icone.cor }]}>
      <View style={styles.secaoCabecalho}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: aberta }}
          accessibilityLabel={`${titulo}: ${resumo}. ${aberta ? 'Fechar' : 'Abrir'} a lista`}
          onPress={() => setAberta((a) => !a)}
          style={styles.recolhivelBotao}>
          <MaterialCommunityIcons name={aberta ? 'chevron-up' : 'chevron-down'} size={22} color={Cores.textoSuave} />
          {icone ? (
            <View style={[styles.recolhivelIcone, { backgroundColor: `${icone.cor}1A` }]}>
              <MaterialCommunityIcons name={icone.nome} size={18} color={icone.cor} />
            </View>
          ) : null}
          <View style={styles.recolhivelTextos}>
            <Text accessibilityRole="header" style={styles.secaoTitulo}>
              {titulo}
            </Text>
            <Text style={styles.recolhivelResumo}>{resumo}</Text>
            {extra}
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
  recolhivelTextos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: Espaco.md, rowGap: 2, flexShrink: 1 },
  recolhivelIcone: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  secaoRecolhivel: { paddingVertical: Espaco.sm },
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
  resumoEstreito: { flexBasis: 170 },
  valorResumo: { fontSize: 20, fontWeight: '700' },
  variacao: { fontWeight: '700' },
  resumoSobre: { boxShadow: '0 4px 14px rgba(15, 23, 42, 0.10)' },
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
