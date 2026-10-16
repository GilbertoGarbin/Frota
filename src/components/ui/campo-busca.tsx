import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';

type Props = { valor: string; onChange: (valor: string) => void; placeholder: string };

/** Busca compacta, sem rótulo, para o cabeçalho das listas (ao lado do botão de ação). */
export function CampoBusca({ valor, onChange, placeholder }: Props) {
  return (
    <View style={styles.caixa}>
      <MaterialCommunityIcons name="magnify" size={20} color={Cores.textoSuave} />
      <TextInput
        accessibilityLabel="Buscar"
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Cores.textoSuave}
        autoCorrect={false}
        style={styles.entrada}
      />
      {valor ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => onChange('')} hitSlop={8}>
          <MaterialCommunityIcons name="close-circle" size={18} color={Cores.textoSuave} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 240,
    minWidth: 0,
    maxWidth: 360,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
    paddingHorizontal: Espaco.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.sm,
    backgroundColor: Cores.branco,
  },
  entrada: { flex: 1, minWidth: 0, paddingVertical: 6, fontSize: 14, color: Cores.texto },
});
