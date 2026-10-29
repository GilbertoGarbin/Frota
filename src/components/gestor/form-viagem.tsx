import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FormFormaRecebimento } from '@/components/gestor/forma-recebimento';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { BotaoIcone } from '@/components/ui/botao-icone';
import { Campo } from '@/components/ui/campo';
import { Janela } from '@/components/ui/janela';
import { CampoData } from '@/components/ui/campo-data';
import { LinhaForm } from '@/components/ui/linha-form';
import { Mensagem, type ConteudoMensagem } from '@/components/ui/mensagem';
import { Segmentado } from '@/components/ui/segmentado';
import { Seletor } from '@/components/ui/seletor';
import { Cores, Espaco, Raio } from '@/constants/tema';
import type { Cliente } from '@/services/clientes.service';
import { carregarConfiguracoes } from '@/services/configuracoes.service';
import {
  descreverParcelas,
  listarFormasRecebimento,
  type FormaRecebimento,
} from '@/services/formas-recebimento.service';
import type { Motorista } from '@/services/motoristas.service';
import type { Veiculo } from '@/services/veiculos.service';
import { atualizarViagem, criarViagem, sugerirAdiantamento, type Viagem } from '@/services/viagens.service';
import { mensagemDeErro } from '@/utils/erros';
import { formatarData, formatarDecimal, formatarMoeda, hojeIso, lerData, lerDecimal, mascararDecimal } from '@/utils/formato';

type Props = {
  /** null = nova viagem; Viagem = editar (depois de iniciada, motorista e veículo ficam travados) */
  viagem: Viagem | null;
  motoristas: Motorista[];
  veiculos: Veiculo[];
  clientes: Cliente[];
  formas: FormaRecebimento[];
  aoFechar: (salvou: boolean) => void;
};

const AVULSO = 'avulso';
const SEM_FORMA = 'nenhuma';
const TEXTO_ANTIGO = 'texto-antigo';

const SIM_NAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
] as const;

type Sugestao = { rota: string; valor: number | null; quantidade: number };

// Despacho (spec do gestor 6.3): o gestor cria a viagem e atribui a um motorista.
// O km inicial não é pedido aqui — o motorista informa ao confirmar a saída.
export function FormViagem({ viagem, motoristas, veiculos, clientes, formas, aoFechar }: Props) {
  const [motoristaId, setMotoristaId] = useState(viagem?.motorista_id ?? null);
  const [veiculoId, setVeiculoId] = useState(viagem?.veiculo_id ?? null);
  // cliente cadastrado (id) ou avulso: só o nome digitado (ex.: uma mudança)
  const [clienteId, setClienteId] = useState<string>(viagem?.cliente_id ?? AVULSO);
  const [cliente, setCliente] = useState(viagem && !viagem.cliente_id ? (viagem.cliente ?? '') : '');
  const [origem, setOrigem] = useState(viagem?.origem ?? '');
  const [destino, setDestino] = useState(viagem?.destino ?? '');
  const [carga, setCarga] = useState(viagem?.carga ?? '');
  // viagem nova vem com o padrão da transportadora (Configurações); dá para trocar só nesta viagem
  const [exigeCanhoto, setExigeCanhoto] = useState<boolean | null>(viagem?.exige_canhoto ?? null);
  // forma de recebimento: da lista; viagem antiga só com texto livre mantém o texto
  const textoAntigo = viagem && !viagem.forma_recebimento_id ? (viagem.forma_pagamento_frete ?? '') : '';
  const [formaId, setFormaId] = useState<string>(viagem?.forma_recebimento_id ?? (textoAntigo ? TEXTO_ANTIGO : SEM_FORMA));
  const [formasCriadas, setFormasCriadas] = useState<FormaRecebimento[]>([]);
  const [criandoForma, setCriandoForma] = useState(false);
  const [data, setData] = useState(formatarData(viagem?.data_prevista ?? hojeIso()));
  const [frete, setFrete] = useState(viagem ? formatarDecimal(viagem.valor_frete) : '');
  const [adiantamento, setAdiantamento] = useState(
    viagem && viagem.valor_adiantamento > 0 ? formatarDecimal(viagem.valor_adiantamento) : '',
  );
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);
  const [mensagem, setMensagem] = useState<ConteudoMensagem | null>(null);
  const iniciada = viagem !== null && viagem.status !== 'programada';
  const [salvando, setSalvando] = useState(false);

  const opcoesMotorista = motoristas
    .filter((m) => m.status === 'ativo' || m.id === viagem?.motorista_id)
    .map((m) => ({ valor: m.id, rotulo: m.nome }));
  const todasFormas = [...formas, ...formasCriadas.filter((n) => !formas.some((f) => f.id === n.id))];
  const opcoesForma = [
    { valor: SEM_FORMA, rotulo: 'Não definida' },
    ...(textoAntigo ? [{ valor: TEXTO_ANTIGO, rotulo: `${textoAntigo} (texto antigo)` }] : []),
    ...todasFormas.filter((f) => f.ativo || f.id === viagem?.forma_recebimento_id).map((f) => ({ valor: f.id, rotulo: f.nome })),
  ];
  const formaEscolhida = todasFormas.find((f) => f.id === formaId);

  // escolher o cliente traz a forma de recebimento dele (dá para trocar só nesta viagem)
  function aoEscolherCliente(id: string) {
    setClienteId(id);
    const daCliente = clientes.find((c) => c.id === id)?.forma_recebimento_id;
    if (daCliente) setFormaId(daCliente);
  }

  const opcoesCliente = [
    { valor: AVULSO, rotulo: 'Sem cadastro (digitar o nome)' },
    ...clientes
      .filter((c) => c.ativo || c.id === viagem?.cliente_id)
      .map((c) => ({ valor: c.id, rotulo: c.cidade ? `${c.nome} · ${c.cidade}` : c.nome })),
  ];
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
  useEffect(() => {
    if (viagem) return;
    let vigente = true;
    carregarConfiguracoes().then(
      (c) => {
        if (vigente) setExigeCanhoto((atual) => atual ?? c.exigeCanhoto);
      },
      () => {},
    );
    return () => {
      vigente = false;
    };
  }, [viagem]);

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
    const faltando = [
      !motoristaId && 'Motorista',
      !veiculoId && 'Veículo',
      !origem.trim() && 'Origem',
      !destino.trim() && 'Destino',
      !data.trim() && 'Data prevista',
      !frete.trim() && 'Valor do frete',
    ].filter((item): item is string => !!item);
    if (faltando.length > 0) return setMensagem({ titulo: 'Preencha os campos obrigatórios', itens: faltando });
    const invalido = (texto: string) => setMensagem({ titulo: 'Confira a viagem', texto });
    if (!dataPrevista) return invalido('Data prevista inválida. Use dia/mês/ano.');
    if (valorFrete === null || Number.isNaN(valorFrete)) return invalido('Valor do frete inválido.');
    if (Number.isNaN(valorAdiantamento)) return invalido('Adiantamento inválido.');
    if (!motoristaId || !veiculoId) return;

    setSalvando(true);
    const dados = {
      motorista_id: motoristaId,
      veiculo_id: veiculoId,
      cliente_id: clienteId === AVULSO ? null : clienteId,
      cliente: clienteId === AVULSO ? cliente.trim() || null : null,
      origem: origem.trim(),
      destino: destino.trim(),
      carga: carga.trim() || null,
      forma_recebimento_id: formaId === SEM_FORMA || formaId === TEXTO_ANTIGO ? null : formaId,
      forma_pagamento_frete: formaId === TEXTO_ANTIGO ? textoAntigo : null,
      data_prevista: dataPrevista,
      valor_frete: valorFrete,
      valor_adiantamento: valorAdiantamento,
      exige_canhoto: exigeCanhoto ?? true,
    };
    try {
      if (viagem) await atualizarViagem(viagem.id, dados);
      else await criarViagem(dados);
      aoFechar(true);
    } catch (e) {
      setMensagem({ titulo: 'Não foi possível salvar', texto: mensagemDeErro(e) });
      setSalvando(false);
    }
  }

  return (
    <Janela visivel titulo={viagem ? 'Editar viagem' : 'Nova viagem'} aoFechar={() => aoFechar(false)}>
      <Mensagem mensagem={mensagem} aoFechar={() => setMensagem(null)} />
      {opcoesMotorista.length === 0 ? (
        <Aviso tipo="info">Cadastre um motorista ativo em “Motoristas” antes de criar a viagem.</Aviso>
      ) : null}

      <Bloco>
        <LinhaForm minimo={260}>
          {iniciada ? (
            <Campo
              rotulo="Motorista"
              value={opcoesMotorista.find((o) => o.valor === motoristaId)?.rotulo ?? '—'}
              editable={false}
            />
          ) : (
            <Seletor rotulo="Motorista *" opcoes={opcoesMotorista} valor={motoristaId} onChange={aoEscolherMotorista} />
          )}
          {iniciada ? (
            <Campo rotulo="Veículo" value={opcoesVeiculo.find((o) => o.valor === veiculoId)?.rotulo ?? '—'} editable={false} />
          ) : (
            <Seletor
              rotulo="Veículo *"
              opcoes={opcoesVeiculo}
              valor={veiculoId}
              onChange={setVeiculoId}
              ajuda={opcoesVeiculo.length === 0 ? 'Cadastre um veículo ativo em “Veículos”.' : undefined}
            />
          )}
        </LinhaForm>
        {/* depois de iniciada a viagem está no app do motorista e o combustível sai do km do caminhão */}
        {iniciada ? <Text style={styles.notaPequena}>Motorista e veículo não mudam depois que a viagem começou.</Text> : null}
      </Bloco>

      <Bloco titulo="Rota e carga">
        <LinhaForm minimo={220}>
          <Seletor rotulo="Cliente" opcoes={opcoesCliente} valor={clienteId} onChange={aoEscolherCliente} />
          <CampoData rotulo="Data prevista *" valor={data} onChange={setData} />
        </LinhaForm>
        {clienteId === AVULSO ? (
          <Campo rotulo="Nome do cliente (opcional)" value={cliente} onChangeText={setCliente} placeholder="Ex.: mudança do Gilberto" />
        ) : null}
        <LinhaForm minimo={220}>
          <Campo rotulo="Origem *" value={origem} onChangeText={setOrigem} placeholder="Ex.: Curitiba" />
          <Campo rotulo="Destino *" value={destino} onChangeText={setDestino} placeholder="Ex.: Pato Branco" />
        </LinhaForm>
        <LinhaForm minimo={220}>
          <Campo rotulo="Carga (opcional)" value={carga} onChangeText={setCarga} placeholder="Ex.: soja a granel" />
          <Segmentado
            rotulo="Exige canhoto para finalizar"
            opcoes={SIM_NAO}
            valor={exigeCanhoto === null ? null : exigeCanhoto ? 'sim' : 'nao'}
            onChange={(v) => setExigeCanhoto(v === 'sim')}
            ajuda="Vem do padrão em Configurações; troque só se esta viagem for diferente."
          />
        </LinhaForm>
      </Bloco>

      <Bloco titulo="Valores">
        <LinhaForm minimo={260}>
          <Campo
            rotulo="Valor do frete (R$) *"
            value={frete}
            onChangeText={(t) => setFrete(mascararDecimal(t))}
            keyboardType="numeric"
            inputMode="decimal"
            placeholder="Ex.: 2.500,00"
          />
          <View style={styles.formaLinha}>
            <View style={styles.formaCampo}>
              <Seletor
                rotulo="Forma de recebimento"
                opcoes={opcoesForma}
                valor={formaId}
                onChange={setFormaId}
                ajuda={formaEscolhida ? descreverParcelas(formaEscolhida.parcelas) : undefined}
              />
            </View>
            <View style={styles.formaMais}>
              <BotaoIcone icone="plus" rotulo="Cadastrar forma de recebimento" onPress={() => setCriandoForma(true)} />
            </View>
          </View>
        </LinhaForm>
        <LinhaForm minimo={260}>
          <View>
            {/* a sugestão (média da rota) fica dentro do campo e some quando a pessoa digita */}
            <Campo
              rotulo="Adiantamento ao motorista (R$)"
              value={adiantamento}
              onChangeText={(t) => setAdiantamento(mascararDecimal(t))}
              keyboardType="numeric"
              inputMode="decimal"
              placeholder={placeholderAdiantamento(rota, sugestaoDaRota)}
            />
            {sugestaoDaRota?.valor != null && !adiantamento ? (
              <View style={styles.adiantamento}>
                <Botao
                  titulo="Usar o sugerido"
                  variante="link"
                  compacto
                  onPress={() => setAdiantamento(formatarDecimal(sugestaoDaRota.valor))}
                />
              </View>
            ) : null}
          </View>
          <View />
        </LinhaForm>
      </Bloco>

      <View style={styles.botoes}>
        <Botao titulo={viagem ? 'Salvar' : 'Salvar e atribuir'} onPress={aoSalvar} carregando={salvando} />
        <Botao titulo="Cancelar" variante="link" onPress={() => aoFechar(false)} />
      </View>
      {viagem ? null : (
        <Text style={styles.nota}>
          A viagem é criada como “programada” e aparece em “Próximas viagens” no app do motorista. O km
          inicial não é pedido aqui — o motorista informa ao confirmar a saída.
        </Text>
      )}
      {criandoForma ? (
        <FormFormaRecebimento
          forma={null}
          aoFechar={async (id) => {
            setCriandoForma(false);
            if (!id) return;
            setFormaId(id);
            setFormasCriadas(await listarFormasRecebimento().catch(() => []));
          }}
        />
      ) : null}
    </Janela>
  );
}

/** Texto cinza dentro do campo de adiantamento: a média da rota, quando houver; senão, o que é o campo. */
function placeholderAdiantamento(rota: string | null, sugestao: Sugestao | null): string {
  const explicacao = 'Adiantamento ao motorista nesta viagem';
  if (!rota || !sugestao || sugestao.valor === null) return explicacao;
  const viagens = `${sugestao.quantidade} ${sugestao.quantidade === 1 ? 'viagem' : 'viagens'}`;
  return `Sugerido: ${formatarMoeda(sugestao.valor)} (média de ${viagens})`;
}

/** Grupo de campos com um título pequeno, para a tela não virar uma lista comprida de campos. */
function Bloco({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <View style={styles.bloco}>
      {titulo ? <Text style={styles.blocoTitulo}>{titulo}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: Espaco.sm,
    padding: Espaco.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  blocoTitulo: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: Cores.textoSuave },
  formaLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaco.sm },
  formaCampo: { flex: 1, minWidth: 0 },
  formaMais: { paddingTop: 22 },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  adiantamento: { alignItems: 'flex-start' },
  notaPequena: { fontSize: 11, lineHeight: 14, marginTop: -4, color: Cores.textoSuave },
  nota: { fontSize: 13, lineHeight: 19, color: Cores.textoSuave },
});
