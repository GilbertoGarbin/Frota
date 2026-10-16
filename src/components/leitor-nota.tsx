import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { COMBUSTIVEIS } from '@/constants/lancamentos';
import { Cores, Espaco, Raio } from '@/constants/tema';
import type { Anexo } from '@/services/anexo.service';
import { combustiveisDaNota, lerNotaFiscal, type ItemNota, type NotaLida } from '@/services/nota.service';
import { mensagemDeErro } from '@/utils/erros';
import { formatarData, formatarDecimal, formatarMoeda } from '@/utils/formato';

// Botão "Ler nota fiscal" dos formulários de abastecimento (app do motorista e painel) e o
// resumo do que foi lido. Os campos do formulário são preenchidos por quem usa (aoLer).

export const nomeCombustivel = (c: string) => COMBUSTIVEIS.find((x) => x.valor === c)?.rotulo ?? c;
const litros = (q: number) => `${formatarDecimal(q, q % 1 === 0 ? 0 : 3)} L`;

export function BotaoLerNota({ aoLer }: { aoLer: (nota: NotaLida, anexo: Anexo | null) => void }) {
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function ler() {
    setErro(null);
    setLendo(true);
    try {
      const lido = await lerNotaFiscal();
      if (lido) aoLer(lido.nota, lido.anexo);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
    setLendo(false);
  }

  return (
    <View style={styles.bloco}>
      <Botao titulo="Ler nota fiscal (PDF ou XML)" variante="contorno" onPress={ler} carregando={lendo} />
      <Text style={styles.ajuda}>O formulário vem preenchido com os dados da nota. Confira antes de salvar.</Text>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
    </View>
  );
}

type PropsResumo = {
  nota: NotaLida;
  /** placa do caminhão da viagem, para conferir com a da nota */
  placa: string | null;
  /** itens de combustível além do principal (ex.: Arla) e se vão ser lançados junto */
  extras: ItemNota[];
  lancarExtras: boolean;
  aoMudarLancarExtras: (valor: boolean) => void;
};

export function ResumoNota({ nota, placa, extras, lancarExtras, aoMudarLancarExtras }: PropsResumo) {
  const ignorados = nota.itens.filter((i) => i.combustivel === null);
  const placaDiferente = nota.placa && placa && nota.placa !== placa.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return (
    <View style={styles.resumo}>
      <Text style={styles.resumoTitulo}>
        {`Nota lida: ${nota.emitente ?? 'posto'}${nota.data ? ` · ${formatarData(nota.data)}` : ''}${nota.total !== null ? ` · total ${formatarMoeda(nota.total)}` : ''}`}
      </Text>
      {placaDiferente ? (
        <Aviso tipo="erro">{`A placa da nota (${nota.placa}) não é a do caminhão da viagem (${placa}). Confira se é a nota certa.`}</Aviso>
      ) : null}
      {extras.length > 0 ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: lancarExtras }}
          onPress={() => aoMudarLancarExtras(!lancarExtras)}
          style={styles.caixa}>
          <View style={[styles.quadrado, lancarExtras && styles.quadradoMarcado]}>
            {lancarExtras ? <Text style={styles.visto}>✓</Text> : null}
          </View>
          <Text style={styles.texto}>
            {`Lançar junto: ${extras.map((i) => `${nomeCombustivel(i.combustivel ?? '')} — ${litros(i.quantidade)}, ${formatarMoeda(i.valor)}`).join('; ')}`}
          </Text>
        </Pressable>
      ) : null}
      {ignorados.length > 0 ? (
        <Text style={styles.ajuda}>
          {`Itens que não são combustível ficaram de fora (lance como despesa, se for o caso): ${ignorados
            .map((i) => `${i.descricao} ${formatarMoeda(i.valor)}`)
            .join('; ')}.`}
        </Text>
      ) : null}
    </View>
  );
}

/** Divide a nota: o combustível principal preenche o formulário; os outros viram extras. */
export function separarNota(nota: NotaLida) {
  const [principal, ...extras] = combustiveisDaNota(nota);
  return { principal: principal ?? null, extras };
}

const styles = StyleSheet.create({
  bloco: { gap: Espaco.xs },
  ajuda: { fontSize: 13, lineHeight: 19, color: Cores.textoSuave },
  resumo: { gap: Espaco.sm, padding: Espaco.md, borderRadius: Raio.sm, backgroundColor: Cores.chipClaro },
  resumoTitulo: { fontSize: 14, fontWeight: '700', color: Cores.primariaEscura },
  texto: { flex: 1, fontSize: 14, color: Cores.texto },
  caixa: { flexDirection: 'row', alignItems: 'center', gap: Espaco.sm, minHeight: 44 },
  quadrado: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Cores.branco,
  },
  quadradoMarcado: { backgroundColor: Cores.primaria },
  visto: { color: Cores.branco, fontWeight: '700' },
});
