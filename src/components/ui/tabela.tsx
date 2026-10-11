import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';

export type Coluna<T> = {
  titulo: string;
  /** proporção da largura (padrão 1) */
  flex?: number;
  celula: (item: T) => ReactNode;
};

type Props<T> = {
  colunas: Coluna<T>[];
  itens: T[];
  chave: (item: T) => string;
  vazio: string;
  /** abaixo desta largura a tabela rola na horizontal em vez de espremer as colunas */
  larguraMinima?: number;
};

export function Tabela<T>({ colunas, itens, chave, vazio, larguraMinima = 760 }: Props<T>) {
  if (itens.length === 0) {
    return (
      <View style={[styles.moldura, styles.vazio]}>
        <Text style={styles.textoVazio}>{vazio}</Text>
      </View>
    );
  }
  return (
    <ScrollView horizontal contentContainerStyle={styles.rolagem}>
      <View role="table" style={[styles.moldura, { minWidth: larguraMinima }]}>
        <View style={[styles.linha, styles.cabecalho]}>
          {colunas.map((c) => (
            <Text key={c.titulo} style={[styles.celula, styles.titulo, { flex: c.flex ?? 1 }]}>
              {c.titulo}
            </Text>
          ))}
        </View>
        {itens.map((item, i) => (
          <View key={chave(item)} style={[styles.linha, i % 2 === 1 && styles.zebra]}>
            {colunas.map((c) => {
              const conteudo = c.celula(item);
              return (
                <View key={c.titulo} style={[styles.celula, { flex: c.flex ?? 1 }]}>
                  {typeof conteudo === 'string' ? <Text style={styles.texto}>{conteudo}</Text> : conteudo}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rolagem: { flexGrow: 1 },
  moldura: {
    flex: 1,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
    overflow: 'hidden',
  },
  linha: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  cabecalho: { minHeight: 40, backgroundColor: Cores.fundo, borderBottomWidth: 1, borderBottomColor: Cores.borda },
  zebra: { backgroundColor: '#FAFBFD' },
  celula: { paddingHorizontal: Espaco.md, paddingVertical: Espaco.sm, justifyContent: 'center' },
  titulo: { fontSize: 12, fontWeight: '600', color: Cores.textoSuave, textTransform: 'uppercase' },
  texto: { fontSize: 14, color: Cores.texto },
  vazio: { padding: Espaco.xxl, alignItems: 'center' },
  textoVazio: { fontSize: 15, color: Cores.textoSuave },
});
