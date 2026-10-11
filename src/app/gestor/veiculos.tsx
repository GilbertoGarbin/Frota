import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { SecaoAbastecimento, SecaoPneus } from '@/components/gestor/veiculo-extras';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Segmentado } from '@/components/ui/segmentado';
import { Selo, type TipoSelo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import {
  listarVeiculos,
  salvarVeiculo,
  STATUS_VEICULO,
  type StatusVeiculo,
  type Veiculo,
} from '@/services/veiculos.service';
import { mensagemDeErro } from '@/utils/erros';
import { formatarDecimal, formatarKm, lerDecimal } from '@/utils/formato';

const SELO_STATUS: Record<StatusVeiculo, { tipo: TipoSelo; rotulo: string }> = {
  ativo: { tipo: 'sucesso', rotulo: 'Ativo' },
  em_manutencao: { tipo: 'aviso', rotulo: 'Em manutenção' },
  inativo: { tipo: 'neutro', rotulo: 'Inativo' },
};

export default function Veiculos() {
  const { dados: veiculos, erro, recarregar } = useCarregar(listarVeiculos);
  // undefined = lista; null = novo veículo; Veiculo = editando
  const [editando, setEditando] = useState<Veiculo | null | undefined>(undefined);

  if (editando !== undefined) {
    return (
      <FormVeiculo
        veiculo={editando}
        aoFechar={(salvou) => {
          setEditando(undefined);
          if (salvou) recarregar();
        }}
      />
    );
  }

  const colunas: Coluna<Veiculo>[] = [
    { titulo: 'Placa', celula: (v) => v.placa },
    { titulo: 'Modelo', flex: 2, celula: (v) => v.modelo },
    { titulo: 'Km atual', celula: (v) => formatarKm(v.km_atual) },
    {
      titulo: 'Consumo médio',
      celula: (v) =>
        v.consumo_medio_km_por_litro ? `${formatarDecimal(v.consumo_medio_km_por_litro)} km/L` : '—',
    },
    {
      titulo: 'Status',
      celula: (v) => {
        const s = SELO_STATUS[v.status as StatusVeiculo];
        return <Selo tipo={s.tipo}>{s.rotulo}</Selo>;
      },
    },
    {
      titulo: 'Ações',
      celula: (v) => <Botao titulo="Editar" variante="contorno" compacto onPress={() => setEditando(v)} />,
    },
  ];

  return (
    <Pagina
      titulo="Veículos & Pneus"
      subtitulo="Caminhões da frota. Abra um veículo para ver pneus e registrar abastecimento."
      acao={<Botao titulo="+ Novo veículo" compacto onPress={() => setEditando(null)} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {veiculos ? (
        <Tabela
          colunas={colunas}
          itens={veiculos}
          chave={(v) => v.id}
          vazio="Nenhum veículo cadastrado ainda."
        />
      ) : erro ? null : (
        <ActivityIndicator color={Cores.primaria} />
      )}
    </Pagina>
  );
}

function FormVeiculo({ veiculo, aoFechar }: { veiculo: Veiculo | null; aoFechar: (salvou: boolean) => void }) {
  const [placa, setPlaca] = useState(veiculo?.placa ?? '');
  const [modelo, setModelo] = useState(veiculo?.modelo ?? '');
  const [km, setKm] = useState(veiculo ? formatarDecimal(veiculo.km_atual, 0) : '');
  const [status, setStatus] = useState<StatusVeiculo>((veiculo?.status as StatusVeiculo) ?? 'ativo');
  const [consumo, setConsumo] = useState(formatarDecimal(veiculo?.consumo_medio_informado));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // um abastecimento registrado aqui muda o consumo do veículo: a lista precisa recarregar ao voltar
  const [mudou, setMudou] = useState(false);

  async function aoSalvar() {
    const kmAtual = lerDecimal(km) ?? 0;
    const consumoInformado = lerDecimal(consumo);
    if (Number.isNaN(kmAtual)) return setErro('Km atual inválido.');
    if (Number.isNaN(consumoInformado) || consumoInformado === 0) {
      return setErro('Consumo médio inválido. Exemplo: 2,5');
    }
    setErro(null);
    setSalvando(true);
    try {
      await salvarVeiculo(veiculo?.id ?? null, {
        placa: placa.trim().toUpperCase(),
        modelo: modelo.trim(),
        km_atual: kmAtual,
        status,
        consumo_medio_informado: consumoInformado,
      });
      aoFechar(true);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <Pagina titulo={veiculo ? `Editar ${veiculo.placa}` : 'Novo veículo'} estreita>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo
        rotulo="Placa"
        value={placa}
        onChangeText={(t) => setPlaca(t.toUpperCase())}
        autoCapitalize="characters"
        maxLength={8}
      />
      <Campo rotulo="Modelo" value={modelo} onChangeText={setModelo} placeholder="Ex.: Scania R450" />
      <Campo
        rotulo="Km atual"
        ajuda="Depois é atualizado sozinho a cada viagem finalizada."
        value={km}
        onChangeText={setKm}
        keyboardType="numeric"
        inputMode="decimal"
      />
      <Segmentado rotulo="Status" opcoes={STATUS_VEICULO} valor={status} onChange={setStatus} />
      <Campo
        rotulo="Consumo médio estimado (km/L)"
        ajuda={
          veiculo?.consumo_medio_km_por_litro
            ? `Em uso hoje: ${formatarDecimal(veiculo.consumo_medio_km_por_litro)} km/L. O sistema recalcula a cada abastecimento com tanque cheio.`
            : 'Valor inicial. O sistema passa a calcular sozinho a partir dos abastecimentos com tanque cheio.'
        }
        value={consumo}
        onChangeText={setConsumo}
        keyboardType="numeric"
        inputMode="decimal"
        placeholder="Ex.: 2,5"
      />
      <Botao
        titulo="Salvar"
        onPress={aoSalvar}
        carregando={salvando}
        desativado={!placa.trim() || !modelo.trim()}
      />
      <Botao titulo="Voltar" variante="link" onPress={() => aoFechar(mudou)} />
      {veiculo ? (
        <>
          <SecaoPneus veiculoId={veiculo.id} />
          <SecaoAbastecimento veiculo={veiculo} aoRegistrar={() => setMudou(true)} />
        </>
      ) : null}
    </Pagina>
  );
}
