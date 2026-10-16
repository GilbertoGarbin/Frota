import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';

type Props = {
  visivel: boolean;
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
};

/**
 * Janela por cima da tela para formulários de lançamento (como o "+" do FLUXO): fundo
 * escurecido, título com botão de fechar e conteúdo rolável. No celular ocupa quase a tela toda.
 */
export function Janela({ visivel, titulo, aoFechar, children }: Props) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoFechar}>
      <KeyboardAvoidingView style={styles.fundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.janela}>
          <View style={styles.cabecalho}>
            <Text accessibilityRole="header" style={styles.titulo}>
              {titulo}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={aoFechar} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={24} color={Cores.textoSuave} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
            {children}
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
  titulo: { flex: 1, fontSize: 18, fontWeight: '700', color: Cores.texto },
  conteudo: { gap: Espaco.lg, padding: Espaco.xl },
});
