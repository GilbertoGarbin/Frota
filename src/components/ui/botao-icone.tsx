import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet } from 'react-native';

import { Cores } from '@/constants/tema';

type Props = {
  icone: keyof typeof MaterialCommunityIcons.glyphMap;
  /** o que o botão faz (leitor de tela) — ex.: "Lançar abastecimento" */
  rotulo: string;
  onPress: () => void;
};

/** Botão redondo só com ícone, para ações do cabeçalho dos blocos (ex.: "+" para lançar). */
export function BotaoIcone({ icone, rotulo, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}>
      <MaterialCommunityIcons name={icone} size={20} color={Cores.primaria} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  botao: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Cores.primaria,
    backgroundColor: Cores.branco,
  },
  pressionado: { backgroundColor: Cores.chipClaro },
});
