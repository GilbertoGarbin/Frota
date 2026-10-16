import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Secao } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
import { Cores, Espaco } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { listarContasAPagar, marcarPago, ROTULO_PAGAMENTO, type ContaAPagar } from '@/services/viagens.service';
import { somar } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import { diasAte, formatarData, formatarMoeda } from '@/utils/formato';

/** PIX e notas a prazo que a empresa ainda precisa pagar aos postos (de todas as viagens). */
export function ContasAPagar() {
  const { dados, erro, recarregar } = useCarregar(listarContasAPagar);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [pagando, setPagando] = useState<string | null>(null);

  async function pagar(c: ContaAPagar) {
    setErroAcao(null);
    setPagando(c.id);
    try {
      await marcarPago(c.tabela, c.id, true);
      recarregar();
    } catch (e) {
      setErroAcao(mensagemDeErro(e));
    }
    setPagando(null);
  }

  const total = dados ? somar(dados.map((c) => c.valor)) : 0;

  return (
    <Secao titulo={dados && dados.length > 0 ? `A pagar aos postos · ${formatarMoeda(total)}` : 'A pagar aos postos'}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {erroAcao ? <Aviso tipo="erro">{erroAcao}</Aviso> : null}
      {!dados && !erro ? <ActivityIndicator color={Cores.primaria} /> : null}
      {dados?.length === 0 ? (
        <Text style={styles.suave}>Nada a pagar. Abastecimentos e despesas pagos por PIX da empresa ou a prazo aparecem aqui.</Text>
      ) : null}
      {dados?.map((c) => {
        const dias = c.vencimento ? diasAte(c.vencimento) : null;
        return (
          <View key={c.id} style={styles.item}>
            <View style={styles.texto}>
              <Text style={styles.titulo}>{`${formatarMoeda(c.valor)} · ${c.descricao}`}</Text>
              <Text style={styles.suave}>
                {`${formatarData(c.data)}${c.local ? ` · ${c.local}` : ''} · ${ROTULO_PAGAMENTO[c.forma]}`}
              </Text>
              {c.chavePix ? <Text selectable style={styles.suave}>{`Chave PIX: ${c.chavePix}`}</Text> : null}
            </View>
            {dias === null ? (
              c.forma === 'pix_empresa' ? <Selo tipo="aviso">Pagar agora</Selo> : null
            ) : dias < 0 ? (
              <Selo tipo="perigo">{`Venceu em ${formatarData(c.vencimento)}`}</Selo>
            ) : (
              <Selo tipo={dias <= 2 ? 'aviso' : 'neutro'}>{dias === 0 ? 'Vence hoje' : `Vence em ${formatarData(c.vencimento)}`}</Selo>
            )}
            <Botao titulo="Marcar como pago" variante="contorno" compacto carregando={pagando === c.id} onPress={() => pagar(c)} />
          </View>
        );
      })}
    </Secao>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Espaco.md,
    paddingVertical: Espaco.sm,
    borderTopWidth: 1,
    borderTopColor: Cores.borda,
  },
  texto: { flex: 1, minWidth: 220, gap: 2 },
  titulo: { fontSize: 15, fontWeight: '600', color: Cores.texto },
  suave: { fontSize: 13, color: Cores.textoSuave },
});
