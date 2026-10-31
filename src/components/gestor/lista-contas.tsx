import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormConta, type ContaEditavel } from '@/components/gestor/form-conta';
import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { CampoBusca } from '@/components/ui/campo-busca';
import { CartaoResumo, Grade } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
import { Seletor } from '@/components/ui/seletor';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores, Espaco } from '@/constants/tema';
import {
  dataDeHoje,
  situacaoDaConta,
  type ContaPagar,
  type ContaReceber,
  type ViagemDaConta,
} from '@/services/financeiro.service';
import { ROTULO_PAGAMENTO, type FormaPagamento } from '@/services/viagens.service';
import { somar } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import { formatarData, formatarMoeda } from '@/utils/formato';

/** Conta já no formato da lista (recebimento ou pagamento) */
export type ContaDaLista = ContaEditavel & {
  /** favorecido e forma (pagar) — entra na busca */
  detalhe: string | null;
  /** valor + juros - desconto: o que vale nos totais */
  valorFinal: number;
  viagem: ViagemDaConta | null;
};

export function contaDeRecebimento(r: ContaReceber): ContaDaLista {
  return {
    id: r.id,
    descricao: r.descricao,
    detalhe: null,
    favorecido: null,
    chavePix: null,
    valor: r.valor,
    juros: r.juros,
    desconto: r.desconto,
    valorFinal: r.valor_final ?? r.valor,
    observacao: r.observacao,
    vencimento: r.vencimento,
    quitadoEm: r.recebido_em,
    viagem: r.viagem,
  };
}

export function contaDePagamento(p: ContaPagar): ContaDaLista {
  return {
    id: p.id,
    descricao: p.descricao,
    detalhe: [p.favorecido, p.forma ? ROTULO_PAGAMENTO[p.forma as FormaPagamento] : null].filter(Boolean).join(' · ') || null,
    favorecido: p.favorecido,
    chavePix: p.chave_pix,
    valor: p.valor,
    juros: p.juros,
    desconto: p.desconto,
    valorFinal: p.valor_final ?? p.valor,
    observacao: p.observacao,
    vencimento: p.vencimento,
    quitadoEm: p.pago_em,
    viagem: p.viagem,
  };
}

type Filtro = 'abertas' | 'quitadas' | 'todas';

type Props = {
  tipo: 'receber' | 'pagar';
  contas: ContaDaLista[] | null;
  erro: string | null;
  aoMarcar: (id: string, quitar: boolean) => Promise<void>;
  /** depois de salvar a edição */
  aoEditar: () => void;
  /** botão extra no cabeçalho (ex.: Formas de recebimento) */
  acaoExtra?: ReactNode;
};

// cores só dos cartões de total (texto grande e em negrito, contraste suficiente)
const LARANJA = '#D97706';
const VERMELHO_VIVO = '#DC2626';

const somaDe = (contas: ContaDaLista[]) => somar(contas.map((c) => c.valorFinal));

/** Financeiro > Receber / Pagar: contas em aberto (atrasadas primeiro), com marcar como quitada. */
export function ListaContas({ tipo, contas, erro, aoMarcar, aoEditar, acaoExtra }: Props) {
  const router = useRouter();
  const receber = tipo === 'receber';
  const [filtro, setFiltro] = useState<Filtro>('abertas');
  const [busca, setBusca] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [editando, setEditando] = useState<ContaDaLista | null>(null);

  // link "Ver conta" da viagem: abre a conta direto
  const { conta: contaDoLink } = useLocalSearchParams<{ conta?: string }>();
  const [linkAberto, setLinkAberto] = useState<string | null>(null);
  if (contas && contaDoLink && linkAberto !== contaDoLink) {
    setLinkAberto(contaDoLink);
    const c = contas.find((x) => x.id === contaDoLink);
    if (c) {
      setEditando(c);
      if (c.quitadoEm) setFiltro('todas');
    }
  }

  const hoje = dataDeHoje();
  const daquiTrinta = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const abertas = (contas ?? []).filter((c) => !c.quitadoEm);
  const atrasadas = abertas.filter((c) => c.vencimento && c.vencimento < hoje);
  const proximas = abertas.filter((c) => c.vencimento && c.vencimento >= hoje && c.vencimento <= daquiTrinta);

  const termo = busca.trim().toLowerCase();
  const visiveis = (contas ?? [])
    .filter((c) => (filtro === 'abertas' ? !c.quitadoEm : filtro === 'quitadas' ? !!c.quitadoEm : true))
    .filter(
      (c) =>
        !termo ||
        [c.descricao, c.detalhe ?? '', c.viagem?.origem ?? '', c.viagem?.destino ?? '', c.viagem?.cliente ?? '']
          .join(' ')
          .toLowerCase()
          .includes(termo),
    );

  async function marcar(c: ContaDaLista, quitar: boolean) {
    setErroAcao(null);
    setOcupado(c.id);
    try {
      await aoMarcar(c.id, quitar);
    } catch (e) {
      setErroAcao(mensagemDeErro(e));
    }
    setOcupado(null);
  }

  const FILTROS = [
    { valor: 'abertas', rotulo: receber ? 'A receber' : 'A pagar' },
    { valor: 'quitadas', rotulo: receber ? 'Recebidos' : 'Pagos' },
    { valor: 'todas', rotulo: 'Todos' },
  ] as const;

  const colunas: Coluna<ContaDaLista>[] = [
    {
      titulo: 'Vencimento',
      largura: 110,
      celula: (c) => (c.vencimento ? formatarData(c.vencimento) : 'Sem data'),
    },
    {
      titulo: 'Descrição',
      flex: 2.4,
      celula: (c) => (
        <View>
          <Text style={styles.texto}>{c.descricao}</Text>
          {c.chavePix && !c.quitadoEm ? <Text selectable style={styles.suave}>{`Chave PIX: ${c.chavePix}`}</Text> : null}
          {c.observacao ? <Text style={styles.observacao}>{c.observacao}</Text> : null}
        </View>
      ),
    },
    receber
      ? {
          titulo: 'Cliente',
          flex: 1.6,
          celula: (c) =>
            c.viagem?.cliente_id ? (
              <Pressable
                accessibilityRole="link"
                accessibilityHint="Abre o cadastro do cliente"
                onPress={() => router.push({ pathname: '/gestor/clientes', params: { cliente: c.viagem!.cliente_id! } })}>
                <Text style={styles.link}>{c.viagem.cliente ?? 'Ver cliente'}</Text>
              </Pressable>
            ) : (
              (c.viagem?.cliente ?? '—')
            ),
        }
      : { titulo: 'Favorecido', flex: 1.6, celula: (c) => c.favorecido ?? '—' },
    {
      titulo: 'Viagem',
      flex: 2.3,
      celula: (c) =>
        c.viagem ? (
          <Pressable
            accessibilityRole="link"
            accessibilityHint="Abre a viagem"
            onPress={() => router.push({ pathname: '/gestor/viagens', params: { viagem: c.viagem!.id } })}>
            <Text style={styles.link}>{`${c.viagem.origem} → ${c.viagem.destino} · ${formatarData(c.viagem.data_prevista)}`}</Text>
          </Pressable>
        ) : (
          '—'
        ),
    },
    {
      titulo: 'Valor',
      largura: 120,
      direita: true,
      celula: (c) => <Text style={styles.valor}>{formatarMoeda(c.valorFinal)}</Text>,
    },
    {
      titulo: 'Situação',
      largura: 108,
      direita: true,
      celula: (c) => {
        const situacao = situacaoDaConta(c.vencimento, c.quitadoEm);
        if (situacao === 'quitado') {
          return <Selo tipo="sucesso">{receber ? 'Recebido' : 'Pago'}</Selo>;
        }
        return situacao === 'atrasado' ? <Selo tipo="perigo">Atrasado</Selo> : <Selo tipo="neutro">Em aberto</Selo>;
      },
    },
    {
      titulo: '',
      largura: 95,
      celula: (c) =>
        c.quitadoEm ? (
          <Botao titulo="Desfazer" variante="contorno" mini carregando={ocupado === c.id} onPress={() => marcar(c, false)} />
        ) : (
          <Botao
            titulo={receber ? 'Receber' : 'Pagar'}
            variante="contorno"
            mini
            carregando={ocupado === c.id}
            onPress={() => marcar(c, true)}
          />
        ),
    },
  ];

  return (
    <Pagina
      titulo={receber ? 'Receber' : 'Pagar'}
      acao={
        <View style={styles.acoes}>
          <CampoBusca valor={busca} onChange={setBusca} placeholder={receber ? 'Cliente, rota ou descrição' : 'Favorecido, rota ou descrição'} />
          <Seletor rotulo="Mostrar" opcoes={FILTROS} valor={filtro} onChange={setFiltro} compacto />
          {acaoExtra}
        </View>
      }>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {erroAcao ? <Aviso tipo="erro">{erroAcao}</Aviso> : null}

      {contas ? (
        <Grade>
          <CartaoResumo
            rotulo={receber ? 'Total a receber' : 'Total a pagar'}
            valor={formatarMoeda(somaDe(abertas))}
            detalhe={`${abertas.length} em aberto`}
            cor={receber ? Cores.sucessoTexto : LARANJA}
          />
          <CartaoResumo
            rotulo="Atrasado"
            valor={formatarMoeda(somaDe(atrasadas))}
            detalhe={`${atrasadas.length} ${atrasadas.length === 1 ? 'conta' : 'contas'}`}
            cor={VERMELHO_VIVO}
            apagado={atrasadas.length === 0}
            fundo={atrasadas.length > 0 ? Cores.perigoFundo : undefined}
          />
          <CartaoResumo
            rotulo="Próximos 30 dias"
            valor={formatarMoeda(somaDe(proximas))}
            detalhe={`${proximas.length} ${proximas.length === 1 ? 'conta' : 'contas'}`}
            cor={Cores.primaria}
          />
        </Grade>
      ) : null}

      {contas ? (
        <Tabela
          aoTocar={setEditando}
          colunas={colunas}
          itens={visiveis}
          chave={(c) => c.id}
          vazio={filtro === 'abertas' ? (receber ? 'Nada a receber.' : 'Nada a pagar.') : 'Nenhuma conta encontrada.'}
          larguraMinima={1000}
        />
      ) : erro ? null : (
        <ActivityIndicator color={Cores.primaria} />
      )}
      {editando ? (
        <FormConta
          tipo={tipo}
          conta={editando}
          aoFechar={(salvou) => {
            setEditando(null);
            if (salvou) aoEditar();
          }}
        />
      ) : null}
    </Pagina>
  );
}

const styles = StyleSheet.create({
  acoes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Espaco.sm,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  texto: { fontSize: 14, color: Cores.texto },
  suave: { fontSize: 12, color: Cores.textoSuave },
  observacao: { fontSize: 12, fontStyle: 'italic', color: Cores.textoSuave },
  link: { fontSize: 14, color: Cores.primaria },
  valor: { fontSize: 14, fontWeight: '600', color: Cores.texto },
});
