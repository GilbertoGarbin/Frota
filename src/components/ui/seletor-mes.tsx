import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/tema';
import { deslocarMes, mesAtual, rotuloMes, type Mes } from '@/utils/formato';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Setas passam um mês; tocar no nome do mês abre os 12 meses do ano para ir direto. */
export function SeletorMes({ mes, onChange }: { mes: Mes; onChange: (mes: Mes) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <View style={styles.caixa}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mês anterior"
        onPress={() => onChange(deslocarMes(mes, -1))}
        style={styles.seta}>
        <Text style={styles.setaTexto}>‹</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${rotuloMes(mes)}: escolher outro mês`}
        onPress={() => setAberto(true)}
        style={({ hovered, pressed }) => [styles.meio, (hovered || pressed) && styles.meioSobre]}>
        <Text style={styles.rotulo}>{rotuloMes(mes)}</Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color={Cores.textoSuave} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Próximo mês"
        onPress={() => onChange(deslocarMes(mes, 1))}
        style={styles.seta}>
        <Text style={styles.setaTexto}>›</Text>
      </Pressable>
      {aberto ? (
        <ListaMeses
          mes={mes}
          aoEscolher={(m) => {
            onChange(m);
            setAberto(false);
          }}
          aoFechar={() => setAberto(false)}
        />
      ) : null}
    </View>
  );
}

function ListaMeses({ mes, aoEscolher, aoFechar }: { mes: Mes; aoEscolher: (mes: Mes) => void; aoFechar: () => void }) {
  const [ano, setAno] = useState(mes.ano);
  const hoje = mesAtual();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable style={styles.fundo} onPress={aoFechar} accessibilityLabel="Fechar a lista de meses">
        <Pressable style={styles.cartao} onPress={() => {}}>
          <View style={styles.cabecalho}>
            <Pressable accessibilityRole="button" accessibilityLabel="Ano anterior" onPress={() => setAno((a) => a - 1)} style={styles.setaGrande}>
              <MaterialCommunityIcons name="chevron-left" size={26} color={Cores.texto} />
            </Pressable>
            <Text style={styles.ano}>{ano}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Próximo ano" onPress={() => setAno((a) => a + 1)} style={styles.setaGrande}>
              <MaterialCommunityIcons name="chevron-right" size={26} color={Cores.texto} />
            </Pressable>
          </View>
          <View style={styles.meses}>
            {MESES.map((nome, i) => {
              const escolhido = ano === mes.ano && i + 1 === mes.mes;
              const atual = ano === hoje.ano && i + 1 === hoje.mes;
              return (
                <Pressable
                  key={nome}
                  accessibilityRole="button"
                  accessibilityLabel={rotuloMes({ ano, mes: i + 1 })}
                  accessibilityState={{ selected: escolhido }}
                  onPress={() => aoEscolher({ ano, mes: i + 1 })}
                  style={({ pressed }) => [
                    styles.mesItem,
                    atual && styles.mesAtual,
                    escolhido && styles.escolhido,
                    pressed && styles.pressionado,
                  ]}>
                  <Text style={[styles.mesTexto, escolhido && styles.escolhidoTexto]}>{nome}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.rodape}>
            <Pressable accessibilityRole="button" onPress={() => aoEscolher(hoje)} style={styles.acao}>
              <Text style={styles.acaoTexto}>Mês atual</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={aoFechar} style={styles.acao}>
              <Text style={styles.acaoTexto}>Cancelar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.sm,
    backgroundColor: Cores.branco,
  },
  seta: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  setaTexto: { fontSize: 22, color: Cores.primaria },
  meio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 130,
    height: 40,
    paddingHorizontal: Espaco.xs,
  },
  meioSobre: { backgroundColor: Cores.chipClaro },
  rotulo: { fontSize: 14, fontWeight: '600', color: Cores.texto },
  fundo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Espaco.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  cartao: {
    width: '100%',
    maxWidth: 320,
    gap: Espaco.sm,
    padding: Espaco.lg,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setaGrande: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ano: { fontSize: 17, fontWeight: '700', color: Cores.texto },
  meses: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Espaco.sm },
  mesItem: { width: '33.33%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  mesAtual: { borderWidth: 1, borderColor: Cores.primaria },
  mesTexto: { fontSize: 15, color: Cores.texto },
  escolhido: { backgroundColor: Cores.primaria },
  escolhidoTexto: { color: Cores.branco, fontWeight: '700' },
  pressionado: { opacity: 0.6 },
  rodape: { flexDirection: 'row', justifyContent: 'space-between' },
  acao: { minHeight: 44, paddingHorizontal: Espaco.md, justifyContent: 'center' },
  acaoTexto: { fontSize: 16, fontWeight: '600', color: Cores.primaria },
});
