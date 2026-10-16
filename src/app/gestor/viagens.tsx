import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DetalheViagem,
  margemPercentual,
  SeloCombustivel,
  tomDaMargem,
} from '@/components/gestor/detalhe-viagem';
import { FormViagem } from '@/components/gestor/form-viagem';
import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { CampoBusca } from '@/components/ui/campo-busca';
import { Faixa, ItemFaixa } from '@/components/ui/cartao';
import { Segmentado } from '@/components/ui/segmentado';
import { Selo } from '@/components/ui/selo';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import {
  carregarTelaViagens,
  ROTULO_STATUS,
  type StatusViagem,
  type Viagem,
} from '@/services/viagens.service';
import { formatarData, formatarMoeda, formatarPercentual } from '@/utils/formato';

type Filtro = 'todas' | StatusViagem | 'adiantamento';

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'programada', rotulo: 'Programadas' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'finalizada', rotulo: 'Finalizadas' },
  { valor: 'adiantamento', rotulo: 'Adiantamento em aberto' },
];

const adiantamentoEmAberto = (v: Viagem) =>
  v.status === 'finalizada' && v.valor_adiantamento > 0 && !v.adiantamento_acertado;

type Modo = { tipo: 'lista' } | { tipo: 'nova' } | { tipo: 'editar'; viagem: Viagem } | { tipo: 'detalhe'; id: string };

// Tela 4 — Gestão de Viagens e DRE por rota
export default function Viagens() {
  const parametros = useLocalSearchParams<{ filtro?: string }>();
  const { dados, erro, recarregar } = useCarregar(carregarTelaViagens);
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
  const [filtro, setFiltro] = useState<Filtro>(parametros.filtro === 'adiantamento' ? 'adiantamento' : 'todas');
  const [busca, setBusca] = useState('');

  const nomeMotorista = (id: string) => dados?.motoristas.find((m) => m.id === id)?.nome ?? '—';
  const placa = (id: string) => dados?.veiculos.find((v) => v.id === id)?.placa ?? '—';

  const formulario =
    dados && (modo.tipo === 'nova' || modo.tipo === 'editar') ? (
      <FormViagem
        viagem={modo.tipo === 'editar' ? modo.viagem : null}
        motoristas={dados.motoristas}
        veiculos={dados.veiculos}
        aoFechar={(salvou) => {
          if (salvou) recarregar();
          setModo(modo.tipo === 'editar' ? { tipo: 'detalhe', id: modo.viagem.id } : { tipo: 'lista' });
        }}
      />
    ) : null;

  // editar abre a janela por cima do detalhe da viagem
  const detalheId = modo.tipo === 'detalhe' ? modo.id : modo.tipo === 'editar' ? modo.viagem.id : null;
  if (dados && detalheId) {
    const viagem = dados.viagens.find((v) => v.id === detalheId);
    return (
      <>
        <DetalheViagem
          key={`${detalheId}-${viagem?.atualizado_em}`}
          viagemId={detalheId}
          nomeMotorista={viagem ? nomeMotorista(viagem.motorista_id) : '—'}
          placa={viagem ? placa(viagem.veiculo_id) : '—'}
          aoVoltar={() => {
            recarregar();
            setModo({ tipo: 'lista' });
          }}
          aoEditar={(v) => setModo({ tipo: 'editar', viagem: v })}
        />
        {formulario}
      </>
    );
  }

  const termo = busca.trim().toLowerCase();
  const visiveis = (dados?.viagens ?? []).filter((v) => {
    if (filtro === 'adiantamento' ? !adiantamentoEmAberto(v) : filtro !== 'todas' && v.status !== filtro) return false;
    if (!termo) return true;
    return [v.origem, v.destino, v.cliente ?? '', nomeMotorista(v.motorista_id), placa(v.veiculo_id)]
      .join(' ')
      .toLowerCase()
      .includes(termo);
  });

  return (
    <Pagina
      titulo="Viagens"
      subtitulo="Crie, atribua e acompanhe a margem de cada viagem."
      acao={
        <View style={styles.acoes}>
          <CampoBusca valor={busca} onChange={setBusca} placeholder="Placa, motorista, cliente ou cidade" />
          <Botao titulo="+ Nova viagem" compacto onPress={() => setModo({ tipo: 'nova' })} desativado={!dados} />
        </View>
      }>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Segmentado rotulo="Mostrar" opcoes={FILTROS} valor={filtro} onChange={setFiltro} />

      {!dados ? (
        erro ? null : <ActivityIndicator color={Cores.primaria} />
      ) : visiveis.length === 0 ? (
        <View style={styles.vazio}>
          <Text style={styles.suave}>
            {dados.viagens.length === 0 ? 'Nenhuma viagem cadastrada ainda.' : 'Nenhuma viagem neste filtro.'}
          </Text>
        </View>
      ) : (
        visiveis.map((v) => (
          <CartaoViagem
            key={v.id}
            viagem={v}
            motorista={nomeMotorista(v.motorista_id)}
            placa={placa(v.veiculo_id)}
            aoAbrir={() => setModo({ tipo: 'detalhe', id: v.id })}
          />
        ))
      )}
      {formulario}
    </Pagina>
  );
}

type PropsCartao = { viagem: Viagem; motorista: string; placa: string; aoAbrir: () => void };

function CartaoViagem({ viagem: v, motorista, placa, aoAbrir }: PropsCartao) {
  const status = v.status as StatusViagem;
  const finalizada = status === 'finalizada';
  const margem = margemPercentual(v);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir viagem ${v.origem} para ${v.destino}`} onPress={aoAbrir} style={styles.cartao}>
      <View style={styles.cabecalho}>
        <View style={styles.titulos}>
          <Text style={styles.rota}>
            {v.origem} → {v.destino}
          </Text>
          <Text style={styles.suave}>
            {motorista} · {placa} · {formatarData(v.data_prevista)}
            {v.cliente ? ` · ${v.cliente}` : ''}
          </Text>
        </View>
        {adiantamentoEmAberto(v) ? <Selo tipo="aviso">Adiantamento em aberto</Selo> : null}
        <Selo tipo={finalizada ? 'sucesso' : status === 'em_andamento' ? 'aviso' : 'info'}>{ROTULO_STATUS[status]}</Selo>
      </View>
      <Faixa>
        <ItemFaixa
          rotulo="Frete bruto"
          valor={formatarMoeda(v.valor_frete_total)}
          detalhe={v.valor_frete_total !== v.valor_frete ? `Base ${formatarMoeda(v.valor_frete)} + adicionais` : undefined}
        />
        <ItemFaixa
          rotulo="Combustível"
          valor={formatarMoeda(v.combustivel_valor)}
          extra={<SeloCombustivel status={v.combustivel_status} />}
        />
        <ItemFaixa rotulo="Comissão" valor={formatarMoeda(v.comissao_valor)} />
        <ItemFaixa rotulo="Outras despesas" valor={formatarMoeda(v.total_despesas)} />
        <ItemFaixa
          rotulo="Margem"
          tom={finalizada ? tomDaMargem(margem) : 'neutro'}
          valor={finalizada ? formatarMoeda(v.resultado_operacional) : '—'}
          detalhe={finalizada ? formatarPercentual(margem) : undefined}
        />
      </Faixa>
    </Pressable>
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
  suave: { fontSize: 13, color: Cores.textoSuave },
  vazio: {
    padding: Espaco.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  cartao: {
    gap: Espaco.md,
    padding: Espaco.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  cabecalho: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.sm },
  titulos: { flex: 1, minWidth: 220, gap: 2 },
  rota: { fontSize: 17, fontWeight: '700', color: Cores.texto },
});
