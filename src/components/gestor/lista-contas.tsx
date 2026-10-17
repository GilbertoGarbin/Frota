import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { CampoBusca } from '@/components/ui/campo-busca';
import { Faixa, ItemFaixa } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
import { Seletor } from '@/components/ui/seletor';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { dataDeHoje, situacaoDaConta, type ViagemDaConta } from '@/services/financeiro.service';
import { somar } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import { formatarData, formatarMoeda } from '@/utils/formato';

/** Conta já no formato da lista (recebimento ou pagamento) */
export type ContaDaLista = {
  id: string;
  descricao: string;
  /** cliente (receber) ou favorecido/forma (pagar) */
  detalhe: string | null;
  chavePix: string | null;
  valor: number;
  vencimento: string | null;
  quitadoEm: string | null;
  viagem: ViagemDaConta | null;
};

type Filtro = 'abertas' | 'quitadas' | 'todas';

type Props = {
  tipo: 'receber' | 'pagar';
  contas: ContaDaLista[] | null;
  erro: string | null;
  aoMarcar: (id: string, quitar: boolean) => Promise<void>;
  /** botão extra no cabeçalho (ex.: Formas de recebimento) */
  acaoExtra?: ReactNode;
};

const somaDe = (contas: ContaDaLista[]) => somar(contas.map((c) => c.valor));

/** Financeiro > Receber / Pagar: contas em aberto (atrasadas primeiro), com marcar como quitada. */
export function ListaContas({ tipo, contas, erro, aoMarcar, acaoExtra }: Props) {
  const router = useRouter();
  const receber = tipo === 'receber';
  const [filtro, setFiltro] = useState<Filtro>('abertas');
  const [busca, setBusca] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const hoje = dataDeHoje();
  const daquiSete = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const abertas = (contas ?? []).filter((c) => !c.quitadoEm);
  const atrasadas = abertas.filter((c) => c.vencimento && c.vencimento < hoje);
  const semana = abertas.filter((c) => c.vencimento && c.vencimento >= hoje && c.vencimento <= daquiSete);

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

  return (
    <Pagina
      titulo={receber ? 'Receber' : 'Pagar'}
      subtitulo={
        receber
          ? 'Fretes e complementos que os clientes devem. Gerados na viagem pela forma de recebimento.'
          : 'Postos, fornecedores, reembolsos e adiantamentos aos motoristas. Criados sozinhos pelos lançamentos.'
      }
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
        <Faixa>
          <ItemFaixa rotulo={receber ? 'Total a receber' : 'Total a pagar'} valor={formatarMoeda(somaDe(abertas))} detalhe={`${abertas.length} em aberto`} />
          <ItemFaixa
            rotulo="Atrasado"
            valor={formatarMoeda(somaDe(atrasadas))}
            tom={atrasadas.length > 0 ? 'perigo' : 'neutro'}
            detalhe={`${atrasadas.length} ${atrasadas.length === 1 ? 'conta' : 'contas'}`}
          />
          <ItemFaixa
            rotulo="Próximos 7 dias"
            valor={formatarMoeda(somaDe(semana))}
            detalhe={`${semana.length} ${semana.length === 1 ? 'conta' : 'contas'}`}
          />
        </Faixa>
      ) : null}

      {!contas ? (
        erro ? null : <ActivityIndicator color={Cores.primaria} />
      ) : visiveis.length === 0 ? (
        <View style={styles.vazio}>
          <Text style={styles.suave}>
            {filtro === 'abertas' ? (receber ? 'Nada a receber.' : 'Nada a pagar.') : 'Nenhuma conta encontrada.'}
          </Text>
        </View>
      ) : (
        <View style={styles.lista}>
          {visiveis.map((c) => {
            const situacao = situacaoDaConta(c.vencimento, c.quitadoEm);
            return (
              <View key={c.id} style={styles.conta}>
                <View style={styles.textos}>
                  <Text style={styles.descricao}>{c.descricao}</Text>
                  {c.viagem ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => router.push({ pathname: '/gestor/viagens', params: { viagem: c.viagem!.id } })}>
                      <Text style={styles.link}>
                        {`${c.viagem.origem} → ${c.viagem.destino} · ${formatarData(c.viagem.data_prevista)}`}
                        {receber && c.viagem.cliente ? ` · ${c.viagem.cliente}` : ''}
                      </Text>
                    </Pressable>
                  ) : null}
                  {c.detalhe ? <Text style={styles.suave}>{c.detalhe}</Text> : null}
                  {c.chavePix && !c.quitadoEm ? <Text selectable style={styles.suave}>{`Chave PIX: ${c.chavePix}`}</Text> : null}
                </View>
                <View style={styles.direita}>
                  <Text style={styles.valor}>{formatarMoeda(c.valor)}</Text>
                  {situacao === 'quitado' ? (
                    <Selo tipo="sucesso">{`${receber ? 'Recebido' : 'Pago'} em ${formatarData(c.quitadoEm)}`}</Selo>
                  ) : (
                    <Selo tipo={situacao === 'atrasado' ? 'perigo' : 'neutro'}>
                      {c.vencimento ? `${situacao === 'atrasado' ? 'Venceu' : 'Vence'} em ${formatarData(c.vencimento)}` : 'Sem data'}
                    </Selo>
                  )}
                  {c.quitadoEm ? (
                    <Botao titulo="Desfazer" variante="link" compacto carregando={ocupado === c.id} onPress={() => marcar(c, false)} />
                  ) : (
                    <Botao
                      titulo={receber ? 'Marcar como recebido' : 'Marcar como pago'}
                      variante="contorno"
                      compacto
                      carregando={ocupado === c.id}
                      onPress={() => marcar(c, true)}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
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
  lista: { gap: Espaco.sm },
  conta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Espaco.md,
    paddingHorizontal: Espaco.lg,
    paddingVertical: Espaco.sm,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  textos: { flexGrow: 1, flexBasis: 280, minWidth: 0, gap: 2 },
  descricao: { fontSize: 15, fontWeight: '600', color: Cores.texto },
  link: { fontSize: 13, color: Cores.primaria },
  suave: { fontSize: 13, color: Cores.textoSuave },
  direita: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: Espaco.sm },
  valor: { fontSize: 16, fontWeight: '600', color: Cores.texto, minWidth: 110, textAlign: 'right' },
  vazio: {
    padding: Espaco.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
});
