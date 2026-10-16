import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormularioCompacto } from '@/components/ui/campo';
import { Cores, Espaco, Raio } from '@/constants/tema';

type Props = {
  visivel: boolean;
  titulo: string;
  subtitulo?: string;
  aoFechar: () => void;
  children: ReactNode;
};

/**
 * Janela por cima da tela para formulários de lançamento (como o "+" do FLUXO): fundo
 * escurecido, título com botão de fechar e conteúdo rolável. No celular ocupa quase a tela toda.
 */
export function Janela({ visivel, titulo, subtitulo, aoFechar, children }: Props) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoFechar}>
      <KeyboardAvoidingView style={styles.fundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.janela}>
          <View style={styles.cabecalho}>
            <View style={styles.titulos}>
              <Text accessibilityRole="header" style={styles.titulo}>
                {titulo}
              </Text>
              {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={aoFechar} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={24} color={Cores.textoSuave} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
            {/* toda janela de cadastro usa campos compactos (explicações no ⓘ) */}
            <FormularioCompacto>{children}</FormularioCompacto>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Espaco.md,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  janela: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
    overflow: 'hidden',
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.md,
    paddingHorizontal: Espaco.xl,
    paddingVertical: Espaco.lg,
    borderBottomWidth: 1,
    borderBottomColor: Cores.borda,
  },
  titulos: { flex: 1, gap: 2 },
  titulo: { fontSize: 18, fontWeight: '700', color: Cores.texto },
  subtitulo: { fontSize: 13, color: Cores.textoSuave },
  conteudo: { gap: Espaco.md, padding: Espaco.xl },
});
