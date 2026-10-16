import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Secao } from '@/components/ui/cartao';
import { Segmentado } from '@/components/ui/segmentado';
import { Cores, Espaco } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import {
  excluirPneu,
  listarPneus,
  salvarPneu,
  type EstadoPneu,
  type LadoPneu,
  type Pneu,
  type PosicaoPneu,
} from '@/services/gestao.service';
import type { Veiculo } from '@/services/veiculos.service';
import { registrarAbastecimentoAvulso } from '@/services/viagens.service';
import { totalAbastecimento } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import { formatarData, formatarDecimal, formatarMoeda, hojeIso, lerData, lerDecimal, mascararData, mascararDecimal } from '@/utils/formato';

const ESTADOS: { valor: EstadoPneu; rotulo: string }[] = [
  { valor: 'bom', rotulo: 'Bom' },
  { valor: 'atencao', rotulo: 'Atenção' },
  { valor: 'troca', rotulo: 'Troca urgente' },
];
const LADOS: { valor: LadoPneu; rotulo: string }[] = [
  { valor: 'esquerdo', rotulo: 'Esquerdo' },
  { valor: 'direito', rotulo: 'Direito' },
];
const POSICOES: { valor: PosicaoPneu; rotulo: string }[] = [
  { valor: 'unico', rotulo: 'Rodado simples' },
  { valor: 'externo', rotulo: 'Duplo — externo' },
  { valor: 'interno', rotulo: 'Duplo — interno' },
];

const nomeDoPneu = (p: Pneu) =>
  `Eixo ${p.eixo} · ${p.lado === 'esquerdo' ? 'Esquerdo' : 'Direito'}${p.posicao === 'unico' ? '' : p.posicao === 'externo' ? ' externo' : ' interno'}`;

/**
 * Pneus do veículo: posição e estado. Versão em lista — a spec (6.2) deixa o mapa visual de
 * eixos para depois da validação em campo. Estados "atenção" e "troca" viram alerta na Visão Geral.
 */
export function SecaoPneus({ veiculoId }: { veiculoId: string }) {
  const buscar = useCallback(() => listarPneus(veiculoId), [veiculoId]);
  const { dados: pneus, erro, recarregar } = useCarregar(buscar);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [eixo, setEixo] = useState('1');
  const [lado, setLado] = useState<LadoPneu>('esquerdo');
  const [posicao, setPosicao] = useState<PosicaoPneu>('unico');
  const [marca, setMarca] = useState('');

  async function executar(acao: () => Promise<void>) {
    setErroAcao(null);
    try {
      await acao();
      recarregar();
    } catch (e) {
      const mensagem = mensagemDeErro(e);
      setErroAcao(/pneus_veiculo_id_eixo/.test(mensagem) ? 'Já existe um pneu cadastrado nesta posição.' : mensagem);
    }
  }

  function adicionar() {
    const numeroEixo = Number(eixo);
    if (!Number.isInteger(numeroEixo) || numeroEixo < 1 || numeroEixo > 9) return setErroAcao('Eixo deve ser um número de 1 a 9.');
    executar(async () => {
      await salvarPneu(null, {
        veiculo_id: veiculoId,
        eixo: numeroEixo,
        lado,
        posicao,
        estado: 'bom',
        marca: marca.trim() || null,
      });
      setAdicionando(false);
      setMarca('');
    });
  }

  return (
    <Secao
      titulo="Pneus"
      acao={
        adicionando ? undefined : (
          <Botao titulo="+ Adicionar pneu" variante="contorno" compacto onPress={() => setAdicionando(true)} />
        )
      }>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {erroAcao ? <Aviso tipo="erro">{erroAcao}</Aviso> : null}

      {adicionando ? (
        <View style={styles.formulario}>
          <Campo rotulo="Eixo (1 = dianteiro)" value={eixo} onChangeText={setEixo} keyboardType="number-pad" inputMode="numeric" maxLength={1} />
          <Segmentado rotulo="Lado" opcoes={LADOS} valor={lado} onChange={setLado} />
          <Segmentado rotulo="Posição" opcoes={POSICOES} valor={posicao} onChange={setPosicao} />
          <Campo rotulo="Marca / modelo (opcional)" value={marca} onChangeText={setMarca} />
          <View style={styles.linha}>
            <Botao titulo="Adicionar" compacto onPress={adicionar} />
            <Botao titulo="Cancelar" variante="link" compacto onPress={() => setAdicionando(false)} />
          </View>
        </View>
      ) : null}

      {pneus?.length === 0 ? <Text style={styles.suave}>Nenhum pneu cadastrado para este veículo.</Text> : null}
      {pneus?.map((p) => (
        <View key={p.id} style={styles.item}>
          <View style={styles.pneuEstado}>
            <Segmentado
              rotulo={`${nomeDoPneu(p)}${p.marca ? ` — ${p.marca}` : ''}`}
              opcoes={ESTADOS}
              valor={p.estado as EstadoPneu}
              onChange={(estado) =>
                executar(() =>
                  salvarPneu(p.id, {
                    veiculo_id: p.veiculo_id,
                    eixo: p.eixo,
                    lado: p.lado,
                    posicao: p.posicao,
                    estado,
                    marca: p.marca,
                  }),
                )
              }
            />
          </View>
          <Botao titulo="Remover" variante="link" compacto onPress={() => executar(() => excluirPneu(p.id))} />
        </View>
      ))}
    </Secao>
  );
}

/**
 * Abastecimento lançado pelo gestor, fora de viagem. Serve principalmente para registrar o
 * primeiro "tanque cheio" do veículo, que é o ponto de partida da apuração de combustível.
 */
export function SecaoAbastecimento({ veiculo, aoRegistrar }: { veiculo: Veiculo; aoRegistrar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [km, setKm] = useState(formatarDecimal(veiculo.km_atual, 0));
  const [litros, setLitros] = useState('');
  const [preco, setPreco] = useState('');
  const [data, setData] = useState(formatarData(hojeIso()));
  const [posto, setPosto] = useState('');
  const [cheio, setCheio] = useState<'sim' | 'nao'>('sim');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const litrosLidos = lerDecimal(litros);
  const precoLido = lerDecimal(preco);
  const total = litrosLidos && precoLido ? totalAbastecimento(litrosLidos, precoLido) : null;

  async function registrar() {
    const kmLido = lerDecimal(km);
    const dataIso = lerData(data);
    if (kmLido === null || Number.isNaN(kmLido)) return setErro('Informe o km do odômetro.');
    if (!litrosLidos || Number.isNaN(litrosLidos)) return setErro('Informe os litros.');
    if (!precoLido || Number.isNaN(precoLido)) return setErro('Informe o preço por litro.');
    if (!dataIso) return setErro('Data inválida. Use dia/mês/ano.');
    setErro(null);
    setSalvando(true);
    try {
      await registrarAbastecimentoAvulso({
        veiculo_id: veiculo.id,
        km: kmLido,
        litros: litrosLidos,
        preco_litro: precoLido,
        tanque_cheio: cheio === 'sim',
        data: dataIso,
        posto: posto.trim() || null,
        combustivel: 'diesel_s10',
      });
      setSucesso(true);
      setAberto(false);
      setLitros('');
      aoRegistrar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
    setSalvando(false);
  }

  return (
    <Secao
      titulo="Abastecimento fora de viagem"
      acao={
        aberto ? undefined : (
          <Botao titulo="Registrar abastecimento" variante="contorno" compacto onPress={() => setAberto(true)} />
        )
      }>
      <Text style={styles.suave}>
        Normalmente o abastecimento vem do app do motorista. Use aqui para registrar o primeiro tanque cheio
        do veículo: é a partir dele que o sistema apura o combustível real de cada viagem.
      </Text>
      {sucesso ? <Aviso tipo="sucesso">Abastecimento registrado. As viagens do veículo foram recalculadas.</Aviso> : null}
      {aberto ? (
        <View style={styles.formulario}>
          {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
          <Campo rotulo="Km do odômetro" value={km} onChangeText={setKm} keyboardType="numeric" inputMode="decimal" />
          <Campo rotulo="Litros" value={litros} onChangeText={setLitros} keyboardType="numeric" inputMode="decimal" />
          <Campo rotulo="Preço por litro (R$)" value={preco} onChangeText={(t) => setPreco(mascararDecimal(t, 3))} keyboardType="numeric" inputMode="decimal" placeholder="Ex.: 5,899" />
          <View style={styles.total}>
            <Text style={styles.totalRotulo}>Total</Text>
            <Text style={styles.totalValor}>{total === null ? '—' : formatarMoeda(total)}</Text>
          </View>
          <Campo
            rotulo="Data"
            value={data}
            onChangeText={(t) => setData(mascararData(t))}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={10}
          />
          <Campo rotulo="Posto (opcional)" value={posto} onChangeText={setPosto} />
          <Segmentado
            rotulo="Tanque cheio?"
            opcoes={[
              { valor: 'sim', rotulo: 'Sim' },
              { valor: 'nao', rotulo: 'Não' },
            ]}
            valor={cheio}
            onChange={setCheio}
          />
          <View style={styles.linha}>
            <Botao titulo="Registrar" compacto onPress={registrar} carregando={salvando} />
            <Botao titulo="Cancelar" variante="link" compacto onPress={() => setAberto(false)} />
          </View>
        </View>
      ) : null}
    </Secao>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  suave: { fontSize: 13, lineHeight: 19, color: Cores.textoSuave },
  formulario: { gap: Espaco.md },
  item: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: Espaco.md,
    paddingTop: Espaco.md,
    borderTopWidth: 1,
    borderTopColor: Cores.borda,
  },
  pneuEstado: { flex: 1, minWidth: 260 },
  // valor calculado: bloco de "resultado", nunca com cara de campo (spec, seção 2)
  total: { gap: 2, padding: Espaco.md, borderRadius: 8, backgroundColor: Cores.chipClaro },
  totalRotulo: { fontSize: 13, fontWeight: '600', color: Cores.primariaEscura },
  totalValor: { fontSize: 20, fontWeight: '700', color: Cores.primariaEscura },
});
