import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Cores } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';

// Porta de entrada: manda cada estado de sessão para a tela dele.
export default function Index() {
  const { estado, recarregarAcesso, sair } = useSessao();

  switch (estado) {
    case 'deslogado':
      return <Redirect href="/entrar" />;
    case 'sem_transportadora':
      return <Redirect href="/transportadora" />;
    case 'plataforma':
      return <Redirect href="/plataforma" />;
    case 'primeiro_acesso':
      return <Redirect href="/trocar-senha" />;
    case 'assinatura_vencida':
      return <Redirect href="/assinatura" />;
    case 'gestor':
      return <Redirect href="/gestor" />;
    case 'motorista':
      return <Redirect href="/motorista" />;
    case 'sem_conexao':
      return (
        <Tela titulo="Sem conexão">
          <Aviso tipo="erro">Não foi possível carregar sua conta. Verifique a internet.</Aviso>
          <Botao titulo="Tentar de novo" onPress={recarregarAcesso} />
          <Botao titulo="Sair" variante="link" onPress={sair} />
        </Tela>
      );
    case 'carregando':
      // logo após o login, enquanto o papel do usuário é consultado
      return (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={Cores.primaria} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Cores.fundo },
});
