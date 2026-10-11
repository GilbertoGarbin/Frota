import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Cartao,
  Dado,
  EstadoSincronizacao,
  estilosMotorista as em,
  TelaMotorista,
  ValorCalculado,
} from '@/components/motorista/base';
import {
  PainelAbastecimento,
  PainelCarga,
  PainelConferencia,
  PainelDespesa,
  PainelDocumentos,
  PainelParada,
  temCanhoto,
  type TipoPainel,
} from '@/components/motorista/paineis';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Selo } from '@/components/ui/selo';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useMotorista } from '@/context/MotoristaContext';
import { useCarregar } from '@/hooks/use-carregar';
import {
  buscarParadaSugerida,
  buscarRegistrosDaViagem,
  type Registro,
  type ViagemMotorista,
} from '@/services/motorista.service';
import { ROTULO_PAGAMENTO, type FormaPagamento } from '@/services/viagens.service';
import { mensagemDeErro } from '@/utils/erros';
import { formatarData, formatarDataHora, formatarDecimal, formatarKm, formatarMoeda, lerDecimal } from '@/utils/formato';

type Props = { viagem: ViagemMotorista };

const useComissionado = () => useMotorista().perfil.motorista?.modelo_remuneracao === 'comissionado';

// ---------------------------------------------------------------------------
// 5.2 Confirmar viagem (programada)
// ---------------------------------------------------------------------------
export function ConfirmarViagem({ viagem }: Props) {
  const router = useRouter();
  const { perfil, iniciarViagem, viagens } = useMotorista();
  const comissionado = useComissionado();
  const veiculo = perfil.veiculos.find((v) => v.id === viagem.veiculo_id);
  const [km, setKm] = useState(veiculo ? formatarDecimal(veiculo.km_atual, 0) : '');
  const [erro, setErro] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const buscarParada = useCallback(() => buscarParadaSugerida(viagem.id), [viagem.id]);
  const { dados: parada } = useCarregar(buscarParada);
  const outraEmAndamento = viagens.some((v) => v.status === 'em_andamento');

  async function iniciar() {
    const kmLido = lerDecimal(km);
    if (kmLido === null || Number.isNaN(kmLido)) return setErro('Informe o km inicial (odômetro na saída).');
    setErro(null);
    setIniciando(true);
    try {
      await iniciarViagem(viagem, kmLido);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setIniciando(false);
    }
  }

  return (
    <TelaMotorista titulo="Confirmar viagem" subtitulo="Confira os dados antes de sair." aoVoltar={() => router.back()}>
      <Cartao>
        <Text style={em.titulo}>
          {viagem.origem} → {viagem.destino}
        </Text>
        <Dado rotulo="Data" valor={formatarData(viagem.data_prevista)} />
        <Dado rotulo="Veículo" valor={veiculo ? `${veiculo.placa} · ${veiculo.modelo}` : '—'} />
        {viagem.cliente ? <Dado rotulo="Cliente / embarcador" valor={viagem.cliente} /> : null}
        {viagem.carga ? <Dado rotulo="Carga" valor={viagem.carga} /> : null}
        <Dado rotulo="Valor do frete" valor={formatarMoeda(viagem.valor_frete_total)} />
        <Dado rotulo="Adiantamento" valor={viagem.valor_adiantamento > 0 ? formatarMoeda(viagem.valor_adiantamento) : 'Sem adiantamento'} />
        {viagem.observacoes ? <Dado rotulo="Observações" valor={viagem.observacoes} /> : null}
      </Cartao>

      {comissionado ? (
        <ValorCalculado
          trancado
          rotulo={`Sua comissão (${formatarDecimal(viagem.comissao_percentual)}%)`}
          valor={formatarMoeda(viagem.comissao_valor)}
          nota="Estimada sobre o frete. Definida no cadastro do motorista."
        />
      ) : (
        <Aviso tipo="info">Você recebe salário fixo — sem comissão por viagem.</Aviso>
      )}

      {parada ? (
        <View style={styles.lembrete}>
          <Text style={em.suave}>
            Parada frequente nesta rota: {parada.local_nome} {'★'.repeat(Math.round(parada.media_estrelas))}
            {'☆'.repeat(5 - Math.round(parada.media_estrelas))}
          </Text>
        </View>
      ) : null}

      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {outraEmAndamento ? (
        <Aviso tipo="info">Você já tem uma viagem em andamento. Finalize-a antes de iniciar esta.</Aviso>
      ) : (
        <>
          <Campo
            rotulo="Km inicial"
            ajuda="Odômetro do veículo na saída."
            value={km}
            onChangeText={setKm}
            keyboardType="numeric"
            inputMode="decimal"
          />
          <Botao titulo="Confirmar e iniciar viagem" onPress={iniciar} carregando={iniciando} />
        </>
      )}
      {viagem.editavel ? (
        <Botao
          titulo="Editar informações"
          variante="link"
          onPress={() => router.push({ pathname: '/motorista/nova-viagem', params: { id: viagem.id } })}
        />
      ) : null}
    </TelaMotorista>
  );
}

// ---------------------------------------------------------------------------
// Lista única de registros com filtro (spec 5.5: escala melhor que uma seção por tipo)
// ---------------------------------------------------------------------------
type Filtro = 'todos' | 'abastecimentos' | 'despesas' | 'paradas' | 'complementos';
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'abastecimentos', rotulo: 'Abastecimento' },
  { valor: 'despesas', rotulo: 'Despesa' },
  { valor: 'paradas', rotulo: 'Parada' },
  { valor: 'complementos', rotulo: 'Carga extra' },
];

function resumoDoRegistro(r: Registro): { simbolo: string; titulo: string; detalhe: string; valor: string } | null {
  switch (r.tabela) {
    case 'abastecimentos':
      return {
        simbolo: '⛽',
        titulo: `Abastecimento${r.linha.tanque_cheio ? ' · tanque cheio' : ''}`,
        detalhe: `${formatarDecimal(r.linha.litros, 1)} L · ${formatarKm(r.linha.km)} · ${ROTULO_PAGAMENTO[r.linha.forma_pagamento as FormaPagamento]}`,
        valor: formatarMoeda(r.linha.total),
      };
    case 'despesas':
      return {
        simbolo: '🧾',
        titulo: r.linha.categoria,
        detalhe: `${formatarData(r.linha.data)} · ${ROTULO_PAGAMENTO[r.linha.forma_pagamento as FormaPagamento]}`,
        valor: formatarMoeda(r.linha.valor),
      };
    case 'paradas':
      return {
        simbolo: '🅿',
        titulo: r.linha.local_nome,
        detalhe: `${r.linha.tipo}${r.linha.avaliacao_estrelas ? ` · ${'★'.repeat(r.linha.avaliacao_estrelas)}` : ''}`,
        valor: '',
      };
    case 'complementos':
      return {
        simbolo: '📦',
        titulo: r.linha.tipo === 'carga_complementar' ? 'Carga complementar' : 'Valor adicional (gestão)',
        detalhe: r.linha.cliente_carga_adicional ?? r.linha.descricao ?? formatarData(r.linha.data),
        valor: `+ ${formatarMoeda(r.linha.valor)}`,
      };
    default:
      return null; // documentos aparecem no painel de Documentos
  }
}

function ListaRegistros({ registros }: { registros: Registro[] }) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const visiveis = registros
    .filter((r) => r.tabela !== 'documentos' && (filtro === 'todos' || r.tabela === filtro))
    .reverse();
  return (
    <View style={styles.bloco}>
      <Text style={em.titulo}>Registros da viagem</Text>
      <View accessibilityRole="radiogroup" style={em.linha}>
        {FILTROS.map((f) => (
          <Pressable
            key={f.valor}
            accessibilityRole="radio"
            accessibilityState={{ checked: filtro === f.valor }}
            onPress={() => setFiltro(f.valor)}
            style={[styles.chip, filtro === f.valor && styles.chipAtivo]}>
            <Text style={[styles.chipTexto, filtro === f.valor && styles.chipTextoAtivo]}>{f.rotulo}</Text>
          </Pressable>
        ))}
      </View>
      {visiveis.length === 0 ? (
        <Text style={em.suave}>Nenhum lançamento registrado ainda.</Text>
      ) : (
        visiveis.map((r) => {
          const item = resumoDoRegistro(r);
          return item ? (
            <View key={r.linha.id} style={styles.registro}>
              <Text style={styles.simbolo}>{item.simbolo}</Text>
              <View style={styles.registroTexto}>
                <Text style={em.texto}>{item.titulo}</Text>
                <Text style={em.suave}>
                  {item.detalhe}
                  {r.pendente ? ' · aguardando envio' : ''}
                </Text>
              </View>
              <Text style={styles.registroValor}>{item.valor}</Text>
            </View>
          ) : null;
        })
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 5.5 Viagem em andamento
// ---------------------------------------------------------------------------
const ATALHOS: { painel: TipoPainel; rotulo: string; simbolo: string }[] = [
  { painel: 'abastecimento', rotulo: 'Abastecimento', simbolo: '⛽' },
  { painel: 'despesa', rotulo: 'Despesa', simbolo: '🧾' },
  { painel: 'parada', rotulo: 'Parada', simbolo: '🅿' },
  { painel: 'carga', rotulo: 'Carga extra', simbolo: '📦' },
];

export function ViagemEmAndamento({ viagem: salva }: Props) {
  const router = useRouter();
  const { aoVivo, registros } = useMotorista();
  const comissionado = useComissionado();
  const [painel, setPainel] = useState<TipoPainel | null>(null);
  const [avisoDocumento, setAvisoDocumento] = useState<string | undefined>(undefined);

  const viagem = aoVivo(salva);
  const daViagem = registros.filter((r) => r.linha.viagem_id === viagem.id);
  const canhotoOk = temCanhoto(viagem.id, registros);

  function abrir(novo: TipoPainel | null) {
    setAvisoDocumento(undefined);
    setPainel(novo);
  }

  // "Finalizar viagem" nunca encerra direto: sem canhoto abre Documentos; com canhoto, a conferência (5.11)
  function aoFinalizar() {
    if (canhotoOk) return abrir('conferencia');
    setPainel('documentos');
    setAvisoDocumento('Para finalizar a viagem, anexe o canhoto.');
  }

  const fechar = () => abrir(null);

  return (
    <TelaMotorista
      titulo={`${viagem.origem} → ${viagem.destino}`}
      subtitulo={`Iniciada em ${formatarDataHora(viagem.iniciada_em)}`}
      aoVoltar={() => router.back()}
      acao={<Selo tipo="aviso">Em andamento</Selo>}>
      <EstadoSincronizacao />

      <View style={styles.faixa}>
        <Text style={styles.faixaTexto}>Km inicial {formatarKm(viagem.km_inicial)}</Text>
        <Text style={styles.faixaTexto}>Frete {formatarMoeda(viagem.valor_frete_total)}</Text>
        {comissionado ? (
          <Text style={styles.faixaTexto}>
            Comissão {formatarMoeda(viagem.comissao_valor)} ({formatarDecimal(viagem.comissao_percentual)}%)
          </Text>
        ) : null}
      </View>

      {viagem.valor_adiantamento > 0 ? (
        <View style={styles.adiantamento}>
          <View style={styles.adiantamentoItem}>
            <Text style={styles.adiantamentoRotulo}>Adiantamento</Text>
            <Text style={styles.adiantamentoValor}>{formatarMoeda(viagem.valor_adiantamento)}</Text>
          </View>
          <View style={styles.adiantamentoItem}>
            <Text style={styles.adiantamentoRotulo}>Gasto até agora</Text>
            <Text style={styles.adiantamentoValor}>{formatarMoeda(viagem.adiantamento_gasto)}</Text>
          </View>
          <View style={styles.adiantamentoItem}>
            <Text style={styles.adiantamentoRotulo}>{viagem.adiantamento_saldo >= 0 ? 'Saldo' : 'A reembolsar'}</Text>
            <Text style={styles.adiantamentoValor}>{formatarMoeda(Math.abs(viagem.adiantamento_saldo))}</Text>
          </View>
        </View>
      ) : null}

      {painel === 'abastecimento' ? <PainelAbastecimento viagem={viagem} aoFechar={fechar} /> : null}
      {painel === 'despesa' ? <PainelDespesa viagem={viagem} aoFechar={fechar} /> : null}
      {painel === 'parada' ? <PainelParada viagem={viagem} aoFechar={fechar} /> : null}
      {painel === 'carga' ? <PainelCarga viagem={viagem} aoFechar={fechar} /> : null}
      {painel === 'documentos' ? <PainelDocumentos viagem={viagem} aoFechar={fechar} aviso={avisoDocumento} /> : null}
      {painel === 'conferencia' ? (
        <PainelConferencia viagem={viagem} aoFechar={fechar} aoFinalizar={() => router.replace('/motorista/historico')} />
      ) : null}

      {painel === null ? (
        <>
          <View style={em.grade}>
            {ATALHOS.map((a) => (
              <Pressable key={a.painel} accessibilityRole="button" accessibilityLabel={a.rotulo} onPress={() => abrir(a.painel)} style={[styles.atalho, em.metade]}>
                <Text style={styles.atalhoSimbolo}>{a.simbolo}</Text>
                <Text style={styles.atalhoRotulo}>{a.rotulo}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="Documentos" onPress={() => abrir('documentos')} style={[styles.atalho, styles.atalhoLargo]}>
              <Text style={styles.atalhoSimbolo}>📄</Text>
              <Text style={styles.atalhoRotulo}>Documentos</Text>
              {canhotoOk ? null : <Selo tipo="perigo">1 pendente</Selo>}
            </Pressable>
          </View>
          <Botao titulo="Finalizar viagem" variante="perigo" onPress={aoFinalizar} />
          <ListaRegistros registros={daViagem} />
        </>
      ) : null}
    </TelaMotorista>
  );
}

// ---------------------------------------------------------------------------
// Viagem finalizada (aberta a partir do Histórico)
// ---------------------------------------------------------------------------
export function ViagemFinalizada({ viagem }: Props) {
  const router = useRouter();
  const comissionado = useComissionado();
  const buscar = useCallback(() => buscarRegistrosDaViagem(viagem.id), [viagem.id]);
  const { dados: registros, erro } = useCarregar(buscar);
  const saldo = viagem.adiantamento_saldo;

  return (
    <TelaMotorista
      titulo={`${viagem.origem} → ${viagem.destino}`}
      subtitulo={`Chegada em ${formatarDataHora(viagem.data_hora_chegada)}`}
      aoVoltar={() => router.back()}
      acao={<Selo tipo="sucesso">Finalizada</Selo>}>
      <Cartao>
        <Dado rotulo="Km rodado" valor={formatarKm((viagem.km_final ?? 0) - (viagem.km_inicial ?? 0))} />
        <Dado rotulo="Frete" valor={formatarMoeda(viagem.valor_frete_total)} />
        {comissionado ? <Dado rotulo="Sua comissão" valor={formatarMoeda(viagem.comissao_valor)} /> : null}
        {viagem.local_chegada ? <Dado rotulo="Local de chegada" valor={viagem.local_chegada} /> : null}
      </Cartao>
      {viagem.valor_adiantamento > 0 || viagem.gasto_proprio_bolso > 0 ? (
        <Cartao>
          <Text style={em.titulo}>Prestação de contas</Text>
          <Dado rotulo="Adiantamento recebido" valor={formatarMoeda(viagem.valor_adiantamento)} />
          <Dado rotulo="Gasto com adiantamento" valor={formatarMoeda(viagem.adiantamento_gasto)} />
          <Dado rotulo={saldo >= 0 ? 'Saldo a devolver à empresa' : 'Saldo a reembolsar'} valor={formatarMoeda(Math.abs(saldo))} />
          {viagem.gasto_proprio_bolso > 0 ? (
            <Dado rotulo="Pago do próprio bolso (a reembolsar)" valor={formatarMoeda(viagem.gasto_proprio_bolso)} />
          ) : null}
          {viagem.adiantamento_acertado ? <Selo tipo="sucesso">Acertado com a empresa</Selo> : <Selo tipo="aviso">Acerto pendente</Selo>}
        </Cartao>
      ) : null}
      {registros ? (
        <ListaRegistros registros={registros} />
      ) : erro ? (
        <Aviso tipo="info">Os lançamentos desta viagem aparecem quando houver internet.</Aviso>
      ) : (
        <ActivityIndicator color={Cores.primaria} />
      )}
    </TelaMotorista>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: Espaco.sm },
  lembrete: { padding: Espaco.md, borderRadius: Raio.sm, backgroundColor: '#F1F5F9' },
  faixa: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Espaco.lg,
    rowGap: 2,
    padding: Espaco.md,
    borderRadius: Raio.sm,
    backgroundColor: Cores.chipClaro,
  },
  faixaTexto: { fontSize: 14, fontWeight: '600', color: Cores.primariaEscura },
  adiantamento: {
    flexDirection: 'row',
    padding: Espaco.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.sm,
    backgroundColor: Cores.branco,
  },
  adiantamentoItem: { flex: 1, gap: 2 },
  adiantamentoRotulo: { fontSize: 12, color: Cores.textoSuave },
  adiantamentoValor: { fontSize: 15, fontWeight: '700', color: Cores.texto },
  atalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
    minHeight: 64,
    paddingHorizontal: Espaco.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  atalhoLargo: { flexBasis: '100%' },
  atalhoSimbolo: { fontSize: 22 },
  atalhoRotulo: { flex: 1, fontSize: 16, fontWeight: '600', color: Cores.texto },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Espaco.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 999,
    backgroundColor: Cores.branco,
  },
  chipAtivo: { borderColor: Cores.primaria, backgroundColor: Cores.chipClaro },
  chipTexto: { fontSize: 13, color: Cores.texto },
  chipTextoAtivo: { fontWeight: '700', color: Cores.primariaEscura },
  registro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    paddingVertical: Espaco.sm,
    borderTopWidth: 1,
    borderTopColor: Cores.borda,
  },
  simbolo: { fontSize: 20, width: 28, textAlign: 'center' },
  registroTexto: { flex: 1, gap: 2 },
  registroValor: { fontSize: 15, fontWeight: '700', color: Cores.texto },
});
