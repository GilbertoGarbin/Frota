import { Children, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espaco } from '@/constants/tema';

type Props = PropsWithChildren<{ /** largura mínima de cada campo antes de quebrar a linha */ minimo?: number }>;

/**
 * Campos lado a lado no computador; no celular (ou janela estreita) cada um desce para a
 * linha de baixo sozinho, sem precisar saber o tamanho da tela.
 */
export function LinhaForm({ minimo = 240, children }: Props) {
  return (
    <View style={styles.linha}>
      {Children.toArray(children).map((filho, i) => (
        <View key={i} style={[styles.item, { flexBasis: minimo }]}>
          {filho}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.lg },
  item: { flexGrow: 1, minWidth: 0 },
});
