import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Campo } from '@/components/ui/campo';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { formatarData, hojeIso, lerData, mascararData, rotuloMes, type Mes } from '@/utils/formato';

type Props = {
  rotulo: string;
  /** dd/mm/aaaa (o mesmo texto que aparece no campo) */
  valor: string;
  onChange: (valor: string) => void;
  ajuda?: string;
  placeholder?: string;
};

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const dois = (n: number) => String(n).padStart(2, '0');

/**
 * Campo de data: digita dd/mm/aaaa ou escolhe no calendário (botão à direita). O calendário é
 * desenhado pelo próprio app, igual na web e no celular.
 */
export function CampoData({ rotulo, valor, onChange, ajuda, placeholder = 'dd/mm/aaaa' }: Props) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Campo
        rotulo={rotulo}
        ajuda={ajuda}
        value={valor}
        onChangeText={(t) => onChange(mascararData(t))}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder={placeholder}
        maxLength={10}
        acessorio={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Abrir calendário: ${rotulo}`}
            onPress={() => setAberto(true)}
            hitSlop={8}
            style={styles.botao}>
            <MaterialCommunityIcons name="calendar-month-outline" size={22} color={Cores.primaria} />
          </Pressable>
        }
      />
      {aberto ? (
        <Calendario
          titulo={rotulo}
          iso={lerData(valor) ?? null}
          aoEscolher={(iso) => {
            onChange(formatarData(iso));
            setAberto(false);
          }}
          aoFechar={() => setAberto(false)}
        />
      ) : null}
    </>
  );
}

type PropsCalendario = {
  titulo: string;
  iso: string | null;
  aoEscolher: (iso: string) => void;
  aoFechar: () => void;
};

function Calendario({ titulo, iso, aoEscolher, aoFechar }: PropsCalendario) {
  const hoje = hojeIso();
  const base = iso ?? hoje;
  const [mes, setMes] = useState<Mes>({ ano: Number(base.slice(0, 4)), mes: Number(base.slice(5, 7)) });
  // tocar no nome do mês troca os dias pela lista dos 12 meses (setas passam o ano)
  const [escolhendoMes, setEscolhendoMes] = useState(false);

  const primeiroDiaSemana = new Date(mes.ano, mes.mes - 1, 1).getDay();
  const diasNoMes = new Date(mes.ano, mes.mes, 0).getDate();
  const casas: (number | null)[] = [
    ...Array<null>(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (casas.length % 7 !== 0) casas.push(null);
  const semanas = Array.from({ length: casas.length / 7 }, (_, i) => casas.slice(i * 7, i * 7 + 7));

  const mudarMes = (delta: number) =>
    setMes(({ ano, mes: m }) => {
      const indice = ano * 12 + (m - 1) + delta;
      return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
    });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable style={styles.fundo} onPress={aoFechar} accessibilityLabel="Fechar o calendário">
        <Pressable style={styles.cartao} onPress={() => {}}>
          <Text style={styles.titulo}>{titulo}</Text>
          <View style={styles.cabecalho}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={escolhendoMes ? 'Ano anterior' : 'Mês anterior'}
              onPress={() => (escolhendoMes ? setMes((m) => ({ ...m, ano: m.ano - 1 })) : mudarMes(-1))}
              style={styles.seta}>
              <MaterialCommunityIcons name="chevron-left" size={26} color={Cores.texto} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={escolhendoMes ? 'Voltar para os dias' : `${rotuloMes(mes)}: escolher outro mês`}
              onPress={() => setEscolhendoMes((e) => !e)}
              style={({ hovered, pressed }) => [styles.mesBotao, (hovered || pressed) && styles.mesBotaoSobre]}>
              <Text style={styles.mes}>{escolhendoMes ? mes.ano : rotuloMes(mes)}</Text>
              <MaterialCommunityIcons name={escolhendoMes ? 'chevron-up' : 'chevron-down'} size={18} color={Cores.textoSuave} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={escolhendoMes ? 'Próximo ano' : 'Próximo mês'}
              onPress={() => (escolhendoMes ? setMes((m) => ({ ...m, ano: m.ano + 1 })) : mudarMes(1))}
              style={styles.seta}>
              <MaterialCommunityIcons name="chevron-right" size={26} color={Cores.texto} />
            </Pressable>
          </View>
          {escolhendoMes ? (
            <View style={styles.meses}>
              {MESES.map((nome, i) => {
                const atual = i + 1 === mes.mes;
                return (
                  <Pressable
                    key={nome}
                    accessibilityRole="button"
                    accessibilityLabel={rotuloMes({ ano: mes.ano, mes: i + 1 })}
                    accessibilityState={{ selected: atual }}
                    onPress={() => {
                      setMes({ ano: mes.ano, mes: i + 1 });
                      setEscolhendoMes(false);
                    }}
                    style={({ pressed }) => [styles.mesItem, atual && styles.escolhido, pressed && styles.pressionado]}>
                    <Text style={[styles.diaTexto, atual && styles.escolhidoTexto]}>{nome}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <>
              <View style={styles.semana}>
                {SEMANA.map((d, i) => (
                  <Text key={i} style={styles.diaSemana}>
                    {d}
                  </Text>
                ))}
              </View>
              {semanas.map((semana, i) => (
                <View key={i} style={styles.semana}>
                  {semana.map((dia, j) => {
                    if (dia === null) return <View key={j} style={styles.casa} />;
                    const diaIso = `${mes.ano}-${dois(mes.mes)}-${dois(dia)}`;
                    const escolhido = diaIso === iso;
                    const ehHoje = diaIso === hoje;
                    return (
                      <Pressable
                        key={j}
                        accessibilityRole="button"
                        accessibilityLabel={formatarData(diaIso)}
                        accessibilityState={{ selected: escolhido }}
                        onPress={() => aoEscolher(diaIso)}
                        style={({ pressed }) => [
                          styles.casa,
                          styles.dia,
                          ehHoje && styles.hoje,
                          escolhido && styles.escolhido,
                          pressed && styles.pressionado,
                        ]}>
                        <Text style={[styles.diaTexto, escolhido && styles.escolhidoTexto]}>{dia}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </>
          )}
          <View style={styles.rodape}>
            <Pressable accessibilityRole="button" onPress={() => aoEscolher(hoje)} style={styles.acao}>
              <Text style={styles.acaoTexto}>Hoje</Text>
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
  botao: { width: 48, height: '100%', alignItems: 'center', justifyContent: 'center' },
  fundo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Espaco.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  cartao: {
    width: '100%',
    maxWidth: 360,
    gap: Espaco.xs,
    padding: Espaco.lg,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  titulo: { fontSize: 13, fontWeight: '600', color: Cores.textoSuave },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Espaco.xs },
  seta: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  mes: { fontSize: 17, fontWeight: '700', color: Cores.texto },
  mesBotao: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: Espaco.md, borderRadius: Raio.sm },
  mesBotaoSobre: { backgroundColor: Cores.chipClaro },
  meses: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Espaco.sm, paddingVertical: Espaco.xs },
  mesItem: { width: '33.33%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  semana: { flexDirection: 'row' },
  diaSemana: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: Cores.textoSuave, paddingVertical: 4 },
  casa: { flex: 1, aspectRatio: 1, maxHeight: 44 },
  dia: { alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  diaTexto: { fontSize: 15, color: Cores.texto },
  hoje: { borderWidth: 1, borderColor: Cores.primaria },
  escolhido: { backgroundColor: Cores.primaria },
  escolhidoTexto: { color: Cores.branco, fontWeight: '700' },
  pressionado: { opacity: 0.6 },
  rodape: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Espaco.xs },
  acao: { minHeight: 44, paddingHorizontal: Espaco.md, justifyContent: 'center' },
  acaoTexto: { fontSize: 16, fontWeight: '600', color: Cores.primaria },
});
