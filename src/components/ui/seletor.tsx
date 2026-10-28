import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';

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

// Na web a lista abre logo abaixo da caixa (ou acima, se não couber); no celular, no meio da tela.
const SUSPENSA = Platform.OS === 'web';
const ALTURA_MAXIMA = 320;

type Caixa = { x: number; y: number; largura: number; altura: number };

/**
 * Escolha numa lista (web: suspensa sob a caixa; celular: por cima da tela). Para listas que crescem com o
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
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const caixaRef = useRef<View>(null);
  const tela = useWindowDimensions();
  const denso = useCampoCompacto();
  const escolhida = opcoes.find((o) => o.valor === valor);

  function abrir() {
    if (!SUSPENSA || !caixaRef.current) {
      setAberto(true);
      return;
    }
    caixaRef.current.measureInWindow((x, y, largura, altura) => {
      setCaixa({ x, y, largura, altura });
      setAberto(true);
    });
  }

  const itens = opcoes.map((o) => {
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
        style={({ pressed, hovered }) => [
          styles.opcao,
          SUSPENSA && styles.opcaoSuspensa,
          marcada && styles.marcada,
          SUSPENSA && hovered && !marcada && styles.sobre,
          pressed && styles.pressionado,
        ]}>
        <Text style={[styles.opcaoTexto, SUSPENSA && styles.opcaoTextoSuspensa, marcada && styles.opcaoMarcada]}>{o.rotulo}</Text>
        {marcada ? <MaterialCommunityIcons name="check" size={SUSPENSA ? 18 : 20} color={Cores.primaria} /> : null}
      </Pressable>
    );
  });

  // posição da lista suspensa: embaixo da caixa; em cima se faltar espaço e houver mais lá
  let posicao: ViewStyle | null = null;
  if (caixa) {
    const largura = Math.max(caixa.largura, 180);
    const esquerda = Math.max(8, Math.min(caixa.x, tela.width - largura - 8));
    const precisa = Math.min(ALTURA_MAXIMA, opcoes.length * 38 + 10);
    const abaixo = tela.height - (caixa.y + caixa.altura) - 12;
    const acima = caixa.y - 12;
    posicao =
      abaixo >= precisa || abaixo >= acima
        ? { top: caixa.y + caixa.altura + 4, left: esquerda, width: largura, maxHeight: Math.min(ALTURA_MAXIMA, abaixo) }
        : { bottom: tela.height - caixa.y + 4, left: esquerda, width: largura, maxHeight: Math.min(ALTURA_MAXIMA, acima) };
  }

  return (
    <View style={[styles.grupo, compacto && styles.grupoCompacto]}>
      {compacto ? null : <Text style={[styles.rotulo, denso && styles.rotuloDenso]}>{rotulo}</Text>}
      <Pressable
        ref={caixaRef}
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        accessibilityHint="Abre a lista para escolher"
        onPress={abrir}
        style={({ pressed }) => [styles.caixa, denso && styles.caixaDensa, compacto && styles.caixaCompacta, pressed && styles.pressionado]}>
        <Text style={[styles.valor, compacto && styles.valorCompacto, !escolhida && styles.vazio]} numberOfLines={1}>
          {escolhida?.rotulo ?? placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={Cores.textoSuave} />
      </Pressable>
      {ajuda ? <Text style={[styles.ajuda, denso && styles.ajudaDensa]}>{ajuda}</Text> : null}

      {SUSPENSA && posicao ? (
        <Modal visible={aberto} transparent animationType="none" onRequestClose={() => setAberto(false)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAberto(false)} accessibilityLabel="Fechar a lista" />
          <View style={[styles.suspensa, posicao]}>
            <ScrollView keyboardShouldPersistTaps="handled">{itens}</ScrollView>
          </View>
        </Modal>
      ) : (
        <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
          <Pressable style={styles.fundo} onPress={() => setAberto(false)} accessibilityLabel="Fechar a lista">
            <Pressable style={styles.cartao} onPress={() => {}}>
              <Text style={styles.titulo}>{rotulo}</Text>
              <ScrollView style={styles.lista} keyboardShouldPersistTaps="handled">
                {itens}
              </ScrollView>
              <Pressable accessibilityRole="button" onPress={() => setAberto(false)} style={styles.cancelar}>
                <Text style={styles.cancelarTexto}>Cancelar</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
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
  sobre: { backgroundColor: Cores.fundo },
  suspensa: {
    position: 'absolute',
    padding: 4,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.sm,
    backgroundColor: Cores.branco,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
  },
  opcaoSuspensa: { minHeight: 36, paddingHorizontal: Espaco.sm, borderRadius: 6 },
  opcaoTextoSuspensa: { fontSize: 14 },
  opcaoTexto: { flex: 1, fontSize: 16, color: Cores.texto },
  opcaoMarcada: { fontWeight: '700', color: Cores.primariaEscura },
  cancelar: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelarTexto: { fontSize: 16, fontWeight: '600', color: Cores.primaria },
});
