import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';

type Props = TextInputProps & { rotulo: string; ajuda?: string };

export function Campo({ rotulo, ajuda, style, ...resto }: Props) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={Cores.textoSuave}
        style={[styles.entrada, style]}
        {...resto}
      />
      {ajuda ? <Text style={styles.ajuda}>{ajuda}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: Espaco.xs },
  rotulo: { fontSize: 14, fontWeight: '600', color: Cores.texto },
  entrada: {
    minHeight: 48,
    paddingHorizontal: Espaco.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.sm,
    backgroundColor: Cores.branco,
    fontSize: 16,
    color: Cores.texto,
  },
  ajuda: { fontSize: 13, color: Cores.textoSuave },
});
