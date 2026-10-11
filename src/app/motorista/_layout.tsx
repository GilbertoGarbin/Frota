import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BarraInferior } from '@/components/motorista/base';
import { PinPortao } from '@/components/pin-portao';
import { Cores } from '@/constants/tema';
import { MotoristaProvider } from '@/context/MotoristaContext';

export default function MotoristaLayout() {
  return (
    <PinPortao>
      <MotoristaProvider>
        <View style={styles.raiz}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Cores.fundo } }} />
          <BarraInferior />
        </View>
      </MotoristaProvider>
    </PinPortao>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.fundo },
});
