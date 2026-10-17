import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FaixaAssinatura } from '@/components/gestor/faixa-assinatura';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';

// Menu da spec do gestor (seção 4).
type ItemMenu = { rotulo: string; rota: Href; icone: keyof typeof MaterialCommunityIcons.glyphMap };
const MENU: ItemMenu[] = [
  { rotulo: 'Visão Geral', rota: '/gestor', icone: 'view-dashboard-outline' },
  { rotulo: 'Viagens', rota: '/gestor/viagens', icone: 'map-outline' },
  { rotulo: 'Clientes', rota: '/gestor/clientes', icone: 'domain' },
  { rotulo: 'Veículos & Pneus', rota: '/gestor/veiculos', icone: 'truck-outline' },
  { rotulo: 'Motoristas', rota: '/gestor/motoristas', icone: 'account-group-outline' },
  { rotulo: 'Manutenções', rota: '/gestor/manutencoes', icone: 'wrench-outline' },
  { rotulo: 'Custos Fixos', rota: '/gestor/custos-fixos', icone: 'archive-outline' },
  { rotulo: 'Financeiro', rota: '/gestor/financeiro', icone: 'currency-usd' },
];
// Só o admin da transportadora cadastra usuários
const MENU_ADMIN: ItemMenu[] = [{ rotulo: 'Usuários', rota: '/gestor/usuarios', icone: 'account-key-outline' }];

const LARGURA_DESKTOP = 900;

export default function GestorLayout() {
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_DESKTOP;
  // Clicar no item do menu da tela aberta recomeça a tela (volta para a lista, fecha o formulário)
  const [reinicio, setReinicio] = useState(0);
  return (
    <SafeAreaView style={[styles.raiz, largo && styles.raizLarga]}>
      <Menu largo={largo} aoReabrir={() => setReinicio((n) => n + 1)} />
      <View style={styles.conteudo}>
        <FaixaAssinatura />
        <Slot key={reinicio} />
      </View>
    </SafeAreaView>
  );
}

// Desktop: barra lateral fixa escura (layout escolhido na spec). Tela estreita: faixa no topo.
function Menu({ largo, aoReabrir }: { largo: boolean; aoReabrir: () => void }) {
  const router = useRouter();
  const caminho = usePathname();
  const { acesso, sair } = useSessao();

  const menu = acesso?.papel === 'admin' ? [...MENU, ...MENU_ADMIN] : MENU;
  const itens = menu.map((item) => {
    const ativo = item.rota === caminho;
    return (
      <Pressable
        key={item.rotulo}
        accessibilityRole="link"
        accessibilityState={{ selected: ativo, disabled: !item.rota }}
        disabled={!item.rota}
        onPress={() => {
          if (!item.rota) return;
          if (ativo) aoReabrir();
          router.navigate(item.rota);
        }}
        style={[styles.item, styles.itemComIcone, ativo && styles.itemAtivo]}>
        {largo ? (
          <MaterialCommunityIcons name={item.icone} size={18} color={ativo ? Cores.branco : TEXTO_MENU} />
        ) : null}
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
          {acesso ? ` · ${acesso.papel === 'admin' ? 'Admin' : 'Gestor'}` : ''}
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
  itemComIcone: { justifyContent: 'flex-start' },
  itemTexto: { fontSize: 14, color: TEXTO_MENU },
  itemTextoAtivo: { color: Cores.branco, fontWeight: '600' },
  itemEmBreve: { color: '#64748B' },
  emBreve: { fontSize: 11, color: '#64748B' },
});
