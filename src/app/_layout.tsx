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
  const { estado, anonimo } = useSessao();
  const [pronto, setPronto] = useState(false);
  if (!pronto && estado !== 'carregando') setPronto(true);

  // Só monta as rotas quando a sessão é conhecida pela primeira vez; assim um link direto
  // para /cadastro ou /ativar não é desviado para o login enquanto o app abre.
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
      <Stack.Protected guard={estado === 'deslogado'}>
        <Stack.Screen name="entrar" />
        <Stack.Screen name="cadastro" />
      </Stack.Protected>
      {/* A tela de ativação abre a sessão anônima no meio do envio: precisa continuar
          montada enquanto o acesso dessa sessão é consultado ('carregando'). */}
      <Stack.Protected
        guard={estado === 'deslogado' || estado === 'ativacao' || (estado === 'carregando' && anonimo)}>
        <Stack.Screen name="ativar" />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'sem_transportadora'}>
        <Stack.Screen name="transportadora" />
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
