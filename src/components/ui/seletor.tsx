import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCampoCompacto } from '@/components/ui/campo';
import { Cores, Espaco, Raio } from '@/constants/tema';

type Props<T extends string> = {
  rotulo: string;
  opcoes: readonly { valor: T; rotulo: string }[];
  valor: T | null;
  onChange: (valor: T) => void;
  ajuda?: string;
  /** texto da caixa enquanto nada foi escolhido */
  placeholder?: string;
  /** sem rótulo em cima e mais baixo: para o cabeçalho das listas (filtros) */
  compacto?: boolean;
};

/**
 * Escolha numa lista que abre por cima da tela (web e celular). Para listas que crescem com o
 * cadastro (veículos, motoristas, viagens); para 2 ou 3 opções fixas, usar Segmentado.
 */
export function Seletor<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
  ajuda,
  placeholder = 'Escolher…',
  compacto,
}: Props<T>) {
  const [aberto, setAberto] = useState(false);
  const denso = useCampoCompacto();
  const escolhida = opcoes.find((o) => o.valor === valor);

  return (
    <View style={[styles.grupo, compacto && styles.grupoCompacto]}>
      {compacto ? null : <Text style={[styles.rotulo, denso && styles.rotuloDenso]}>{rotulo}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        accessibilityHint="Abre a lista para escolher"
        onPress={() => setAberto(true)}
        style={({ pressed }) => [styles.caixa, denso && styles.caixaDensa, compacto && styles.caixaCompacta, pressed && styles.pressionado]}>
        <Text style={[styles.valor, compacto && styles.valorCompacto, !escolhida && styles.vazio]} numberOfLines={1}>
          {escolhida?.rotulo ?? placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={Cores.textoSuave} />
      </Pressable>
      {ajuda ? <Text style={[styles.ajuda, denso && styles.ajudaDensa]}>{ajuda}</Text> : null}

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <Pressable style={styles.fundo} onPress={() => setAberto(false)} accessibilityLabel="Fechar a lista">
          <Pressable style={styles.cartao} onPress={() => {}}>
            <Text style={styles.titulo}>{rotulo}</Text>
            <ScrollView style={styles.lista} keyboardShouldPersistTaps="handled">
              {opcoes.map((o) => {
                const marcada = o.valor === valor;
                return (
                  <Pressable
                    key={o.valor}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: marcada }}
                    onPress={() => {
                      onChange(o.valor);
                      setAberto(false);
                    }}
                    style={({ pressed }) => [styles.opcao, marcada && styles.marcada, pressed && styles.pressionado]}>
                    <Text style={[styles.opcaoTexto, marcada && styles.opcaoMarcada]}>{o.rotulo}</Text>
                    {marcada ? <MaterialCommunityIcons name="check" size={20} color={Cores.primaria} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setAberto(false)} style={styles.cancelar}>
              <Text style={styles.cancelarTexto}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: Espaco.xs },
  rotulo: { fontSize: 14, fontWeight: '600', color: Cores.texto },
  caixa: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
    paddingHorizontal: Espaco.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.sm,
    backgroundColor: Cores.branco,
  },
  valor: { flex: 1, fontSize: 16, color: Cores.texto },
  grupoCompacto: { minWidth: 150 },
  caixaCompacta: { minHeight: 36 },
  caixaDensa: { minHeight: 40 },
  rotuloDenso: { fontSize: 13 },
  ajudaDensa: { fontSize: 11, lineHeight: 14 },
  valorCompacto: { fontSize: 14 },
  vazio: { color: Cores.textoSuave },
  ajuda: { fontSize: 13, color: Cores.textoSuave },
  pressionado: { opacity: 0.7 },
  fundo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Espaco.xl,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  cartao: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    gap: Espaco.sm,
    padding: Espaco.lg,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  titulo: { fontSize: 18, fontWeight: '700', color: Cores.texto, paddingHorizontal: Espaco.sm },
  lista: { flexGrow: 0 },
  opcao: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
    paddingHorizontal: Espaco.md,
    borderRadius: Raio.sm,
  },
  marcada: { backgroundColor: Cores.chipClaro },
  opcaoTexto: { flex: 1, fontSize: 16, color: Cores.texto },
  opcaoMarcada: { fontWeight: '700', color: Cores.primariaEscura },
  cancelar: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelarTexto: { fontSize: 16, fontWeight: '600', color: Cores.primaria },
});
