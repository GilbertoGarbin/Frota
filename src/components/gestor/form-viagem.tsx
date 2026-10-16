import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Seletor } from '@/components/ui/seletor';
import { Cores, Espaco, Raio } from '@/constants/tema';
import type { Motorista } from '@/services/motoristas.service';
import type { Veiculo } from '@/services/veiculos.service';
import { atualizarViagem, criarViagem, sugerirAdiantamento, type Viagem } from '@/services/viagens.service';
import { mensagemDeErro } from '@/utils/erros';
import { formatarData, formatarDecimal, formatarMoeda, hojeIso, lerData, lerDecimal, mascararData, mascararDecimal } from '@/utils/formato';

type Props = {
  /** null = nova viagem; Viagem = editar viagem ainda programada */
  viagem: Viagem | null;
  motoristas: Motorista[];
  veiculos: Veiculo[];
  aoFechar: (salvou: boolean) => void;
};

type Sugestao = { rota: string; valor: number | null; quantidade: number };

// Despacho (spec do gestor 6.3): o gestor cria a viagem e atribui a um motorista.
// O km inicial não é pedido aqui — o motorista informa ao confirmar a saída.
export function FormViagem({ viagem, motoristas, veiculos, aoFechar }: Props) {
  const [motoristaId, setMotoristaId] = useState(viagem?.motorista_id ?? null);
  const [veiculoId, setVeiculoId] = useState(viagem?.veiculo_id ?? null);
  const [cliente, setCliente] = useState(viagem?.cliente ?? '');
  const [origem, setOrigem] = useState(viagem?.origem ?? '');
  const [destino, setDestino] = useState(viagem?.destino ?? '');
  const [carga, setCarga] = useState(viagem?.carga ?? '');
  const [pagamentoFrete, setPagamentoFrete] = useState(viagem?.forma_pagamento_frete ?? '');
  const [data, setData] = useState(formatarData(viagem?.data_prevista ?? hojeIso()));
  const [frete, setFrete] = useState(viagem ? formatarDecimal(viagem.valor_frete) : '');
  const [adiantamento, setAdiantamento] = useState(
    viagem && viagem.valor_adiantamento > 0 ? formatarDecimal(viagem.valor_adiantamento) : '',
  );
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const opcoesMotorista = motoristas
    .filter((m) => m.status === 'ativo' || m.id === viagem?.motorista_id)
    .map((m) => ({ valor: m.id, rotulo: m.nome }));
  const opcoesVeiculo = veiculos
    .filter((v) => v.status === 'ativo' || v.id === viagem?.veiculo_id)
    .map((v) => ({ valor: v.id, rotulo: `${v.placa} · ${v.modelo}` }));

  // Adiantamento sugerido: média das viagens finalizadas na mesma rota (spec 5a)
  const rota = origem.trim() && destino.trim() ? `${origem.trim()}|${destino.trim()}` : null;
  useEffect(() => {
    if (!rota) return;
    let vigente = true;
    const espera = setTimeout(() => {
      const [o, d] = rota.split('|');
      sugerirAdiantamento(o, d).then(
        (s) => {
          if (vigente) setSugestao({ rota, ...s });
        },
        () => {},
      );
    }, 500);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [rota]);
  const sugestaoDaRota = sugestao && sugestao.rota === rota ? sugestao : null;

  function aoEscolherMotorista(id: string) {
    setMotoristaId(id);
    // sugere o veículo vinculado ao motorista; o gestor pode trocar
    const vinculado = motoristas.find((m) => m.id === id)?.veiculo_vinculado_id;
    if (vinculado && opcoesVeiculo.some((o) => o.valor === vinculado)) setVeiculoId(vinculado);
  }

  async function aoSalvar() {
    const dataPrevista = lerData(data);
    const valorFrete = lerDecimal(frete);
    const valorAdiantamento = lerDecimal(adiantamento) ?? 0;
    if (!motoristaId) return setErro('Escolha o motorista.');
    if (!veiculoId) return setErro('Escolha o veículo.');
    if (!dataPrevista) return setErro('Data prevista inválida. Use dia/mês/ano.');
    if (valorFrete === null || Number.isNaN(valorFrete)) return setErro('Informe o valor do frete.');
    if (Number.isNaN(valorAdiantamento)) return setErro('Adiantamento inválido.');

    setErro(null);
    setSalvando(true);
    const dados = {
      motorista_id: motoristaId,
      veiculo_id: veiculoId,
      cliente: cliente.trim() || null,
      origem: origem.trim(),
      destino: destino.trim(),
      carga: carga.trim() || null,
      forma_pagamento_frete: pagamentoFrete.trim() || null,
      data_prevista: dataPrevista,
      valor_frete: valorFrete,
      valor_adiantamento: valorAdiantamento,
    };
    try {
      if (viagem) await atualizarViagem(viagem.id, dados);
      else await criarViagem(dados);
      aoFechar(true);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <Pagina titulo={viagem ? 'Editar viagem' : 'Nova viagem'} estreita>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {opcoesMotorista.length === 0 ? (
        <Aviso tipo="info">Cadastre um motorista ativo em “Motoristas” antes de criar a viagem.</Aviso>
      ) : null}
      <Seletor rotulo="Motorista" opcoes={opcoesMotorista} valor={motoristaId} onChange={aoEscolherMotorista} />
      <Seletor
        rotulo="Veículo"
        opcoes={opcoesVeiculo}
        valor={veiculoId}
        onChange={setVeiculoId}
        ajuda={opcoesVeiculo.length === 0 ? 'Cadastre um veículo ativo em “Veículos”.' : undefined}
      />
      <Campo rotulo="Cliente / embarcador (opcional)" value={cliente} onChangeText={setCliente} />
      <Campo rotulo="Origem" value={origem} onChangeText={setOrigem} placeholder="Ex.: Curitiba" />
      <Campo rotulo="Destino" value={destino} onChangeText={setDestino} placeholder="Ex.: Pato Branco" />
      <Campo rotulo="Carga (opcional)" value={carga} onChangeText={setCarga} />
      <Campo
        rotulo="Data prevista"
        value={data}
        onChangeText={(t) => setData(mascararData(t))}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        maxLength={10}
      />
      <Campo
        rotulo="Valor do frete (R$)"
        value={frete}
        onChangeText={(t) => setFrete(mascararDecimal(t))}
        keyboardType="numeric"
        inputMode="decimal"
        placeholder="Ex.: 2.500,00"
      />
      <Campo
        rotulo="Forma de pagamento do frete (opcional)"
        ajuda="Como o cliente paga. Aparece para o motorista na viagem."
        value={pagamentoFrete}
        onChangeText={setPagamentoFrete}
        placeholder="Ex.: à vista, faturado 30 dias"
      />

      {/* Valor calculado: chip claro, nunca com cara de campo (spec, seção 2) */}
      <View style={styles.sugestao}>
        <Text style={styles.sugestaoRotulo}>Adiantamento sugerido</Text>
        <Text style={styles.sugestaoValor}>
          {!rota
            ? 'Informe origem e destino.'
            : !sugestaoDaRota
              ? 'Calculando…'
              : sugestaoDaRota.valor === null
                ? 'Sem histórico nesta rota — defina o valor manualmente.'
                : `${formatarMoeda(sugestaoDaRota.valor)} (média de ${sugestaoDaRota.quantidade} ${sugestaoDaRota.quantidade === 1 ? 'viagem' : 'viagens'} nesta rota)`}
        </Text>
        {sugestaoDaRota?.valor != null ? (
          <Botao
            titulo="Usar este valor"
            variante="link"
            compacto
            onPress={() => setAdiantamento(formatarDecimal(sugestaoDaRota.valor))}
          />
        ) : null}
      </View>
      <Campo
        rotulo="Adiantamento a definir (R$)"
        ajuda="Valor que a empresa entrega ao motorista antes da viagem. Deixe vazio se não houver."
        value={adiantamento}
        onChangeText={(t) => setAdiantamento(mascararDecimal(t))}
        keyboardType="numeric"
        inputMode="decimal"
      />

      <Botao
        titulo={viagem ? 'Salvar' : 'Salvar e atribuir'}
        onPress={aoSalvar}
        carregando={salvando}
        desativado={!origem.trim() || !destino.trim() || !frete.trim()}
      />
      {viagem ? null : (
        <Text style={styles.nota}>
          A viagem é criada como “programada” e aparece em “Próximas viagens” no app do motorista. O km
          inicial não é pedido aqui — o motorista informa ao confirmar a saída.
        </Text>
      )}
      <Botao titulo="Cancelar" variante="link" onPress={() => aoFechar(false)} />
    </Pagina>
  );
}

const styles = StyleSheet.create({
  sugestao: { gap: 2, padding: Espaco.md, borderRadius: Raio.sm, backgroundColor: Cores.chipClaro },
  sugestaoRotulo: { fontSize: 13, fontWeight: '600', color: Cores.primariaEscura },
  sugestaoValor: { fontSize: 14, color: Cores.primariaEscura },
  nota: { fontSize: 13, lineHeight: 19, color: Cores.textoSuave },
});
