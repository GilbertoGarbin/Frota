import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { CampoData } from '@/components/ui/campo-data';
import { Janela } from '@/components/ui/janela';
import { LinhaForm } from '@/components/ui/linha-form';
import { Mensagem, type ConteudoMensagem } from '@/components/ui/mensagem';
import { Segmentado } from '@/components/ui/segmentado';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { dataDeHoje, salvarConta } from '@/services/financeiro.service';
import { somar } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import { formatarData, formatarDecimal, formatarMoeda, lerData, lerDecimal, mascararDecimal } from '@/utils/formato';

/** Conta como a lista mostra e a janela edita */
export type ContaEditavel = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string | null;
  juros: number;
  desconto: number;
  observacao: string | null;
  quitadoEm: string | null;
  favorecido: string | null;
  chavePix: string | null;
};

type Props = { tipo: 'receber' | 'pagar'; conta: ContaEditavel; aoFechar: (salvou: boolean) => void };

/** Financeiro > Receber/Pagar > Editar: vencimento, valor, juros, desconto, situação. */
export function FormConta({ tipo, conta, aoFechar }: Props) {
  const receber = tipo === 'receber';
  const [descricao, setDescricao] = useState(conta.descricao);
  const [valor, setValor] = useState(formatarDecimal(conta.valor));
  const [vencimento, setVencimento] = useState(formatarData(conta.vencimento));
  const [juros, setJuros] = useState(conta.juros > 0 ? formatarDecimal(conta.juros) : '');
  const [desconto, setDesconto] = useState(conta.desconto > 0 ? formatarDecimal(conta.desconto) : '');
  const [favorecido, setFavorecido] = useState(conta.favorecido ?? '');
  const [chavePix, setChavePix] = useState(conta.chavePix ?? '');
  const [observacao, setObservacao] = useState(conta.observacao ?? '');
  const [situacao, setSituacao] = useState<'aberta' | 'quitada'>(conta.quitadoEm ? 'quitada' : 'aberta');
  const [quitadoEm, setQuitadoEm] = useState(formatarData(conta.quitadoEm ?? dataDeHoje()));
  const [mensagem, setMensagem] = useState<ConteudoMensagem | null>(null);
  const [salvando, setSalvando] = useState(false);

  const valorLido = lerDecimal(valor);
  const jurosLido = lerDecimal(juros) ?? 0;
  const descontoLido = lerDecimal(desconto) ?? 0;
  const valorFinal =
    valorLido !== null && !Number.isNaN(valorLido) && !Number.isNaN(jurosLido) && !Number.isNaN(descontoLido)
      ? somar([valorLido, jurosLido, -descontoLido])
      : null;

  const SITUACOES = [
    { valor: 'aberta', rotulo: receber ? 'A receber' : 'A pagar' },
    { valor: 'quitada', rotulo: receber ? 'Recebida' : 'Paga' },
  ] as const;

  async function salvar() {
    const faltando = [!descricao.trim() && 'Descrição', !valor.trim() && 'Valor'].filter((i): i is string => !!i);
    if (faltando.length > 0) return setMensagem({ titulo: 'Preencha os campos obrigatórios', itens: faltando });
    const invalido = (texto: string) => setMensagem({ titulo: 'Confira a conta', texto });
    const venc = vencimento.trim() ? lerData(vencimento) : null;
    const quit = situacao === 'quitada' ? lerData(quitadoEm) : null;
    if (valorLido === null || Number.isNaN(valorLido)) return invalido('Valor inválido.');
    if (Number.isNaN(jurosLido) || Number.isNaN(descontoLido)) return invalido('Juros ou desconto inválido.');
    if (venc === undefined) return invalido('Vencimento inválido. Use dia/mês/ano.');
    if (situacao === 'quitada' && !quit) return invalido(`Data ${receber ? 'do recebimento' : 'do pagamento'} inválida.`);
    if (valorFinal !== null && valorFinal < 0) return invalido('O desconto não pode ser maior que o valor com juros.');
    setSalvando(true);
    try {
      await salvarConta(
        tipo,
        conta.id,
        {
          descricao: descricao.trim(),
          valor: valorLido,
          vencimento: venc,
          juros: jurosLido,
          desconto: descontoLido,
          observacao: observacao.trim() || null,
          quitadoEm: quit ?? null,
          favorecido: favorecido.trim() || null,
          chavePix: chavePix.trim() || null,
        },
        { valor: valorLido !== conta.valor, vencimento: venc !== conta.vencimento },
      );
      aoFechar(true);
    } catch (e) {
      setMensagem({ titulo: 'Não foi possível salvar', texto: mensagemDeErro(e) });
      setSalvando(false);
    }
  }

  return (
    <Janela visivel titulo={receber ? 'Editar conta a receber' : 'Editar conta a pagar'} aoFechar={() => aoFechar(false)}>
      <Mensagem mensagem={mensagem} aoFechar={() => setMensagem(null)} />
      <Campo rotulo="Descrição *" value={descricao} onChangeText={setDescricao} />
      {receber ? null : (
        <LinhaForm minimo={220}>
          <Campo rotulo="Favorecido" value={favorecido} onChangeText={setFavorecido} placeholder="Posto, fornecedor ou motorista" />
          <Campo rotulo="Chave PIX" value={chavePix} onChangeText={setChavePix} autoCapitalize="none" />
        </LinhaForm>
      )}
      <LinhaForm minimo={150}>
        <Campo
          rotulo="Valor (R$) *"
          ajuda="Corrigido à mão, o valor não muda mais sozinho quando a viagem muda."
          value={valor}
          onChangeText={(t) => setValor(mascararDecimal(t))}
          keyboardType="numeric"
          inputMode="decimal"
        />
        <CampoData rotulo="Vencimento" valor={vencimento} onChange={setVencimento} />
      </LinhaForm>
      <LinhaForm minimo={150}>
        <Campo
          rotulo="Juros / multa (R$)"
          value={juros}
          onChangeText={(t) => setJuros(mascararDecimal(t))}
          keyboardType="numeric"
          inputMode="decimal"
          placeholder="0,00"
        />
        <Campo
          rotulo="Desconto (R$)"
          value={desconto}
          onChangeText={(t) => setDesconto(mascararDecimal(t))}
          keyboardType="numeric"
          inputMode="decimal"
          placeholder="0,00"
        />
        <View style={styles.total}>
          <Text style={styles.totalRotulo}>Valor final</Text>
          <Text style={styles.totalValor}>{valorFinal === null ? '—' : formatarMoeda(valorFinal)}</Text>
        </View>
      </LinhaForm>
      <LinhaForm minimo={200}>
        <Segmentado rotulo="Situação" opcoes={SITUACOES} valor={situacao} onChange={setSituacao} />
        {situacao === 'quitada' ? (
          <CampoData rotulo={receber ? 'Recebido em' : 'Pago em'} valor={quitadoEm} onChange={setQuitadoEm} />
        ) : (
          <View />
        )}
      </LinhaForm>
      <Campo rotulo="Observação" value={observacao} onChangeText={setObservacao} placeholder="Ex.: cliente pediu para pagar dia 25" />
      <View style={styles.botoes}>
        <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
        <Botao titulo="Cancelar" variante="link" onPress={() => aoFechar(false)} />
      </View>
    </Janela>
  );
}

const styles = StyleSheet.create({
  total: { gap: 2, padding: Espaco.sm, borderRadius: Raio.sm, backgroundColor: Cores.chipClaro, justifyContent: 'center' },
  totalRotulo: { fontSize: 12, fontWeight: '600', color: Cores.primariaEscura },
  totalValor: { fontSize: 18, fontWeight: '700', color: Cores.primariaEscura },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
});
