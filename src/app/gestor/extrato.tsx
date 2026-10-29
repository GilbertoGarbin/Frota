import { useRouter } from 'expo-router';
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
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores, Espaco } from '@/constants/tema';
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

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
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

const diaDaSemana = (iso: string) => DIAS_SEMANA[new Date(`${iso}T12:00:00`).getDay()];

// Financeiro > Extrato: entradas e saídas do mês, da mais recente para a mais antiga
export default function Extrato() {
  const router = useRouter();
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

  const colunas: Coluna<Movimento>[] = [
    {
      titulo: 'Data',
      largura: 120,
      celula: (m) => (
        <Text style={styles.texto}>
          {formatarData(m.data)}
          <Text style={styles.suave}>{`  ${diaDaSemana(m.data)}`}</Text>
        </Text>
      ),
    },
    { titulo: 'Descrição', flex: 3, celula: (m) => m.conta.descricao },
    {
      titulo: 'Cliente / favorecido',
      flex: 1.6,
      celula: (m) => (m.tipo === 'receber' ? m.conta.viagem?.cliente : m.conta.favorecido) ?? '—',
    },
    {
      titulo: 'Viagem',
      flex: 1.4,
      celula: (m) =>
        m.conta.viagem ? (
          <Pressable
            accessibilityRole="link"
            accessibilityHint="Abre a viagem"
            onPress={() => router.push({ pathname: '/gestor/viagens', params: { viagem: m.conta.viagem!.id } })}>
            <Text style={styles.link}>{`${m.conta.viagem.origem} → ${m.conta.viagem.destino}`}</Text>
          </Pressable>
        ) : (
          '—'
        ),
    },
    {
      titulo: 'Valor',
      largura: 140,
      direita: true,
      celula: (m) => {
        const entrada = m.tipo === 'receber';
        return (
          <Text style={[styles.valor, { color: entrada ? Cores.sucessoTexto : VERMELHO }]}>
            {`${entrada ? '+' : '−'} ${formatarMoeda(m.conta.valorFinal)}`}
          </Text>
        );
      },
    },
  ];

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

          <Tabela
            aoTocar={setEditando}
            colunas={colunas}
            itens={visiveis}
            chave={(m) => `${m.tipo}-${m.conta.id}`}
            vazio="Nada recebido ou pago neste mês."
            larguraMinima={900}
          />
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
  texto: { fontSize: 14, color: Cores.texto },
  suave: { fontSize: 12, color: Cores.textoSuave },
  link: { fontSize: 14, color: Cores.primaria },
  valor: { fontSize: 14, fontWeight: '700' },
});
