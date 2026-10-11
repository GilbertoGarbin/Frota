import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';

type Props = {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'contorno' | 'link' | 'perigo';
  /** menor, para ações dentro de tabelas e cabeçalhos */
  compacto?: boolean;
  carregando?: boolean;
  desativado?: boolean;
};

export function Botao({ titulo, onPress, variante = 'primario', compacto, carregando, desativado }: Props) {
  const inativo = desativado || carregando;
  const corTexto = variante === 'primario' || variante === 'perigo' ? Cores.branco : Cores.primaria;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compacto && styles.compacto,
        styles[variante],
        inativo && styles.inativo,
        pressed && styles.pressionado,
      ]}>
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <Text style={[styles.texto, compacto && styles.textoCompacto, { color: corTexto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Espaco.lg,
    borderRadius: Raio.sm,
  },
  compacto: { minHeight: 36, paddingHorizontal: Espaco.md },
  primario: { backgroundColor: Cores.primaria },
  perigo: { backgroundColor: Cores.perigo },
  contorno: { borderWidth: 1, borderColor: Cores.primaria, backgroundColor: Cores.branco },
  link: { minHeight: 40 },
  inativo: { opacity: 0.5 },
  pressionado: { opacity: 0.8 },
  texto: { fontSize: 16, fontWeight: '600' },
  textoCompacto: { fontSize: 14 },
});
