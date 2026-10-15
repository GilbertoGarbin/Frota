import { Pressable, StyleSheet, Text, View } from 'react-native';

import { abrirWhatsAppAssinatura, WHATSAPP_ASSINATURA } from '@/constants/assinatura';
import { Cores, Espaco } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';

/** Faixa no topo do painel durante a avaliação grátis e na carência depois de vencer. */
export function FaixaAssinatura() {
  const { acesso } = useSessao();
  if (!acesso) return null;
  const { status, diasRestantes, emCarencia, diasCarencia } = acesso.assinatura;
  if (!emCarencia && status !== 'trial') return null;

  const urgente = emCarencia || diasRestantes <= 7;
  const plural = (n: number) => `${n} dia${n === 1 ? '' : 's'}`;
  const texto = emCarencia
    ? `${status === 'trial' ? 'A avaliação' : 'A assinatura'} venceu. Regularize em até ${plural(diasCarencia)} para não perder o acesso.`
    : `Avaliação grátis: ${diasRestantes === 1 ? 'termina amanhã' : `faltam ${plural(diasRestantes)}`}.`;

  return (
    <View style={[styles.faixa, urgente ? styles.urgente : styles.normal]}>
      <Text style={[styles.texto, urgente ? styles.textoUrgente : styles.textoNormal]}>
        {urgente ? '⚠ ' : ''}
        {texto}
      </Text>
      {WHATSAPP_ASSINATURA ? (
        <Pressable accessibilityRole="link" onPress={() => abrirWhatsAppAssinatura(acesso.tenantNome, acesso.tenantId)}>
          <Text style={[styles.link, urgente ? styles.textoUrgente : styles.textoNormal]}>Assinar →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  faixa: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaco.md,
    paddingHorizontal: Espaco.lg,
    paddingVertical: Espaco.sm,
  },
  normal: { backgroundColor: Cores.chipClaro },
  urgente: { backgroundColor: Cores.avisoFundo },
  texto: { fontSize: 13, fontWeight: '600' },
  textoNormal: { color: Cores.primariaEscura },
  textoUrgente: { color: Cores.avisoTexto },
  link: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});
