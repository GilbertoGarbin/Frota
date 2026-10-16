import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Cores, Espaco, Raio } from '@/constants/tema';

export type ConteudoMensagem = { titulo: string; texto?: string; itens?: string[] };

type Props = { mensagem: ConteudoMensagem | null; aoFechar: () => void };

/** Janelinha por cima da tela (web e celular) para avisos que a pessoa precisa ler, como campos faltando. */
export function Mensagem({ mensagem, aoFechar }: Props) {
  return (
    <Modal visible={mensagem !== null} transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable style={styles.fundo} onPress={aoFechar} accessibilityLabel="Fechar">
        {/* toque dentro do cartão não fecha */}
        <Pressable style={styles.cartao} onPress={() => {}} accessibilityRole="alert">
          <Text style={styles.titulo}>{mensagem?.titulo}</Text>
          {mensagem?.texto ? <Text style={styles.texto}>{mensagem.texto}</Text> : null}
          {mensagem?.itens?.length ? (
            <View style={styles.lista}>
              {mensagem.itens.map((item) => (
                <Text key={item} style={styles.texto}>{`•  ${item}`}</Text>
              ))}
            </View>
          ) : null}
          <Botao titulo="Entendi" onPress={aoFechar} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Espaco.xl,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  cartao: {
    width: '100%',
    maxWidth: 400,
    gap: Espaco.md,
    padding: Espaco.xl,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  titulo: { fontSize: 18, fontWeight: '700', color: Cores.texto },
  texto: { fontSize: 15, lineHeight: 22, color: Cores.texto },
  lista: { gap: Espaco.xs },
});
