import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';
import { deslocarMes, rotuloMes, type Mes } from '@/utils/formato';

export function SeletorMes({ mes, onChange }: { mes: Mes; onChange: (mes: Mes) => void }) {
  return (
    <View style={styles.caixa}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mês anterior"
        onPress={() => onChange(deslocarMes(mes, -1))}
        style={styles.seta}>
        <Text style={styles.setaTexto}>‹</Text>
      </Pressable>
      <Text style={styles.rotulo}>{rotuloMes(mes)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Próximo mês"
        onPress={() => onChange(deslocarMes(mes, 1))}
        style={styles.seta}>
        <Text style={styles.setaTexto}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.sm,
    backgroundColor: Cores.branco,
  },
  seta: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  setaTexto: { fontSize: 22, color: Cores.primaria },
  rotulo: { minWidth: 130, textAlign: 'center', fontSize: 14, fontWeight: '600', color: Cores.texto, paddingHorizontal: Espaco.xs },
});
