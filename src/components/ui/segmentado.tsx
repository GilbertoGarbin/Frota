import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';

type Props<T extends string> = {
  rotulo: string;
  opcoes: readonly { valor: T; rotulo: string }[];
  valor: T | null;
  onChange: (valor: T) => void;
  ajuda?: string;
};

/** Escolha única entre poucas opções, em botões lado a lado (spec: segmentado, não dropdown). */
export function Segmentado<T extends string>({ rotulo, opcoes, valor, onChange, ajuda }: Props<T>) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={rotulo} style={styles.opcoes}>
        {opcoes.map((opcao) => {
          const marcado = opcao.valor === valor;
          return (
            <Pressable
              key={opcao.valor}
              accessibilityRole="radio"
              accessibilityState={{ checked: marcado }}
              onPress={() => onChange(opcao.valor)}
              style={[styles.opcao, marcado && styles.marcado]}>
              <Text style={[styles.texto, marcado && styles.textoMarcado]}>
                {marcado ? '✓ ' : ''}
                {opcao.rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {ajuda ? <Text style={styles.ajuda}>{ajuda}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: Espaco.xs },
  rotulo: { fontSize: 14, fontWeight: '600', color: Cores.texto },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.sm },
  opcao: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Espaco.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.sm,
    backgroundColor: Cores.branco,
  },
  marcado: { borderColor: Cores.primaria, backgroundColor: Cores.chipClaro },
  texto: { fontSize: 15, color: Cores.texto },
  textoMarcado: { color: Cores.primariaEscura, fontWeight: '600' },
  ajuda: { fontSize: 13, color: Cores.textoSuave },
});
