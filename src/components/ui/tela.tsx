import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Cores, Espaco, Raio } from '@/constants/tema';

type Props = PropsWithChildren<{ titulo?: string; subtitulo?: string }>;

// caminhão branco sem fundo (o mesmo da abertura do app)
const caminhao = require('../../../assets/images/splash-icon.png');

/**
 * Telas antes do sistema (login, cadastro, PIN, assinatura): fundo na cor da marca, nome do
 * Frota em cima e o formulário num cartão branco. Rola com o teclado aberto.
 */
export function Tela({ titulo, subtitulo, children }: Props) {
  return (
    <SafeAreaView style={styles.fundo}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.rolagem} keyboardShouldPersistTaps="handled">
          <View style={styles.marca}>
            <Image source={caminhao} style={styles.logo} contentFit="contain" accessibilityIgnoresInvertColors />
            <Text style={styles.nome}>Frota</Text>
            <Text style={styles.frase}>Sua frota no controle, viagem por viagem.</Text>
          </View>
          <View style={styles.cartao}>
            {titulo ? <Text style={styles.titulo}>{titulo}</Text> : null}
            {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fundo: { flex: 1, backgroundColor: Cores.primaria },
  rolagem: { flexGrow: 1, justifyContent: 'center', padding: Espaco.lg, gap: Espaco.xl },
  marca: { alignItems: 'center', gap: 2 },
  logo: { width: 64, height: 64 },
  nome: { fontSize: 28, fontWeight: '700', color: Cores.branco },
  frase: { fontSize: 14, color: '#DCE8FF', textAlign: 'center' },
  cartao: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Espaco.lg,
    padding: Espaco.xl,
    borderRadius: Raio.md + 4,
    backgroundColor: Cores.branco,
  },
  titulo: { fontSize: 22, fontWeight: '700', color: Cores.texto },
  subtitulo: { fontSize: 15, lineHeight: 22, color: Cores.textoSuave, marginTop: -Espaco.sm },
});
