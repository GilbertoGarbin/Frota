import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormConta } from '@/components/gestor/form-conta';
import { contaDePagamento, contaDeRecebimento, type ContaDaLista } from '@/components/gestor/lista-contas';
import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { CampoBusca } from '@/components/ui/campo-busca';
import { CartaoResumo, Grade } from '@/components/ui/cartao';
import { SeletorMes } from '@/components/ui/seletor-mes';
import { Seletor } from '@/components/ui/seletor';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { listarPagamentos, listarRecebimentos } from '@/services/financeiro.service';
import { emCentavos, emReais, somar } from '@/utils/dinheiro';
import { formatarData, formatarMoeda, mesAtual, periodoDoMes } from '@/utils/formato';

type Tipo = 'receber' | 'pagar';
type Movimento = { tipo: Tipo; conta: ContaDaLista; data: string };
type Filtro = 'tudo' | 'entradas' | 'saidas';

const FILTROS = [
  { valor: 'tudo', rotulo: 'Tudo' },
  { valor: 'entradas', rotulo: 'Entradas' },
  { valor: 'saidas', rotulo: 'Saídas' },
] as const;

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const VERMELHO = '#DC2626';

// Tudo o que foi recebido ou pago (data em que o dinheiro entrou ou saiu)
async function carregar(): Promise<Movimento[]> {
  const [receber, pagar] = await Promise.all([listarRecebimentos(), listarPagamentos()]);
  const entradas = receber
    .filter((r) => r.recebido_em)
    .map((r) => ({ tipo: 'receber' as const, conta: contaDeRecebimento(r), data: r.recebido_em! }));
  const saidas = pagar
    .filter((p) => p.pago_em)
    .map((p) => ({ tipo: 'pagar' as const, conta: contaDePagamento(p), data: p.pago_em! }));
  return [...entradas, ...saidas];
}

function rotuloDia(iso: string) {
  const dia = new Date(`${iso}T12:00:00`).getDay();
  return `${formatarData(iso)} · ${DIAS_SEMANA[dia]}`;
}

// Financeiro > Extrato: entradas e saídas do mês, agrupadas por dia (como um extrato de banco)
export default function Extrato() {
  const { dados, erro, recarregar } = useCarregar(carregar);
  const [mes, setMes] = useState(mesAtual);
  const [filtro, setFiltro] = useState<Filtro>('tudo');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Movimento | null>(null);

  const { inicio, fim } = periodoDoMes(mes);
  const doMes = (dados ?? []).filter((m) => m.data >= inicio && m.data <= fim);
  const entrou = somar(doMes.filter((m) => m.tipo === 'receber').map((m) => m.conta.valorFinal));
  const saiu = somar(doMes.filter((m) => m.tipo === 'pagar').map((m) => m.conta.valorFinal));
  const saldo = emReais(emCentavos(entrou) - emCentavos(saiu));

  const termo = busca.trim().toLowerCase();
  const visiveis = doMes
    .filter((m) => filtro === 'tudo' || (filtro === 'entradas' ? m.tipo === 'receber' : m.tipo === 'pagar'))
    .filter(
      (m) =>
        !termo ||
        [m.conta.descricao, m.conta.detalhe ?? '', m.conta.viagem?.cliente ?? '', m.conta.viagem?.origem ?? '', m.conta.viagem?.destino ?? '']
          .join(' ')
          .toLowerCase()
          .includes(termo),
    )
    .sort((a, b) => (a.data === b.data ? a.conta.descricao.localeCompare(b.conta.descricao) : a.data < b.data ? 1 : -1));

  // agrupa por dia, do mais recente para o mais antigo
  const dias: { data: string; itens: Movimento[] }[] = [];
  for (const m of visiveis) {
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.data === m.data) ultimo.itens.push(m);
    else dias.push({ data: m.data, itens: [m] });
  }

  return (
    <Pagina
      titulo="Extrato"
      acao={
        <View style={styles.acoes}>
          <CampoBusca valor={busca} onChange={setBusca} placeholder="Descrição, cliente ou favorecido" />
          <Seletor rotulo="Mostrar" opcoes={FILTROS} valor={filtro} onChange={setFiltro} compacto />
          <SeletorMes mes={mes} onChange={setMes} />
        </View>
      }>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {!dados ? (
        erro ? null : <ActivityIndicator color={Cores.primaria} />
      ) : (
        <>
          <Grade>
            <CartaoResumo rotulo="Entrou" valor={formatarMoeda(entrou)} cor={Cores.sucessoTexto} detalhe="Recebido dos clientes" />
            <CartaoResumo rotulo="Saiu" valor={formatarMoeda(saiu)} cor={VERMELHO} detalhe="Pago a postos, fornecedores e motoristas" />
            <CartaoResumo
              rotulo="Saldo do mês"
              valor={formatarMoeda(saldo)}
              cor={saldo >= 0 ? Cores.primaria : VERMELHO}
              detalhe={saldo >= 0 ? 'Entrou mais do que saiu' : 'Saiu mais do que entrou'}
            />
          </Grade>

          {dias.length === 0 ? (
            <View style={styles.vazio}>
              <Text style={styles.suave}>Nada recebido ou pago neste mês.</Text>
            </View>
          ) : (
            dias.map((d) => (
              <View key={d.data} style={styles.dia}>
                <Text style={styles.diaTitulo}>{rotuloDia(d.data)}</Text>
                <View style={styles.bloco}>
                  {d.itens.map((m, i) => {
                    const entrada = m.tipo === 'receber';
                    const c = m.conta;
                    const linha2 = [
                      entrada ? c.viagem?.cliente : c.detalhe,
                      c.viagem ? `${c.viagem.origem} → ${c.viagem.destino}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <Pressable
                        key={`${m.tipo}-${c.id}`}
                        accessibilityRole="button"
                        accessibilityHint="Abre para editar"
                        onPress={() => setEditando(m)}
                        style={({ pressed, hovered }) => [
                          styles.movimento,
                          i > 0 && styles.separador,
                          (pressed || hovered) && styles.sobre,
                        ]}>
                        <View style={[styles.ponto, { backgroundColor: entrada ? Cores.sucesso : VERMELHO }]} />
                        <View style={styles.textos}>
                          <Text style={styles.descricao}>{c.descricao}</Text>
                          {linha2 ? <Text style={styles.suave}>{linha2}</Text> : null}
                        </View>
                        <Text style={[styles.valor, { color: entrada ? Cores.sucessoTexto : VERMELHO }]}>
                          {`${entrada ? '+' : '−'} ${formatarMoeda(c.valorFinal)}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </>
      )}
      {editando ? (
        <FormConta
          tipo={editando.tipo}
          conta={editando.conta}
          aoFechar={(salvou) => {
            setEditando(null);
            if (salvou) recarregar();
          }}
        />
      ) : null}
    </Pagina>
  );
}

const styles = StyleSheet.create({
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Espaco.sm,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  dia: { gap: Espaco.xs },
  diaTitulo: { fontSize: 12, fontWeight: '600', color: Cores.textoSuave, paddingHorizontal: Espaco.xs },
  bloco: {
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
    overflow: 'hidden',
  },
  movimento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    paddingHorizontal: Espaco.lg,
    paddingVertical: Espaco.sm,
    minHeight: 48,
  },
  separador: { borderTopWidth: 1, borderTopColor: Cores.borda },
  sobre: { backgroundColor: Cores.chipClaro },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  descricao: { fontSize: 14, fontWeight: '600', color: Cores.texto },
  suave: { fontSize: 12, color: Cores.textoSuave },
  valor: { fontSize: 15, fontWeight: '700' },
  vazio: {
    padding: Espaco.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
});
