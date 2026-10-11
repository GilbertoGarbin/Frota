import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Cores, Espaco } from '@/constants/tema';

type Props = PropsWithChildren<{ titulo?: string; subtitulo?: string }>;

/** Tela de formulário: conteúdo centralizado, largura limitada no desktop, rola com o teclado aberto. */
export function Tela({ titulo, subtitulo, children }: Props) {
  return (
    <SafeAreaView style={styles.fundo}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.rolagem} keyboardShouldPersistTaps="handled">
          <View style={styles.conteudo}>
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
  fundo: { flex: 1, backgroundColor: Cores.fundo },
  rolagem: { flexGrow: 1, justifyContent: 'center', padding: Espaco.xl },
  conteudo: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: Espaco.lg },
  titulo: { fontSize: 26, fontWeight: '700', color: Cores.texto },
  subtitulo: { fontSize: 15, lineHeight: 22, color: Cores.textoSuave, marginTop: -Espaco.sm },
});
