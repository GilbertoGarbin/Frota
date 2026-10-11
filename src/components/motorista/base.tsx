import { usePathname, useRouter, type Href } from 'expo-router';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useMotorista } from '@/context/MotoristaContext';
import { anexarArquivo, tirarFoto, type Anexo } from '@/services/anexo.service';
import { mensagemDeErro } from '@/utils/erros';

// Peças comuns das telas do motorista (celular, uso com uma mão, sinal instável).

type PropsTela = PropsWithChildren<{ titulo?: string; subtitulo?: string; aoVoltar?: () => void; acao?: ReactNode }>;

export function TelaMotorista({ titulo, subtitulo, aoVoltar, acao, children }: PropsTela) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.fundo}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.rolagem} keyboardShouldPersistTaps="handled">
          <View style={styles.conteudo}>
            {aoVoltar ? <Botao titulo="‹ Voltar" variante="link" compacto onPress={aoVoltar} /> : null}
            {titulo ? (
              <View style={styles.cabecalho}>
                <View style={styles.titulos}>
                  <Text accessibilityRole="header" style={styles.titulo}>
                    {titulo}
                  </Text>
                  {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
                </View>
                {acao}
              </View>
            ) : null}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ABAS: { rotulo: string; rota: Href; simbolo: string }[] = [
  { rotulo: 'Início', rota: '/motorista', simbolo: '⌂' },
  { rotulo: 'Viagens', rota: '/motorista/historico', simbolo: '☰' },
  { rotulo: 'Perfil', rota: '/motorista/perfil', simbolo: '☺' },
];

/** Navegação inferior: Início · Viagens (histórico) · Perfil (spec do motorista, seção 4) */
export function BarraInferior() {
  const router = useRouter();
  const caminho = usePathname();
  return (
    <SafeAreaView edges={['bottom']} style={styles.barra}>
      <View accessibilityRole="tablist" style={styles.barraItens}>
        {ABAS.map((aba) => {
          const ativa = caminho === aba.rota;
          return (
            <Pressable
              key={aba.rotulo}
              accessibilityRole="tab"
              accessibilityLabel={aba.rotulo}
              accessibilityState={{ selected: ativa }}
              onPress={() => router.navigate(aba.rota)}
              style={styles.aba}>
              <Text style={[styles.abaSimbolo, ativa && styles.abaAtiva]}>{aba.simbolo}</Text>
              <Text style={[styles.abaRotulo, ativa && styles.abaAtiva]}>{aba.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

/** Situação do envio: sem sinal, lançamentos aguardando, ou item que o servidor recusou. */
export function EstadoSincronizacao() {
  const { fila, online, sincronizando, aviso, tentarDeNovo, descartar, sincronizar } = useMotorista();
  const [confirmando, setConfirmando] = useState(false);
  const recusado = fila.find((i) => i.erro);

  if (recusado) {
    return (
      <View style={styles.bloco}>
        <Aviso tipo="erro">{`O servidor recusou “${recusado.descricao}”: ${recusado.erro}`}</Aviso>
        <Botao titulo="Tentar de novo" variante="contorno" compacto onPress={() => tentarDeNovo(recusado)} />
        {confirmando ? (
          <Botao
            titulo="Confirmar: descartar este lançamento"
            variante="perigo"
            compacto
            onPress={() => {
              setConfirmando(false);
              descartar(recusado);
            }}
          />
        ) : (
          <Botao titulo="Descartar este lançamento" variante="link" compacto onPress={() => setConfirmando(true)} />
        )}
      </View>
    );
  }
  if (fila.length > 0) {
    return (
      <View style={styles.bloco}>
        <Aviso tipo="info">
          {online
            ? `${fila.length} envio(s) aguardando. ${sincronizando ? 'Enviando…' : 'Será enviado em instantes.'}`
            : `Sem sinal. ${fila.length} envio(s) guardado(s) no aparelho — serão enviados quando a internet voltar.`}
        </Aviso>
        {online && !sincronizando ? <Botao titulo="Enviar agora" variante="link" compacto onPress={sincronizar} /> : null}
      </View>
    );
  }
  if (!online) return <Aviso tipo="info">Sem sinal. Você pode continuar lançando; tudo fica guardado no aparelho.</Aviso>;
  if (aviso) return <Aviso tipo="erro">{aviso}</Aviso>;
  return null;
}

/** Comprovante/arquivo: câmera como ação principal (spec, seção 2) */
export function CampoAnexo({ rotulo, anexo, onChange }: { rotulo: string; anexo: Anexo | null; onChange: (anexo: Anexo | null) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function escolher(origem: () => Promise<Anexo | null>) {
    setErro(null);
    setOcupado(true);
    try {
      const escolhido = await origem();
      if (escolhido) onChange(escolhido);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
    setOcupado(false);
  }

  return (
    <View style={styles.bloco}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {anexo ? (
        <View style={styles.linha}>
          <View style={styles.flex}>
            <Aviso tipo="sucesso">{anexo.extensao === 'pdf' ? `Arquivo anexado: ${anexo.nome}` : 'Foto anexada.'}</Aviso>
          </View>
          <Botao titulo="Remover" variante="link" compacto onPress={() => onChange(null)} />
        </View>
      ) : (
        <View style={styles.linha}>
          <View style={styles.flex}>
            <Botao titulo="Tirar foto" compacto onPress={() => escolher(tirarFoto)} carregando={ocupado} />
          </View>
          <View style={styles.flex}>
            <Botao titulo="Anexar arquivo" variante="contorno" compacto onPress={() => escolher(anexarArquivo)} desativado={ocupado} />
          </View>
        </View>
      )}
    </View>
  );
}

/** Valor calculado: bloco de "resultado", nunca com cara de campo editável (spec, seção 2) */
export function ValorCalculado({ rotulo, valor, nota, trancado }: { rotulo: string; valor: string; nota?: string; trancado?: boolean }) {
  return (
    <View style={styles.calculado}>
      <Text style={styles.calculadoRotulo}>
        {trancado ? '🔒 ' : ''}
        {rotulo}
      </Text>
      <Text style={styles.calculadoValor}>{valor}</Text>
      {nota ? <Text style={styles.calculadoNota}>{nota}</Text> : null}
    </View>
  );
}

/** Linha "rótulo: valor" somente leitura */
export function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.dado}>
      <Text style={styles.dadoRotulo}>{rotulo}</Text>
      <Text style={styles.dadoValor}>{valor}</Text>
    </View>
  );
}

export function Cartao({ children, onPress, rotuloAcessivel }: PropsWithChildren<{ onPress?: () => void; rotuloAcessivel?: string }>) {
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={rotuloAcessivel} onPress={onPress} style={styles.cartao}>
      {children}
    </Pressable>
  ) : (
    <View style={styles.cartao}>{children}</View>
  );
}

export const estilosMotorista = StyleSheet.create({
  titulo: { fontSize: 17, fontWeight: '700', color: Cores.texto },
  texto: { fontSize: 15, color: Cores.texto },
  suave: { fontSize: 13, lineHeight: 19, color: Cores.textoSuave },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.sm },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.sm },
  metade: { flexGrow: 1, flexBasis: '45%' },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fundo: { flex: 1, backgroundColor: Cores.fundo },
  rolagem: { flexGrow: 1, padding: Espaco.lg },
  conteudo: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: Espaco.md },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Espaco.md },
  titulos: { flex: 1, gap: 2 },
  titulo: { fontSize: 22, fontWeight: '700', color: Cores.texto },
  subtitulo: { fontSize: 14, color: Cores.textoSuave },
  bloco: { gap: Espaco.sm },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.sm },
  rotulo: { fontSize: 14, fontWeight: '600', color: Cores.texto },

  barra: { backgroundColor: Cores.branco, borderTopWidth: 1, borderTopColor: Cores.borda },
  barraItens: { flexDirection: 'row', maxWidth: 520, width: '100%', alignSelf: 'center' },
  aba: { flex: 1, alignItems: 'center', paddingVertical: Espaco.sm, minHeight: 56, justifyContent: 'center' },
  abaSimbolo: { fontSize: 20, color: Cores.textoSuave },
  abaRotulo: { fontSize: 12, color: Cores.textoSuave },
  abaAtiva: { color: Cores.primaria, fontWeight: '700' },

  calculado: { gap: 2, padding: Espaco.md, borderRadius: Raio.sm, backgroundColor: Cores.chipClaro },
  calculadoRotulo: { fontSize: 13, fontWeight: '600', color: Cores.primariaEscura },
  calculadoValor: { fontSize: 20, fontWeight: '700', color: Cores.primariaEscura },
  calculadoNota: { fontSize: 12, color: Cores.primariaEscura },

  dado: { flexDirection: 'row', justifyContent: 'space-between', gap: Espaco.md, paddingVertical: 6 },
  dadoRotulo: { fontSize: 14, color: Cores.textoSuave },
  dadoValor: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: Cores.texto, textAlign: 'right' },

  cartao: {
    gap: Espaco.sm,
    padding: Espaco.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
});
