import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { TelaMotorista, ValorCalculado } from '@/components/motorista/base';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Segmentado } from '@/components/ui/segmentado';
import { useMotorista, type DadosNovaViagem } from '@/context/MotoristaContext';
import { percentualDe } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import { formatarData, formatarDecimal, formatarMoeda, hojeIso, lerData, lerDecimal, mascararData } from '@/utils/formato';

// 5.3 Cadastrar/editar viagem — caminho de quem dirige e também administra (dono-motorista).
// O fluxo principal é o gestor criar a viagem no painel. Com ?id= edita uma viagem própria ainda programada.
export default function NovaViagem() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { perfil, viagens, criarViagem, editarViagem } = useMotorista();
  const editando = id ? viagens.find((v) => v.id === id && v.editavel) : undefined;
  const m = perfil.motorista;
  const comissionado = m?.modelo_remuneracao === 'comissionado';

  const [data, setData] = useState(formatarData(editando?.data_prevista ?? hojeIso()));
  const [veiculoId, setVeiculoId] = useState(editando?.veiculo_id ?? m?.veiculo_vinculado_id ?? null);
  const [cliente, setCliente] = useState(editando?.cliente ?? '');
  const [origem, setOrigem] = useState(editando?.origem ?? '');
  const [destino, setDestino] = useState(editando?.destino ?? '');
  const [carga, setCarga] = useState(editando?.carga ?? '');
  const [km, setKm] = useState('');
  const [frete, setFrete] = useState(editando ? formatarDecimal(editando.valor_frete) : '');
  const [observacoes, setObservacoes] = useState(editando?.observacoes ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const veiculos = perfil.veiculos
    .filter((v) => v.status === 'ativo' || v.id === veiculoId)
    .map((v) => ({ valor: v.id, rotulo: `${v.placa} · ${v.modelo}` }));
  const freteLido = lerDecimal(frete);
  const comissao = comissionado && freteLido && !Number.isNaN(freteLido) ? percentualDe(freteLido, m?.comissao_percentual ?? 0) : null;
  const emAndamento = viagens.some((v) => v.status === 'em_andamento');

  function ler(): DadosNovaViagem | null {
    const dataIso = lerData(data);
    if (!dataIso) return (setErro('Data inválida. Use dia/mês/ano.'), null);
    if (!veiculoId) return (setErro('Escolha o veículo.'), null);
    if (!origem.trim() || !destino.trim()) return (setErro('Informe origem e destino.'), null);
    if (freteLido === null || Number.isNaN(freteLido)) return (setErro('Informe o valor do frete.'), null);
    return {
      veiculo_id: veiculoId,
      origem: origem.trim(),
      destino: destino.trim(),
      valor_frete: freteLido,
      data_prevista: dataIso,
      cliente: cliente.trim() || null,
      carga: carga.trim() || null,
      observacoes: observacoes.trim() || null,
    };
  }

  async function salvar(iniciar: boolean) {
    const dados = ler();
    if (!dados) return;
    const kmLido = lerDecimal(km);
    if (iniciar && (kmLido === null || Number.isNaN(kmLido))) return setErro('Para iniciar agora, informe o km inicial.');
    setErro(null);
    setSalvando(true);
    try {
      if (editando) {
        await editarViagem(editando, dados);
        router.back();
        return;
      }
      const novoId = await criarViagem(dados, iniciar && kmLido !== null ? kmLido : undefined);
      if (iniciar) router.replace({ pathname: '/motorista/viagem/[id]', params: { id: novoId } });
      else router.replace('/motorista');
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <TelaMotorista titulo={editando ? 'Editar viagem' : 'Nova viagem'} aoVoltar={() => router.back()}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo
        rotulo="Data"
        value={data}
        onChangeText={(t) => setData(mascararData(t))}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        maxLength={10}
      />
      <Segmentado
        rotulo="Veículo"
        opcoes={veiculos}
        valor={veiculoId}
        onChange={setVeiculoId}
        ajuda={veiculos.length === 0 ? 'Nenhum veículo disponível. Peça ao gestor para cadastrar.' : undefined}
      />
      <Campo rotulo="Cliente / embarcador (opcional)" value={cliente} onChangeText={setCliente} />
      <Campo rotulo="Origem" value={origem} onChangeText={setOrigem} />
      <Campo rotulo="Destino" value={destino} onChangeText={setDestino} />
      <Campo rotulo="Carga (opcional)" value={carga} onChangeText={setCarga} />
      <Campo rotulo="Valor do frete (R$)" value={frete} onChangeText={setFrete} keyboardType="numeric" inputMode="decimal" />
      {comissionado ? (
        <ValorCalculado
          trancado
          rotulo={`Comissão do motorista (${formatarDecimal(m?.comissao_percentual ?? 0)}%)`}
          valor={comissao === null ? '—' : formatarMoeda(comissao)}
          nota="Definida no cadastro do motorista."
        />
      ) : (
        <Aviso tipo="info">Este motorista recebe salário fixo — sem comissão por viagem.</Aviso>
      )}
      <Aviso tipo="info">O adiantamento, se houver, é definido pelo gestor.</Aviso>
      <Campo rotulo="Observações (opcional)" value={observacoes} onChangeText={setObservacoes} multiline />

      {editando ? (
        <Botao titulo="Salvar alterações" onPress={() => salvar(false)} carregando={salvando} />
      ) : (
        <>
          <Botao titulo="Salvar para depois" variante="contorno" onPress={() => salvar(false)} desativado={salvando} />
          {emAndamento ? (
            <Aviso tipo="info">Você já tem uma viagem em andamento; esta ficará em “Próximas viagens”.</Aviso>
          ) : (
            <>
              <Campo
                rotulo="Km inicial"
                ajuda="Só para iniciar agora: odômetro do veículo na saída."
                value={km}
                onChangeText={setKm}
                keyboardType="numeric"
                inputMode="decimal"
              />
              <Botao titulo="Confirmar e iniciar viagem" onPress={() => salvar(true)} carregando={salvando} />
            </>
          )}
        </>
      )}
    </TelaMotorista>
  );
}
