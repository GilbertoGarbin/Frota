import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
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
import { Seletor } from '@/components/ui/seletor';
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
  const veiculoTexto = (id: string) => {
    const vei = dados?.veiculos.find((v) => v.id === id);
    return vei ? `${vei.placa} — ${vei.modelo}` : '—';
  };

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
          <Seletor rotulo="Mostrar" opcoes={FILTROS} valor={filtro} onChange={setFiltro} compacto />
          <Botao titulo="+ Nova viagem" compacto onPress={() => setModo({ tipo: 'nova' })} desativado={!dados} />
        </View>
      }>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

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
            veiculo={veiculoTexto(v.veiculo_id)}
            aoAbrir={() => setModo({ tipo: 'detalhe', id: v.id })}
          />
        ))
      )}
      {formulario}
    </Pagina>
  );
}

type PropsCartao = { viagem: Viagem; motorista: string; veiculo: string; aoAbrir: () => void };

const ICONE_STATUS: Record<StatusViagem, keyof typeof MaterialCommunityIcons.glyphMap> = {
  programada: 'clock-outline',
  em_andamento: 'truck-outline',
  finalizada: 'check',
};

// Cartão da lista (layout do protótipo): rota com marcador, dados da viagem e os cinco números
function CartaoViagem({ viagem: v, motorista, veiculo, aoAbrir }: PropsCartao) {
  const status = v.status as StatusViagem;
  const finalizada = status === 'finalizada';
  const margem = margemPercentual(v);
  const tomMargem = finalizada ? tomDaMargem(margem) : 'neutro';
  const corStatus = finalizada ? 'sucesso' : status === 'em_andamento' ? 'aviso' : 'neutro';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir viagem ${v.origem} para ${v.destino}`}
      onPress={aoAbrir}
      style={({ pressed }) => [styles.cartao, pressed && styles.pressionado]}>
      <View style={styles.cabecalho}>
        <View style={styles.titulos}>
          <View style={styles.rotaLinha}>
            <MaterialCommunityIcons name="map-marker-outline" size={18} color={Cores.primaria} />
            <Text style={styles.rota} numberOfLines={1}>
              {v.origem} → {v.destino}
            </Text>
          </View>
          <Text style={styles.suave} numberOfLines={1}>
            {formatarData(v.data_prevista)} · {motorista} · {veiculo}
            {v.cliente ? ` · ${v.cliente}` : ''}
          </Text>
        </View>
        {adiantamentoEmAberto(v) ? <Selo tipo="aviso">Adiantamento em aberto</Selo> : null}
        <View style={[styles.status, styles[`status_${corStatus}`]]}>
          <MaterialCommunityIcons name={ICONE_STATUS[status]} size={14} color={COR_STATUS[corStatus]} />
          <Text style={[styles.statusTexto, { color: COR_STATUS[corStatus] }]}>{ROTULO_STATUS[status]}</Text>
        </View>
      </View>
      <View style={styles.numeros}>
        <Numero
          rotulo="Frete Bruto"
          valor={formatarMoeda(v.valor_frete_total)}
          nota={v.valor_frete_total !== v.valor_frete ? 'Com adicionais' : undefined}
        />
        <Numero
          rotulo="Combustível"
          valor={formatarMoeda(v.combustivel_valor ?? 0)}
          extra={<SeloCombustivel status={v.combustivel_status} />}
        />
        <Numero rotulo="Comissão" valor={formatarMoeda(v.comissao_valor)} />
        <Numero rotulo="Outras Despesas" valor={formatarMoeda(v.total_despesas)} />
        <Numero
          rotulo="Margem Operacional"
          valor={finalizada ? `${formatarMoeda(v.resultado_operacional)} (${formatarPercentual(margem)})` : '—'}
          tom={tomMargem}
          nota={finalizada ? undefined : 'Ao finalizar'}
        />
      </View>
    </Pressable>
  );
}

const COR_STATUS = { sucesso: Cores.sucessoTexto, aviso: Cores.avisoTexto, neutro: Cores.textoSuave } as const;

/** Quadradinho de número do cartão: rótulo pequeno, valor em destaque. */
function Numero({
  rotulo,
  valor,
  nota,
  extra,
  tom = 'neutro',
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  extra?: ReactNode;
  tom?: 'neutro' | 'sucesso' | 'perigo';
}) {
  return (
    <View style={[styles.numero, tom === 'sucesso' && styles.numeroSucesso, tom === 'perigo' && styles.numeroPerigo]}>
      <Text style={styles.numeroRotulo}>{rotulo}</Text>
      <Text
        style={[
          styles.numeroValor,
          tom === 'sucesso' && { color: Cores.sucessoTexto },
          tom === 'perigo' && { color: Cores.perigoTexto },
        ]}>
        {valor}
      </Text>
      {extra}
      {nota ? <Text style={styles.numeroNota}>{nota}</Text> : null}
    </View>
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
  pressionado: { opacity: 0.85 },
  rotaLinha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.xs },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Espaco.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },
  status_sucesso: { backgroundColor: Cores.sucessoFundo },
  status_aviso: { backgroundColor: Cores.avisoFundo },
  status_neutro: { backgroundColor: Cores.fundo },
  statusTexto: { fontSize: 12, fontWeight: '600' },
  numeros: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.sm },
  numero: {
    flexGrow: 1,
    flexBasis: 150,
    gap: 2,
    paddingHorizontal: Espaco.md,
    paddingVertical: Espaco.sm,
    borderRadius: Raio.sm,
    backgroundColor: Cores.fundo,
  },
  numeroSucesso: { backgroundColor: Cores.sucessoFundo },
  numeroPerigo: { backgroundColor: Cores.perigoFundo },
  numeroRotulo: { fontSize: 12, color: Cores.textoSuave },
  numeroValor: { fontSize: 15, fontWeight: '700', color: Cores.texto },
  numeroNota: { fontSize: 11, color: Cores.textoSuave },
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
