import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Cores, Espaco, Raio } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';

// Menu da spec do gestor (seção 4). Itens sem rota ainda não foram construídos.
const MENU: { rotulo: string; rota?: Href }[] = [
  { rotulo: 'Visão Geral', rota: '/gestor' },
  { rotulo: 'Viagens' },
  { rotulo: 'Veículos', rota: '/gestor/veiculos' },
  { rotulo: 'Motoristas', rota: '/gestor/motoristas' },
  { rotulo: 'Manutenções' },
  { rotulo: 'Custos Fixos' },
  { rotulo: 'Financeiro' },
];

const LARGURA_DESKTOP = 900;

export default function GestorLayout() {
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_DESKTOP;
  return (
    <SafeAreaView style={[styles.raiz, largo && styles.raizLarga]}>
      <Menu largo={largo} />
      <View style={styles.conteudo}>
        <Slot />
      </View>
    </SafeAreaView>
  );
}

// Desktop: barra lateral fixa escura (layout escolhido na spec). Tela estreita: faixa no topo.
function Menu({ largo }: { largo: boolean }) {
  const router = useRouter();
  const caminho = usePathname();
  const { acesso, sair } = useSessao();

  const itens = MENU.map((item) => {
    const ativo = item.rota === caminho;
    return (
      <Pressable
        key={item.rotulo}
        accessibilityRole="link"
        accessibilityState={{ selected: ativo, disabled: !item.rota }}
        disabled={!item.rota}
        onPress={() => item.rota && router.navigate(item.rota)}
        style={[styles.item, ativo && styles.itemAtivo]}>
        <Text style={[styles.itemTexto, ativo && styles.itemTextoAtivo, !item.rota && styles.itemEmBreve]}>
          {item.rotulo}
        </Text>
        {!item.rota && largo ? <Text style={styles.emBreve}>em breve</Text> : null}
      </Pressable>
    );
  });

  if (!largo) {
    return (
      <View style={styles.faixa}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faixaItens}>
          {itens}
          <Pressable accessibilityRole="button" onPress={sair} style={styles.item}>
            <Text style={styles.itemTexto}>Sair</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.lateral}>
      <View style={styles.marca}>
        <Text style={styles.marcaNome} numberOfLines={1}>
          {acesso?.tenantNome ?? 'Frota'}
        </Text>
        <Text style={styles.marcaSub}>Gestão de frota</Text>
      </View>
      <View role="navigation" style={styles.lista}>
        {itens}
      </View>
      <View style={styles.rodape}>
        <Text style={styles.usuario} numberOfLines={1}>
          {acesso?.nome ?? ''}
        </Text>
        <Pressable accessibilityRole="button" onPress={sair} style={styles.item}>
          <Text style={styles.itemTexto}>Sair</Text>
        </Pressable>
      </View>
    </View>
  );
}

const TEXTO_MENU = '#CBD5E1';
const TEXTO_MENU_SUAVE = '#94A3B8';

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.texto },
  raizLarga: { flexDirection: 'row' },
  conteudo: { flex: 1, backgroundColor: Cores.fundo },

  lateral: { width: 240, backgroundColor: Cores.texto, paddingVertical: Espaco.xl },
  marca: {
    paddingHorizontal: Espaco.xl,
    paddingBottom: Espaco.xl,
    marginBottom: Espaco.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  marcaNome: { fontSize: 15, fontWeight: '600', color: Cores.branco },
  marcaSub: { fontSize: 12, color: TEXTO_MENU_SUAVE, marginTop: 2 },
  lista: { flex: 1, gap: 2, paddingHorizontal: Espaco.md },
  rodape: {
    gap: Espaco.xs,
    paddingHorizontal: Espaco.md,
    paddingTop: Espaco.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  usuario: { fontSize: 13, color: TEXTO_MENU_SUAVE, paddingHorizontal: Espaco.md },

  faixa: { backgroundColor: Cores.texto },
  faixaItens: { gap: Espaco.xs, padding: Espaco.sm },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.sm,
    minHeight: 40,
    paddingHorizontal: Espaco.md,
    borderRadius: Raio.sm,
  },
  itemAtivo: { backgroundColor: Cores.primaria },
  itemTexto: { fontSize: 14, color: TEXTO_MENU },
  itemTextoAtivo: { color: Cores.branco, fontWeight: '600' },
  itemEmBreve: { color: '#64748B' },
  emBreve: { fontSize: 11, color: '#64748B' },
});
