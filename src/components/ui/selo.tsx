import { StyleSheet, Text, View } from 'react-native';

import { Cores } from '@/constants/tema';

export type TipoSelo = 'sucesso' | 'aviso' | 'perigo' | 'neutro' | 'info';

// Cor nunca sozinha: cada tipo tem também um símbolo (spec, seção 2).
const ESTILO: Record<TipoSelo, { simbolo: string; fundo: string; texto: string }> = {
  sucesso: { simbolo: '✓', fundo: Cores.sucessoFundo, texto: Cores.sucessoTexto },
  aviso: { simbolo: '⚠', fundo: Cores.avisoFundo, texto: Cores.avisoTexto },
  perigo: { simbolo: '✕', fundo: Cores.perigoFundo, texto: Cores.perigoTexto },
  neutro: { simbolo: '•', fundo: '#F1F5F9', texto: Cores.textoSuave },
  info: { simbolo: '•', fundo: Cores.chipClaro, texto: Cores.primariaEscura },
};

export function Selo({ tipo, children }: { tipo: TipoSelo; children: string }) {
  const { simbolo, fundo, texto } = ESTILO[tipo];
  return (
    <View style={[styles.selo, { backgroundColor: fundo }]}>
      <Text style={[styles.texto, { color: texto }]}>
        {simbolo} {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  selo: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  texto: { fontSize: 12, fontWeight: '600' },
});
