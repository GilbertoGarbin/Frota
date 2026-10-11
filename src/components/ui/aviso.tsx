import { StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';

type Props = { tipo: 'erro' | 'sucesso' | 'info'; children: string };

// Cor nunca sozinha: todo aviso leva um símbolo além da cor (spec, seção 2).
const ESTILO = {
  erro: { simbolo: '⚠', fundo: Cores.perigoFundo, texto: Cores.perigoTexto },
  sucesso: { simbolo: '✓', fundo: Cores.sucessoFundo, texto: Cores.sucessoTexto },
  info: { simbolo: 'ℹ', fundo: Cores.chipClaro, texto: Cores.primariaEscura },
} as const;

export function Aviso({ tipo, children }: Props) {
  const { simbolo, fundo, texto } = ESTILO[tipo];
  return (
    <View
      accessibilityRole={tipo === 'erro' ? 'alert' : undefined}
      style={[styles.caixa, { backgroundColor: fundo }]}>
      <Text style={[styles.simbolo, { color: texto }]}>{simbolo}</Text>
      <Text style={[styles.texto, { color: texto }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { flexDirection: 'row', gap: Espaco.sm, padding: Espaco.md, borderRadius: Raio.sm },
  simbolo: { fontSize: 15, fontWeight: '700' },
  texto: { flex: 1, fontSize: 14, lineHeight: 20 },
});
