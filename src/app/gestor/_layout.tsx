import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type ReactNode } from 'react';
import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FaixaAssinatura } from '@/components/gestor/faixa-assinatura';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';

// Menu da spec do gestor (seção 4).
type ItemMenu = {
  rotulo: string;
  rota: Href;
  icone: keyof typeof MaterialCommunityIcons.glyphMap;
  /** subitem (recuado, menor) do item de cima */
  sub?: boolean;
};
const MENU: ItemMenu[] = [
  { rotulo: 'Visão Geral', rota: '/gestor', icone: 'view-dashboard-outline' },
  { rotulo: 'Viagens', rota: '/gestor/viagens', icone: 'map-outline' },
  { rotulo: 'Clientes', rota: '/gestor/clientes', icone: 'domain' },
  { rotulo: 'Veículos & Pneus', rota: '/gestor/veiculos', icone: 'truck-outline' },
  { rotulo: 'Motoristas', rota: '/gestor/motoristas', icone: 'account-group-outline' },
  { rotulo: 'Manutenções', rota: '/gestor/manutencoes', icone: 'wrench-outline' },
  { rotulo: 'Custos Fixos', rota: '/gestor/custos-fixos', icone: 'archive-outline' },
  { rotulo: 'Financeiro', rota: '/gestor/financeiro', icone: 'currency-usd' },
  { rotulo: 'Receber', rota: '/gestor/receber', icone: 'arrow-down-circle-outline', sub: true },
  { rotulo: 'Pagar', rota: '/gestor/pagar', icone: 'arrow-up-circle-outline', sub: true },
  { rotulo: 'Extrato', rota: '/gestor/extrato', icone: 'swap-vertical', sub: true },
];
// Só o admin da transportadora cadastra usuários
const MENU_ADMIN: ItemMenu[] = [
  { rotulo: 'Usuários', rota: '/gestor/usuarios', icone: 'account-key-outline' },
  { rotulo: 'Configurações', rota: '/gestor/configuracoes', icone: 'cog-outline' },
];

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

// Desktop: barra lateral fixa escura (layout escolhido na spec). Tela estreita (celular): barra no
// topo com o botão ☰ e o nome da tela; o botão abre a mesma barra lateral por cima da tela.
function Menu({ largo, aoReabrir }: { largo: boolean; aoReabrir: () => void }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);

  if (largo) return <Lateral aoReabrir={aoReabrir} />;

  const atual = [...MENU, ...MENU_ADMIN].find((item) => item.rota === caminho);
  return (
    <View style={styles.barra}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir o menu"
        onPress={() => setAberto(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.botaoMenu, pressed && styles.botaoMenuApertado]}>
        <MaterialCommunityIcons name="menu" size={26} color={Cores.branco} />
        <Text style={styles.botaoMenuTexto}>Menu</Text>
      </Pressable>
      <Text style={styles.barraTitulo} numberOfLines={1}>
        {atual?.rotulo ?? ''}
      </Text>
      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <View style={styles.gaveta}>
          <SafeAreaView style={styles.gavetaPainel}>
            <Lateral
              aoReabrir={aoReabrir}
              aoEscolher={() => setAberto(false)}
              fechar={
                <Pressable accessibilityRole="button" accessibilityLabel="Fechar o menu" onPress={() => setAberto(false)} hitSlop={10}>
                  <MaterialCommunityIcons name="close" size={24} color={TEXTO_MENU} />
                </Pressable>
              }
            />
          </SafeAreaView>
          {/* tocar fora do menu fecha */}
          <Pressable accessibilityLabel="Fechar o menu" style={styles.gavetaFundo} onPress={() => setAberto(false)} />
        </View>
      </Modal>
    </View>
  );
}

type PropsLateral = {
  aoReabrir: () => void;
  /** no celular: fecha a gaveta ao escolher um item */
  aoEscolher?: () => void;
  /** botão de fechar ao lado do nome (só na gaveta) */
  fechar?: ReactNode;
};

function Lateral({ aoReabrir, aoEscolher, fechar }: PropsLateral) {
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
          aoEscolher?.();
          if (ativo) aoReabrir();
          router.navigate(item.rota);
        }}
        style={[styles.item, styles.itemComIcone, item.sub && styles.itemSub, ativo && styles.itemAtivo]}>
        <MaterialCommunityIcons name={item.icone} size={item.sub ? 15 : 18} color={ativo ? Cores.branco : TEXTO_MENU} />
        <Text
          style={[styles.itemTexto, item.sub && styles.itemTextoSub, ativo && styles.itemTextoAtivo, !item.rota && styles.itemEmBreve]}>
          {item.rotulo}
        </Text>
        {!item.rota ? <Text style={styles.emBreve}>em breve</Text> : null}
      </Pressable>
    );
  });

  return (
    <View style={[styles.lateral, fechar ? styles.lateralGaveta : null]}>
      <View style={[styles.marca, styles.marcaLinha]}>
        <View style={styles.marcaTextos}>
          <Text style={styles.marcaNome} numberOfLines={1}>
            {acesso?.tenantNome ?? 'Frota'}
          </Text>
          <Text style={styles.marcaSub}>Gestão de frota</Text>
        </View>
        {fechar}
      </View>
      {/* rola quando a janela é baixa, sem passar por cima do rodapé */}
      <ScrollView role="navigation" style={styles.lista} contentContainerStyle={styles.listaItens}>
        {itens}
      </ScrollView>
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
  lista: { flex: 1 },
  listaItens: { gap: 2, paddingHorizontal: Espaco.md, paddingBottom: Espaco.md },
  rodape: {
    gap: Espaco.xs,
    paddingHorizontal: Espaco.md,
    paddingTop: Espaco.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  usuario: { fontSize: 13, color: TEXTO_MENU_SUAVE, paddingHorizontal: Espaco.md },

  marcaLinha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.md },
  marcaTextos: { flex: 1 },

  // celular: barra do topo e gaveta
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    minHeight: 56,
    paddingHorizontal: Espaco.md,
    backgroundColor: Cores.texto,
  },
  botaoMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.xs,
    minHeight: 44,
    paddingHorizontal: Espaco.md,
    borderRadius: Raio.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  botaoMenuApertado: { backgroundColor: 'rgba(255,255,255,0.18)' },
  botaoMenuTexto: { fontSize: 15, fontWeight: '600', color: Cores.branco },
  barraTitulo: { flex: 1, fontSize: 16, fontWeight: '600', color: TEXTO_MENU },
  gaveta: { flex: 1, flexDirection: 'row' },
  gavetaPainel: { width: 280, maxWidth: '85%', backgroundColor: Cores.texto },
  gavetaFundo: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)' },
  lateralGaveta: { flex: 1, width: '100%' },

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
  itemSub: { minHeight: 32, marginLeft: Espaco.lg },
  itemTexto: { fontSize: 14, color: TEXTO_MENU },
  itemTextoSub: { fontSize: 13 },
  itemTextoAtivo: { color: Cores.branco, fontWeight: '600' },
  itemEmBreve: { color: '#64748B' },
  emBreve: { fontSize: 11, color: '#64748B' },
});
