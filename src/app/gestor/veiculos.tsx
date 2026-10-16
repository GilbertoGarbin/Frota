import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { SecaoAbastecimento, SecaoPneus } from '@/components/gestor/veiculo-extras';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { LinhaForm } from '@/components/ui/linha-form';
import { Mensagem, type ConteudoMensagem } from '@/components/ui/mensagem';
import { Segmentado } from '@/components/ui/segmentado';
import { Selo, type TipoSelo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores, Espaco } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import {
  listarVeiculos,
  salvarVeiculo,
  STATUS_VEICULO,
  type StatusVeiculo,
  type Veiculo,
} from '@/services/veiculos.service';
import { mensagemDeErro } from '@/utils/erros';
import { formatarDecimal, formatarKm, lerDecimal, mascararDecimal, mascararInteiro, placaValida } from '@/utils/formato';

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
  const [km, setKm] = useState(veiculo ? mascararInteiro(String(Math.round(veiculo.km_atual))) : '');
  const [status, setStatus] = useState<StatusVeiculo>((veiculo?.status as StatusVeiculo) ?? 'ativo');
  const [consumo, setConsumo] = useState(formatarDecimal(veiculo?.consumo_medio_informado));
  const [mensagem, setMensagem] = useState<ConteudoMensagem | null>(null);
  const [salvando, setSalvando] = useState(false);
  // um abastecimento registrado aqui muda o consumo do veículo: a lista precisa recarregar ao voltar
  const [mudou, setMudou] = useState(false);

  async function aoSalvar() {
    const faltando = [!placa.trim() && 'Placa', !modelo.trim() && 'Modelo'].filter((item): item is string => !!item);
    if (faltando.length > 0) return setMensagem({ titulo: 'Preencha os campos obrigatórios', itens: faltando });
    const invalido = (texto: string) => setMensagem({ titulo: 'Confira o cadastro', texto });
    if (!placaValida(placa)) return invalido('Placa inválida. Use o padrão ABC1234 ou o Mercosul ABC1D23.');
    const kmAtual = lerDecimal(km) ?? 0;
    const consumoInformado = lerDecimal(consumo);
    if (Number.isNaN(kmAtual)) return invalido('Km atual inválido.');
    if (Number.isNaN(consumoInformado) || consumoInformado === 0) {
      return invalido('Consumo médio inválido. Exemplo: 2,50');
    }
    setSalvando(true);
    try {
      await salvarVeiculo(veiculo?.id ?? null, {
        placa: placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
        modelo: modelo.trim(),
        km_atual: kmAtual,
        status,
        consumo_medio_informado: consumoInformado,
      });
      aoFechar(true);
    } catch (e) {
      setMensagem({ titulo: 'Não foi possível salvar', texto: mensagemDeErro(e) });
      setSalvando(false);
    }
  }

  return (
    <Pagina
      titulo={veiculo ? `Editar ${veiculo.placa}` : 'Novo veículo'}
      subtitulo="Campos com * são obrigatórios."
      media>
      <Mensagem mensagem={mensagem} aoFechar={() => setMensagem(null)} />
      <LinhaForm minimo={220}>
        <Campo
          rotulo="Placa *"
          value={placa}
          onChangeText={(t) => setPlaca(t.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          placeholder="ABC1D23"
        />
        <Campo rotulo="Modelo *" value={modelo} onChangeText={setModelo} placeholder="Ex.: Scania R450" />
      </LinhaForm>
      <LinhaForm minimo={220}>
        <Campo
          rotulo="Km atual"
          ajuda="Depois é atualizado sozinho a cada viagem finalizada."
          value={km}
          onChangeText={(t) => setKm(mascararInteiro(t))}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="Ex.: 350.000"
        />
        <Campo
          rotulo="Consumo médio estimado (km/L)"
          ajuda={
            veiculo?.consumo_medio_km_por_litro
              ? `Em uso hoje: ${formatarDecimal(veiculo.consumo_medio_km_por_litro)} km/L. O sistema recalcula a cada abastecimento com tanque cheio.`
              : 'Valor inicial. O sistema passa a calcular sozinho a partir dos abastecimentos com tanque cheio.'
          }
          value={consumo}
          onChangeText={(t) => setConsumo(mascararDecimal(t))}
          keyboardType="numeric"
          inputMode="decimal"
          placeholder="Ex.: 2,50"
        />
      </LinhaForm>
      <Segmentado rotulo="Status" opcoes={STATUS_VEICULO} valor={status} onChange={setStatus} />
      <View style={styles.botoes}>
        <Botao titulo="Salvar" onPress={aoSalvar} carregando={salvando} />
        <Botao titulo="Voltar" variante="link" onPress={() => aoFechar(mudou)} />
      </View>
      {veiculo ? (
        <>
          <SecaoPneus veiculoId={veiculo.id} />
          <SecaoAbastecimento veiculo={veiculo} aoRegistrar={() => setMudou(true)} />
        </>
      ) : null}
    </Pagina>
  );
}

const styles = StyleSheet.create({
  botoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
});
