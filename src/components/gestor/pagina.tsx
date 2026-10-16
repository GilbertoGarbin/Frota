import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco } from '@/constants/tema';

type Props = PropsWithChildren<{
  titulo: string;
  subtitulo?: string;
  /** botão de ação principal, à direita do título */
  acao?: ReactNode;
  /** formulários ficam numa coluna estreita; listas usam a largura toda */
  estreita?: boolean;
  /** formulário grande com campos lado a lado (LinhaForm) */
  media?: boolean;
  /** subtítulo na mesma linha do título (quebra para baixo se não couber) */
  subtituloAoLado?: boolean;
}>;

/** Área de conteúdo de uma tela do painel do gestor (ao lado do menu). */
export function Pagina({ titulo, subtitulo, acao, estreita, media, subtituloAoLado, children }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.rolagem} keyboardShouldPersistTaps="handled">
      <View style={[styles.conteudo, estreita && styles.estreita, media && styles.media]}>
        <View style={styles.cabecalho}>
          <View style={[styles.titulos, subtituloAoLado && styles.titulosLado]}>
            <Text accessibilityRole="header" style={styles.titulo}>
              {titulo}
            </Text>
            {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
          </View>
          {acao}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rolagem: { flexGrow: 1, padding: Espaco.xl },
  conteudo: { width: '100%', maxWidth: 1200, gap: Espaco.lg },
  estreita: { maxWidth: 560 },
  media: { maxWidth: 920 },
  cabecalho: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  titulos: { flex: 1, minWidth: 200, gap: 2 },
  titulosLado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: Espaco.md },
  titulo: { fontSize: 24, fontWeight: '700', color: Cores.texto },
  subtitulo: { fontSize: 14, color: Cores.textoSuave },
});
