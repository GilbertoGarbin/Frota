import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { createContext, use, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';

type Props = TextInputProps & {
  rotulo: string;
  ajuda?: string;
  /** botão dentro do campo, à direita (ex.: calendário) */
  acessorio?: ReactNode;
};

// Formulários densos (janelas do painel): campos mais baixos, sem mudar cada campo um a um
const Compacto = createContext(false);
export const useCampoCompacto = () => use(Compacto);

/** Todos os Campo, CampoData e Seletor dentro deste bloco ficam mais baixos. */
export function FormularioCompacto({ children }: PropsWithChildren) {
  return <Compacto value>{children}</Compacto>;
}

/** Campo com rótulo. Campo de senha ganha o botão de olho para mostrar o que foi digitado. */
export function Campo({ rotulo, ajuda, style, secureTextEntry, acessorio, ...resto }: Props) {
  const [mostrar, setMostrar] = useState(false);
  const compacto = useCampoCompacto();
  const [dicaAberta, setDicaAberta] = useState(false);
  const temBotao = secureTextEntry || acessorio !== undefined;
  const entrada = (
    <TextInput
      accessibilityLabel={rotulo}
      placeholderTextColor={Cores.textoSuave}
      style={[styles.entrada, compacto && styles.entradaCompacta, temBotao && styles.comOlho, style]}
      secureTextEntry={secureTextEntry && !mostrar}
      {...resto}
    />
  );
  // no formulário compacto a explicação vira um ⓘ ao lado do rótulo (não desalinha os campos)
  const dicaNoRotulo = compacto && !!ajuda;
  return (
    <View style={[styles.grupo, dicaAberta && styles.grupoPorCima]}>
      <View style={styles.rotuloLinha}>
        <Text style={[styles.rotulo, compacto && styles.rotuloCompacto]}>{rotulo}</Text>
        {dicaNoRotulo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Explicação: ${ajuda}`}
            onPress={() => setDicaAberta((v) => !v)}
            onHoverIn={() => setDicaAberta(true)}
            onHoverOut={() => setDicaAberta(false)}
            hitSlop={8}>
            <MaterialCommunityIcons name="information-outline" size={16} color={Cores.textoSuave} />
          </Pressable>
        ) : null}
        {dicaNoRotulo && dicaAberta ? (
          <View style={styles.balao} pointerEvents="none">
            <Text style={styles.balaoTexto}>{ajuda}</Text>
          </View>
        ) : null}
      </View>
      {acessorio !== undefined ? (
        <View>
          {entrada}
          <View style={styles.olho}>{acessorio}</View>
        </View>
      ) : secureTextEntry ? (
        <View>
          {entrada}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mostrar ? 'Esconder a senha' : 'Mostrar a senha'}
            onPress={() => setMostrar((v) => !v)}
            hitSlop={8}
            style={styles.olho}>
            <MaterialCommunityIcons name={mostrar ? 'eye-off-outline' : 'eye-outline'} size={22} color={Cores.textoSuave} />
          </Pressable>
        </View>
      ) : (
        entrada
      )}
      {ajuda && !dicaNoRotulo ? <Text style={styles.ajuda}>{ajuda}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: Espaco.xs },
  // o balão da dica fica por cima dos campos vizinhos
  grupoPorCima: { zIndex: 10 },
  rotuloLinha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.xs },
  balao: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    zIndex: 10,
    padding: Espaco.sm,
    borderRadius: Raio.sm,
    backgroundColor: Cores.texto,
  },
  balaoTexto: { fontSize: 12, lineHeight: 17, color: Cores.branco },
  rotulo: { fontSize: 14, fontWeight: '600', color: Cores.texto },
  entrada: {
    minHeight: 48,
    paddingHorizontal: Espaco.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.sm,
    backgroundColor: Cores.branco,
    fontSize: 16,
    color: Cores.texto,
  },
  entradaCompacta: { minHeight: 40, fontSize: 15 },
  rotuloCompacto: { fontSize: 13 },
  comOlho: { paddingRight: 48 },
  olho: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
  ajuda: { fontSize: 13, color: Cores.textoSuave },
});
