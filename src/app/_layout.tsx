import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Cores } from '@/constants/tema';
import { SessaoProvider, useSessao } from '@/context/SessaoContext';

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Cores.fundo },
});

export default function RootLayout() {
  return (
    <SessaoProvider>
      <Navegacao />
    </SessaoProvider>
  );
}

// Cada grupo de telas só existe no estado de sessão correspondente. Quando o estado muda,
// o Expo Router volta para "index", que redireciona para a tela certa.
function Navegacao() {
  const { estado } = useSessao();
  const [pronto, setPronto] = useState(false);
  if (!pronto && estado !== 'carregando') setPronto(true);

  // Só monta as rotas quando a sessão é conhecida pela primeira vez; assim um link direto
  // para /cadastro não é desviado para o login enquanto o app abre.
  if (!pronto) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={Cores.primaria} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* aberta pelo link do e-mail, com ou sem sessão */}
      <Stack.Screen name="redefinir-senha" />
      <Stack.Protected guard={estado === 'deslogado'}>
        <Stack.Screen name="entrar" />
        <Stack.Screen name="cadastro" />
        <Stack.Screen name="esqueci-senha" />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'sem_transportadora'}>
        <Stack.Screen name="transportadora" />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'primeiro_acesso'}>
        <Stack.Screen name="trocar-senha" />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'assinatura_vencida'}>
        <Stack.Screen name="assinatura" />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'plataforma'}>
        <Stack.Screen name="plataforma" />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'gestor'}>
        <Stack.Screen name="gestor" />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'motorista'}>
        <Stack.Screen name="motorista" />
      </Stack.Protected>
    </Stack>
  );
}
