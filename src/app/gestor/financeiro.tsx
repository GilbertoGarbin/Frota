import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text } from 'react-native';

import { tomDaMargem } from '@/components/gestor/detalhe-viagem';
import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Grade, Indicador, Secao } from '@/components/ui/cartao';
import { SeletorMes } from '@/components/ui/seletor-mes';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { dataDeHoje, listarPagamentos, listarRecebimentos } from '@/services/financeiro.service';
import {
  buscarDesempenhoPorVeiculo,
  buscarResumoFinanceiro,
  type DesempenhoVeiculo,
} from '@/services/gestao.service';
import { somar } from '@/utils/dinheiro';
import { formatarKm, formatarMoeda, formatarPercentual, mesAtual, periodoDoMes, rotuloMes } from '@/utils/formato';

// Totais em aberto e atrasados (quadros que levam a Receber e Pagar)
async function carregarContas() {
  const [receber, pagar] = await Promise.all([listarRecebimentos(), listarPagamentos()]);
  const hoje = dataDeHoje();
  const resumo = (lista: { valor: number; vencimento: string | null; quitado: string | null }[]) => {
    const abertas = lista.filter((c) => !c.quitado);
    return {
      total: somar(abertas.map((c) => c.valor)),
      atrasado: somar(abertas.filter((c) => c.vencimento && c.vencimento < hoje).map((c) => c.valor)),
    };
  };
  return {
    receber: resumo(receber.map((r) => ({ valor: r.valor, vencimento: r.vencimento, quitado: r.recebido_em }))),
    pagar: resumo(pagar.map((p) => ({ valor: p.valor, vencimento: p.vencimento, quitado: p.pago_em }))),
  };
}

// Tela 6 — Financeiro e fechamento mensal (DRE consolidado)
export default function Financeiro() {
  const router = useRouter();
  const [mes, setMes] = useState(mesAtual);
  const { inicio, fim } = periodoDoMes(mes);
  const buscar = useCallback(
    async () => ({
      resumo: await buscarResumoFinanceiro(inicio, fim),
      veiculos: await buscarDesempenhoPorVeiculo(inicio, fim),
    }),
    [inicio, fim],
  );
  const { dados: contas } = useCarregar(carregarContas);
  const { dados, erro } = useCarregar(buscar);
  const r = dados?.resumo;

  // Indicadores por km: razão entre dois totais que o banco já somou (só exibição)
  const porKm = (valor: number) => (r && r.km_rodado > 0 ? `${formatarMoeda(Math.round((valor * 100) / r.km_rodado) / 100)}/km` : '—');
  const margem = r && r.faturamento > 0 ? Math.round((r.resultado * 1000) / r.faturamento) / 10 : null;

  const colunas: Coluna<DesempenhoVeiculo>[] = [
    { titulo: 'Placa', celula: (v) => v.placa },
    { titulo: 'Km rodado', celula: (v) => formatarKm(v.km_rodado) },
    { titulo: 'Faturamento', celula: (v) => formatarMoeda(v.faturamento) },
    { titulo: 'Combustível', celula: (v) => `${formatarMoeda(v.combustivel)}${v.viagens_combustivel_estimado > 0 ? ' *' : ''}` },
    { titulo: 'Comissão', celula: (v) => formatarMoeda(v.comissoes) },
    { titulo: 'Despesas', celula: (v) => formatarMoeda(v.despesas) },
    { titulo: 'Manutenção', celula: (v) => formatarMoeda(v.manutencoes) },
    { titulo: 'Resultado', celula: (v) => formatarMoeda(v.resultado) },
    {
      titulo: 'Margem',
      celula: (v) => {
        const tom = tomDaMargem(v.margem_percentual);
        return (
          <Selo tipo={tom === 'neutro' ? 'neutro' : tom}>{formatarPercentual(v.margem_percentual)}</Selo>
        );
      },
    },
  ];

  return (
    <Pagina
      titulo="Financeiro"
      subtitulo={`Fechamento de ${rotuloMes(mes)}, por placa.`}
      acao={<SeletorMes mes={mes} onChange={setMes} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {!r || !dados ? (
        erro ? null : <ActivityIndicator color={Cores.primaria} />
      ) : (
        <>
          {contas ? (
            <Grade>
              <Indicador
                rotulo="A receber"
                valor={formatarMoeda(contas.receber.total)}
                detalhe={contas.receber.atrasado > 0 ? `${formatarMoeda(contas.receber.atrasado)} atrasado` : 'Nada atrasado'}
                tom={contas.receber.atrasado > 0 ? 'perigo' : 'destaque'}
                onPress={() => router.push('/gestor/receber')}
              />
              <Indicador
                rotulo="A pagar"
                valor={formatarMoeda(contas.pagar.total)}
                detalhe={contas.pagar.atrasado > 0 ? `${formatarMoeda(contas.pagar.atrasado)} atrasado` : 'Nada atrasado'}
                tom={contas.pagar.atrasado > 0 ? 'perigo' : 'neutro'}
                onPress={() => router.push('/gestor/pagar')}
              />
            </Grade>
          ) : null}
          <Grade>
            <Indicador rotulo="Faturamento bruto" valor={formatarMoeda(r.faturamento)} detalhe={`${r.viagens} viagem(ns) finalizada(s)`} />
            <Indicador
              rotulo="Custos operacionais"
              valor={formatarMoeda(r.custos_operacionais)}
              detalhe="Combustível, despesas, comissões e manutenções"
            />
            <Indicador rotulo="Custos fixos" valor={formatarMoeda(r.custos_fixos)} />
            <Indicador
              rotulo="Lucro líquido"
              tom={r.resultado >= 0 ? 'sucesso' : 'perigo'}
              valor={formatarMoeda(r.resultado)}
              detalhe={margem === null ? undefined : `${formatarPercentual(margem)} do faturamento`}
            />
          </Grade>

          <Secao titulo="Como o resultado se compõe">
            <Grade>
              <Indicador rotulo="Combustível" valor={formatarMoeda(r.combustivel)} />
              <Indicador rotulo="Despesas de viagem" valor={formatarMoeda(r.despesas)} />
              <Indicador rotulo="Comissões" valor={formatarMoeda(r.comissoes)} />
              <Indicador rotulo="Manutenções" valor={formatarMoeda(r.manutencoes)} />
            </Grade>
          </Secao>

          <Grade>
            <Indicador
              rotulo="Custo por km (CPK)"
              valor={porKm(r.custos_operacionais + r.custos_fixos)}
              detalhe={`${formatarKm(r.km_rodado)} rodados no mês`}
            />
            <Indicador rotulo="Faturamento por km" valor={porKm(r.faturamento)} />
            <Indicador
              rotulo="Adiantamentos em aberto"
              tom={r.adiantamentos_abertos > 0 ? 'destaque' : 'neutro'}
              valor={`${r.adiantamentos_abertos} viagem(ns)`}
              detalhe={`A devolver: ${formatarMoeda(r.adiantamento_a_devolver)} · A reembolsar: ${formatarMoeda(r.adiantamento_a_reembolsar)}`}
              onPress={() => router.navigate({ pathname: '/gestor/viagens', params: { filtro: 'adiantamento' } })}
            />
          </Grade>

          <Secao titulo="Desempenho comparativo por placa">
            <Tabela
              colunas={colunas}
              itens={dados.veiculos}
              chave={(v) => v.veiculo_id}
              vazio="Nenhuma viagem finalizada nem manutenção neste mês."
              larguraMinima={1040}
            />
            {r.viagens_combustivel_estimado > 0 ? (
              <Text style={styles.nota}>
                * Valores de combustível de {r.viagens_combustivel_estimado} viagem(ns) ainda estimados — serão
                corrigidos no próximo abastecimento com tanque cheio.
              </Text>
            ) : null}
            <Text style={styles.nota}>Margem: verde a partir de 30%, vermelho abaixo de 10%.</Text>
          </Secao>

          {Platform.OS === 'web' ? (
            <Botao titulo="Imprimir / salvar em PDF" variante="contorno" onPress={() => window.print()} />
          ) : null}
        </>
      )}
    </Pagina>
  );
}

const styles = StyleSheet.create({
  nota: { fontSize: 13, color: Cores.textoSuave },
});
