import { useState } from 'react';
import { ActivityIndicator, Linking } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { CampoAnexo } from '@/components/motorista/base';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Grade, Indicador } from '@/components/ui/cartao';
import { Segmentado } from '@/components/ui/segmentado';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';
import { useCarregar } from '@/hooks/use-carregar';
import type { Anexo } from '@/services/anexo.service';
import {
  carregarTelaManutencoes,
  enviarNotaFiscal,
  excluirManutencao,
  salvarManutencao,
  TIPOS_MANUTENCAO,
  type Manutencao,
  type TipoManutencao,
} from '@/services/gestao.service';
import type { Veiculo } from '@/services/veiculos.service';
import { urlDoArquivo } from '@/services/viagens.service';
import { somar } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import {
  formatarData,
  formatarDecimal,
  formatarKm,
  formatarMoeda,
  hojeIso,
  lerData,
  lerDecimal,
  mascararData,
  mesAtual,
  periodoDoMes,
  rotuloMes,
} from '@/utils/formato';

const AVISO_KM = 1000; // mesmo limite dos alertas da Visão Geral
const PAGAMENTO = [
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'pago', rotulo: 'Pago' },
] as const;

const rotuloTipo = (tipo: string) => TIPOS_MANUTENCAO.find((t) => t.valor === tipo)?.rotulo ?? tipo;

/** Km que faltam para a próxima manutenção de cada veículo (pela última com "próxima em km"). */
function proximasPorVeiculo(manutencoes: Manutencao[], veiculos: Veiculo[]) {
  return veiculos.flatMap((veiculo) => {
    if (veiculo.status === 'inativo') return [];
    const ultima = manutencoes
      .filter((m) => m.veiculo_id === veiculo.id && m.km_proxima !== null)
      .sort((a, b) => (b.km ?? 0) - (a.km ?? 0))[0];
    return ultima ? [{ veiculo, falta: ultima.km_proxima! - veiculo.km_atual }] : [];
  });
}

// Tela 5 — Manutenções e preventivas
export default function Manutencoes() {
  const { dados, erro, recarregar } = useCarregar(carregarTelaManutencoes);
  // undefined = lista; null = nova; Manutencao = editando
  const [editando, setEditando] = useState<Manutencao | null | undefined>(undefined);

  if (editando !== undefined && dados) {
    return (
      <FormManutencao
        manutencao={editando}
        veiculos={dados.veiculos}
        aoFechar={(salvou) => {
          setEditando(undefined);
          if (salvou) recarregar();
        }}
      />
    );
  }

  const placa = (id: string) => dados?.veiculos.find((v) => v.id === id)?.placa ?? '—';
  const proximas = dados ? proximasPorVeiculo(dados.manutencoes, dados.veiculos) : [];
  const vencidas = proximas.filter((p) => p.falta <= 0).length;
  const aVencer = proximas.filter((p) => p.falta > 0 && p.falta <= AVISO_KM).length;
  const mes = mesAtual();
  const { inicio, fim } = periodoDoMes(mes);
  const gastoNoMes = somar((dados?.manutencoes ?? []).filter((m) => m.data >= inicio && m.data <= fim).map((m) => m.valor));

  const colunas: Coluna<Manutencao>[] = [
    { titulo: 'Data', celula: (m) => formatarData(m.data) },
    { titulo: 'Placa', celula: (m) => placa(m.veiculo_id) },
    { titulo: 'Tipo', flex: 2, celula: (m) => `${rotuloTipo(m.tipo)}${m.descricao ? ` — ${m.descricao}` : ''}` },
    { titulo: 'Oficina', flex: 1.5, celula: (m) => m.oficina ?? '—' },
    { titulo: 'Valor', celula: (m) => formatarMoeda(m.valor) },
    {
      titulo: 'Pagamento',
      celula: (m) => (m.pago ? <Selo tipo="sucesso">Pago</Selo> : <Selo tipo="aviso">Pendente</Selo>),
    },
    {
      titulo: 'Ações',
      celula: (m) => <Botao titulo="Editar" variante="contorno" compacto onPress={() => setEditando(m)} />,
    },
  ];

  return (
    <Pagina
      titulo="Manutenções"
      subtitulo="Registros de oficina e alertas por quilometragem."
      acao={<Botao titulo="+ Nova manutenção" compacto onPress={() => setEditando(null)} desativado={!dados} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {dados ? (
        <>
          <Grade>
            <Indicador
              rotulo="Vencidas"
              tom={vencidas > 0 ? 'perigo' : 'neutro'}
              valor={`${vencidas > 0 ? '⚠ ' : ''}${vencidas}`}
              detalhe="Km atual já passou do limite"
            />
            <Indicador rotulo="Próximas" valor={String(aVencer)} detalhe={`A menos de ${AVISO_KM.toLocaleString('pt-BR')} km`} />
            <Indicador rotulo={`Gasto em ${rotuloMes(mes)}`} valor={formatarMoeda(gastoNoMes)} />
          </Grade>
          {proximas
            .filter((p) => p.falta <= AVISO_KM)
            .map((p) => (
              <Aviso key={p.veiculo.id} tipo={p.falta <= 0 ? 'erro' : 'info'}>
                {p.falta <= 0
                  ? `${p.veiculo.placa}: manutenção vencida há ${formatarKm(-p.falta)}.`
                  : `${p.veiculo.placa}: próxima manutenção em ${formatarKm(p.falta)}.`}
              </Aviso>
            ))}
          <Tabela colunas={colunas} itens={dados.manutencoes} chave={(m) => m.id} vazio="Nenhuma manutenção registrada ainda." larguraMinima={900} />
        </>
      ) : erro ? null : (
        <ActivityIndicator color={Cores.primaria} />
      )}
    </Pagina>
  );
}

type PropsForm = { manutencao: Manutencao | null; veiculos: Veiculo[]; aoFechar: (salvou: boolean) => void };

function FormManutencao({ manutencao: m, veiculos, aoFechar }: PropsForm) {
  const [veiculoId, setVeiculoId] = useState(m?.veiculo_id ?? null);
  const [tipo, setTipo] = useState<TipoManutencao>((m?.tipo as TipoManutencao) ?? 'preventiva');
  const [descricao, setDescricao] = useState(m?.descricao ?? '');
  const [valor, setValor] = useState(m ? formatarDecimal(m.valor) : '');
  const [data, setData] = useState(formatarData(m?.data ?? hojeIso()));
  const [km, setKm] = useState(m?.km != null ? formatarDecimal(m.km, 0) : '');
  const [proxima, setProxima] = useState(m?.proxima_em_km != null ? formatarDecimal(m.proxima_em_km, 0) : '');
  const [oficina, setOficina] = useState(m?.oficina ?? '');
  const [pagamento, setPagamento] = useState<'pendente' | 'pago'>(m?.pago ? 'pago' : 'pendente');
  const { acesso } = useSessao();
  const [nota, setNota] = useState<Anexo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  const opcoesVeiculo = veiculos.map((v) => ({ valor: v.id, rotulo: `${v.placa} · ${v.modelo}` }));

  function aoEscolherVeiculo(id: string) {
    setVeiculoId(id);
    if (!km) setKm(formatarDecimal(veiculos.find((v) => v.id === id)?.km_atual ?? 0, 0));
  }

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setSalvando(true);
    try {
      await acao();
      aoFechar(true);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  function aoSalvar() {
    const dataIso = lerData(data);
    const valorLido = lerDecimal(valor) ?? 0;
    const kmLido = lerDecimal(km);
    const proximaLida = lerDecimal(proxima);
    if (!veiculoId) return setErro('Escolha o veículo.');
    if (!dataIso) return setErro('Data inválida. Use dia/mês/ano.');
    if (Number.isNaN(valorLido)) return setErro('Valor inválido.');
    if (Number.isNaN(kmLido) || Number.isNaN(proximaLida)) return setErro('Quilometragem inválida.');
    if (proximaLida !== null && kmLido === null) return setErro('Informe o km do veículo para programar a próxima manutenção.');
    executar(async () =>
      salvarManutencao(m?.id ?? null, {
        // nota nova substitui a anterior; sem nota nova, mantém a que já estava
        nota_fiscal_path: nota && acesso ? await enviarNotaFiscal(acesso.tenantId, nota) : (m?.nota_fiscal_path ?? null),
        veiculo_id: veiculoId,
        tipo,
        descricao: descricao.trim() || null,
        valor: valorLido,
        data: dataIso,
        km: kmLido,
        proxima_em_km: proximaLida || null,
        oficina: oficina.trim() || null,
        pago: pagamento === 'pago',
      }),
    );
  }

  return (
    <Pagina titulo={m ? 'Editar manutenção' : 'Nova manutenção'} estreita>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Segmentado
        rotulo="Veículo"
        opcoes={opcoesVeiculo}
        valor={veiculoId}
        onChange={aoEscolherVeiculo}
        ajuda={veiculos.length === 0 ? 'Cadastre um veículo em “Veículos” primeiro.' : undefined}
      />
      <Segmentado rotulo="Tipo" opcoes={TIPOS_MANUTENCAO} valor={tipo} onChange={setTipo} />
      <Campo rotulo="Descrição" value={descricao} onChangeText={setDescricao} placeholder="Ex.: troca de óleo" />
      <Campo rotulo="Valor (R$)" value={valor} onChangeText={setValor} keyboardType="numeric" inputMode="decimal" />
      <Campo
        rotulo="Data"
        value={data}
        onChangeText={(t) => setData(mascararData(t))}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        maxLength={10}
      />
      <Campo rotulo="Km do veículo na manutenção" value={km} onChangeText={setKm} keyboardType="numeric" inputMode="decimal" />
      <Campo
        rotulo="Próxima manutenção em (+km)"
        ajuda="Opcional. Ex.: 10000 gera um alerta quando o veículo rodar mais 10.000 km."
        value={proxima}
        onChangeText={setProxima}
        keyboardType="numeric"
        inputMode="decimal"
      />
      <Campo rotulo="Oficina" value={oficina} onChangeText={setOficina} />
      <Segmentado rotulo="Pagamento" opcoes={PAGAMENTO} valor={pagamento} onChange={setPagamento} />
      <CampoAnexo rotulo={m?.nota_fiscal_path ? 'Nota fiscal (anexar outra substitui a atual)' : 'Nota fiscal (opcional)'} anexo={nota} onChange={setNota} />
      {m?.nota_fiscal_path ? (
        <Botao
          titulo="Abrir nota fiscal atual"
          variante="link"
          onPress={() => urlDoArquivo(m.nota_fiscal_path!).then(Linking.openURL, (e) => setErro(mensagemDeErro(e)))}
        />
      ) : null}
      <Botao titulo="Salvar manutenção" onPress={aoSalvar} carregando={salvando} />
      <Botao titulo="Cancelar" variante="link" onPress={() => aoFechar(false)} />
      {m ? (
        confirmandoExcluir ? (
          <Botao titulo="Confirmar exclusão" variante="perigo" onPress={() => executar(() => excluirManutencao(m.id))} />
        ) : (
          <Botao titulo="Excluir manutenção" variante="link" onPress={() => setConfirmandoExcluir(true)} />
        )
      ) : null}
    </Pagina>
  );
}
