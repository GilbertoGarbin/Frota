import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Janela } from '@/components/ui/janela';
import { LinhaForm } from '@/components/ui/linha-form';
import { Mensagem, type ConteudoMensagem } from '@/components/ui/mensagem';
import { Segmentado } from '@/components/ui/segmentado';
import { Seletor } from '@/components/ui/seletor';
import { Cores, Espaco, Raio } from '@/constants/tema';
import {
  descreverParcelas,
  DIAS_SEMANA,
  salvarFormaRecebimento,
  type FormaRecebimento,
  type ParcelaRecebimento,
} from '@/services/formas-recebimento.service';
import { mensagemDeErro } from '@/utils/erros';
import { formatarDecimal, lerDecimal, mascararDecimal, mascararInteiro } from '@/utils/formato';

const BASES = [
  { valor: 'saida', rotulo: 'Saída' },
  { valor: 'entrega', rotulo: 'Entrega' },
] as const;
const TIPOS_DIAS = [
  { valor: 'corridos', rotulo: 'Corridos' },
  { valor: 'uteis', rotulo: 'Úteis' },
] as const;
const SITUACOES = [
  { valor: 'ativa', rotulo: 'Ativa' },
  { valor: 'inativa', rotulo: 'Inativa' },
] as const;
const QUALQUER = 'qualquer';
const DIAS = [
  { valor: QUALQUER, rotulo: 'Qualquer dia' },
  ...DIAS_SEMANA.map((d, i) => ({ valor: String(i), rotulo: d.charAt(0).toUpperCase() + d.slice(1) })),
];

// Parcela enquanto é editada (campos de texto)
type ParcelaTela = { percentual: string; base: 'saida' | 'entrega'; dias: string; tipo_dias: 'corridos' | 'uteis'; dia: string };

const paraTela = (p: ParcelaRecebimento): ParcelaTela => ({
  percentual: formatarDecimal(p.percentual),
  base: p.base,
  dias: String(p.dias),
  tipo_dias: p.tipo_dias,
  dia: p.dia_semana === null ? QUALQUER : String(p.dia_semana),
});

const novaParcela = (percentual: number, base: 'saida' | 'entrega'): ParcelaTela =>
  paraTela({ percentual, base, dias: 0, tipo_dias: 'corridos', dia_semana: null });

type Props = {
  forma: FormaRecebimento | null;
  /** id da forma salva (para já selecionar), ou null se cancelou */
  aoFechar: (idSalvo: string | null) => void;
};

/** Janela de cadastro de forma de recebimento: nome e parcelas (% · a partir de · prazo · dia). */
export function FormFormaRecebimento({ forma, aoFechar }: Props) {
  const [nome, setNome] = useState(forma?.nome ?? '');
  const [parcelas, setParcelas] = useState<ParcelaTela[]>(
    forma ? forma.parcelas.map(paraTela) : [novaParcela(100, 'entrega')],
  );
  const [situacao, setSituacao] = useState<'ativa' | 'inativa'>(forma && !forma.ativo ? 'inativa' : 'ativa');
  const [mensagem, setMensagem] = useState<ConteudoMensagem | null>(null);
  const [salvando, setSalvando] = useState(false);

  const lidas: ParcelaRecebimento[] = parcelas.map((p) => ({
    percentual: lerDecimal(p.percentual) ?? 0,
    base: p.base,
    dias: Number(p.dias.replace(/\D/g, '') || 0),
    tipo_dias: p.tipo_dias,
    dia_semana: p.dia === QUALQUER ? null : Number(p.dia),
  }));
  const soma = Math.round(lidas.reduce((t, p) => t + p.percentual, 0) * 100) / 100;

  const mudar = (i: number, campo: Partial<ParcelaTela>) =>
    setParcelas((lista) => lista.map((p, j) => (j === i ? { ...p, ...campo } : p)));

  async function salvar() {
    if (lidas.some((p) => !p.percentual || Number.isNaN(p.percentual))) {
      return setMensagem({ titulo: 'Confira as parcelas', texto: 'Informe a porcentagem de cada parcela.' });
    }
    if (soma !== 100) {
      return setMensagem({ titulo: 'Confira as parcelas', texto: `As parcelas devem somar 100%. Hoje somam ${formatarDecimal(soma)}%.` });
    }
    setSalvando(true);
    try {
      const id = await salvarFormaRecebimento(forma?.id ?? null, {
        // sem nome, usa a própria descrição ("70% na saída + 30% na entrega")
        nome: nome.trim() || descreverParcelas(lidas),
        parcelas: lidas,
        ativo: situacao === 'ativa',
      });
      aoFechar(id);
    } catch (e) {
      setMensagem({ titulo: 'Não foi possível salvar', texto: mensagemDeErro(e) });
      setSalvando(false);
    }
  }

  return (
    <Janela
      visivel
      titulo={forma ? 'Editar forma de recebimento' : 'Nova forma de recebimento'}
      aoFechar={() => aoFechar(null)}>
      <Mensagem mensagem={mensagem} aoFechar={() => setMensagem(null)} />
      <LinhaForm minimo={160}>
        <Campo
          rotulo="Nome"
          ajuda="Como você chama essa forma. Se deixar vazio, o nome é a descrição das parcelas."
          value={nome}
          onChangeText={setNome}
          placeholder="Ex.: 70/30 — saldo em 10 dias"
        />
        {forma ? <Segmentado rotulo="Situação" opcoes={SITUACOES} valor={situacao} onChange={setSituacao} /> : null}
      </LinhaForm>

      {parcelas.map((p, i) => (
        <View key={i} style={styles.parcela}>
          <View style={styles.parcelaTopo}>
            <Text style={styles.parcelaTitulo}>{`Parcela ${i + 1}`}</Text>
            {parcelas.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setParcelas((lista) => lista.filter((_, j) => j !== i))}
                hitSlop={8}>
                <Text style={styles.remover}>Remover</Text>
              </Pressable>
            ) : null}
          </View>
          <LinhaForm minimo={130}>
            <Campo
              rotulo="% do frete"
              value={p.percentual}
              onChangeText={(t) => mudar(i, { percentual: mascararDecimal(t) })}
              keyboardType="numeric"
              inputMode="decimal"
            />
            <Segmentado rotulo="A partir de" opcoes={BASES} valor={p.base} onChange={(base) => mudar(i, { base })} />
          </LinhaForm>
          <LinhaForm minimo={130}>
            <Campo
              rotulo="Prazo (dias)"
              value={p.dias}
              onChangeText={(t) => mudar(i, { dias: mascararInteiro(t).replace(/\./g, '') })}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="0 = no dia"
            />
            <Segmentado rotulo="Dias" opcoes={TIPOS_DIAS} valor={p.tipo_dias} onChange={(tipo_dias) => mudar(i, { tipo_dias })} />
            <Seletor rotulo="Paga só em" opcoes={DIAS} valor={p.dia} onChange={(dia) => mudar(i, { dia })} />
          </LinhaForm>
        </View>
      ))}

      <View style={styles.rodapeParcelas}>
        <Botao
          titulo="+ Parcela"
          variante="contorno"
          compacto
          onPress={() => setParcelas((lista) => [...lista, novaParcela(Math.max(0, 100 - soma), 'entrega')])}
        />
        <Text style={styles.resumoTexto}>{descreverParcelas(lidas)}</Text>
        <Text style={[styles.soma, soma !== 100 && styles.somaErrada]}>{`Soma: ${formatarDecimal(soma)}%`}</Text>
      </View>

      <View style={styles.botoes}>
        <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
        <Botao titulo="Cancelar" variante="link" onPress={() => aoFechar(null)} />
      </View>
    </Janela>
  );
}

const styles = StyleSheet.create({
  parcela: {
    gap: Espaco.xs,
    paddingHorizontal: Espaco.md,
    paddingVertical: Espaco.sm,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.fundo,
  },
  parcelaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  parcelaTitulo: { fontSize: 13, fontWeight: '700', color: Cores.texto },
  remover: { fontSize: 13, fontWeight: '600', color: Cores.perigo },
  rodapeParcelas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Espaco.md },
  soma: { fontSize: 13, fontWeight: '600', color: Cores.sucessoTexto },
  somaErrada: { color: Cores.perigo },
  resumoTexto: { flex: 1, fontSize: 13, color: Cores.primariaEscura },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
});
