import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { CampoData } from '@/components/ui/campo-data';
import { Secao } from '@/components/ui/cartao';
import { LinhaForm } from '@/components/ui/linha-form';
import { Mensagem, type ConteudoMensagem } from '@/components/ui/mensagem';
import { Segmentado } from '@/components/ui/segmentado';
import { Seletor } from '@/components/ui/seletor';
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
import {
  formatarData,
  formatarMoeda,
  hojeIso,
  lerData,
  lerDecimal,
  mascararDecimal,
  mascararInteiro,
} from '@/utils/formato';

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

const EIXOS = Array.from({ length: 9 }, (_, i) => ({
  valor: String(i + 1),
  rotulo: i === 0 ? 'Eixo 1 (dianteiro)' : `Eixo ${i + 1}`,
}));

const nomeDoPneu = (p: Pneu) =>
  `Eixo ${p.eixo} · ${p.lado === 'esquerdo' ? 'Esquerdo' : 'Direito'}${p.posicao === 'unico' ? '' : p.posicao === 'externo' ? ' externo' : ' interno'}`;

/**
 * Pneus do veículo: posição e estado. Versão em lista — a spec (6.2) deixa o mapa visual de
 * eixos para depois da validação em campo. Estados "atenção" e "troca" viram alerta na Visão Geral.
 */
export function SecaoPneus({ veiculoId }: { veiculoId: string }) {
  const buscar = useCallback(() => listarPneus(veiculoId), [veiculoId]);
  const { dados: pneus, erro, recarregar } = useCarregar(buscar);
  const [mensagem, setMensagem] = useState<ConteudoMensagem | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [eixo, setEixo] = useState('1');
  const [lado, setLado] = useState<LadoPneu>('esquerdo');
  const [posicao, setPosicao] = useState<PosicaoPneu>('unico');
  const [marca, setMarca] = useState('');

  async function executar(acao: () => Promise<void>) {
    try {
      await acao();
      recarregar();
    } catch (e) {
      const texto = mensagemDeErro(e);
      setMensagem({
        titulo: 'Não foi possível salvar o pneu',
        texto: /pneus_veiculo_id_eixo/.test(texto) ? 'Já existe um pneu cadastrado nesta posição.' : texto,
      });
    }
  }

  function adicionar() {
    executar(async () => {
      await salvarPneu(null, {
        veiculo_id: veiculoId,
        eixo: Number(eixo),
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
      <Mensagem mensagem={mensagem} aoFechar={() => setMensagem(null)} />
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      {adicionando ? (
        <View style={styles.formulario}>
          <LinhaForm minimo={200}>
            <Seletor rotulo="Eixo" opcoes={EIXOS} valor={eixo} onChange={setEixo} />
            <Segmentado rotulo="Lado" opcoes={LADOS} valor={lado} onChange={setLado} />
          </LinhaForm>
          <LinhaForm minimo={200}>
            <Segmentado rotulo="Posição" opcoes={POSICOES} valor={posicao} onChange={setPosicao} />
            <Campo rotulo="Marca / modelo (opcional)" value={marca} onChangeText={setMarca} />
          </LinhaForm>
          <View style={styles.linha}>
            <Botao titulo="Adicionar" compacto onPress={adicionar} />
            <Botao titulo="Cancelar" variante="link" compacto onPress={() => setAdicionando(false)} />
          </View>
        </View>
      ) : null}

      {pneus?.length === 0 ? <Text style={styles.suave}>Nenhum pneu cadastrado para este veículo.</Text> : null}
      {pneus?.map((p) => (
        <View key={p.id} style={styles.item}>
          <View style={styles.pneuNome}>
            <Text style={styles.pneuTitulo}>{nomeDoPneu(p)}</Text>
            {p.marca ? <Text style={styles.suave}>{p.marca}</Text> : null}
          </View>
          <View style={styles.pneuEstado}>
            <Segmentado
              rotulo="Estado"
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
          {removendo === p.id ? (
            <View style={styles.linha}>
              <Text style={styles.texto}>Remover este pneu?</Text>
              <Botao
                titulo="Remover"
                variante="perigo"
                compacto
                onPress={() => executar(() => excluirPneu(p.id)).then(() => setRemovendo(null))}
              />
              <Botao titulo="Não" variante="link" compacto onPress={() => setRemovendo(null)} />
            </View>
          ) : (
            <Botao titulo="Remover" variante="link" compacto onPress={() => setRemovendo(p.id)} />
          )}
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
  const [km, setKm] = useState(mascararInteiro(String(Math.round(veiculo.km_atual))));
  const [litros, setLitros] = useState('');
  const [preco, setPreco] = useState('');
  const [data, setData] = useState(formatarData(hojeIso()));
  const [posto, setPosto] = useState('');
  const [cheio, setCheio] = useState<'sim' | 'nao'>('sim');
  const [mensagem, setMensagem] = useState<ConteudoMensagem | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const litrosLidos = lerDecimal(litros);
  const precoLido = lerDecimal(preco);
  const total = litrosLidos && precoLido ? totalAbastecimento(litrosLidos, precoLido) : null;

  async function registrar() {
    const kmLido = lerDecimal(km);
    const dataIso = lerData(data);
    const faltando = [
      !data.trim() && 'Data',
      !km.trim() && 'Km do odômetro',
      !litros.trim() && 'Litros',
      !preco.trim() && 'Preço por litro',
    ].filter((item): item is string => !!item);
    if (faltando.length > 0) return setMensagem({ titulo: 'Preencha os campos obrigatórios', itens: faltando });
    const invalido = (texto: string) => setMensagem({ titulo: 'Confira o abastecimento', texto });
    if (!dataIso) return invalido('Data inválida. Use dia/mês/ano.');
    if (kmLido === null || Number.isNaN(kmLido)) return invalido('Km do odômetro inválido.');
    if (!litrosLidos || Number.isNaN(litrosLidos)) return invalido('Litros inválidos. Exemplo: 350,5');
    if (!precoLido || Number.isNaN(precoLido)) return invalido('Preço por litro inválido. Exemplo: 5,899');
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
      setMensagem({ titulo: 'Não foi possível registrar', texto: mensagemDeErro(e) });
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
      <Mensagem mensagem={mensagem} aoFechar={() => setMensagem(null)} />
      {aberto ? (
        <View style={styles.formulario}>
          <LinhaForm minimo={160}>
            <CampoData
              rotulo="Data *"
              valor={data}
              onChange={setData}
            />
            <Campo
              rotulo="Km do odômetro *"
              value={km}
              onChangeText={(t) => setKm(mascararInteiro(t))}
              keyboardType="number-pad"
              inputMode="numeric"
            />
            <Campo
              rotulo="Litros *"
              value={litros}
              onChangeText={setLitros}
              keyboardType="numeric"
              inputMode="decimal"
              placeholder="Ex.: 350,5"
            />
            <Campo
              rotulo="Preço por litro (R$) *"
              value={preco}
              onChangeText={(t) => setPreco(mascararDecimal(t, 3))}
              keyboardType="numeric"
              inputMode="decimal"
              placeholder="Ex.: 5,899"
            />
          </LinhaForm>
          <LinhaForm minimo={200}>
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
            <View style={styles.total}>
              <Text style={styles.totalRotulo}>Total</Text>
              <Text style={styles.totalValor}>{total === null ? '—' : formatarMoeda(total)}</Text>
            </View>
          </LinhaForm>
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
    alignItems: 'center',
    gap: Espaco.md,
    paddingTop: Espaco.md,
    borderTopWidth: 1,
    borderTopColor: Cores.borda,
  },
  pneuNome: { flexGrow: 1, flexBasis: 180, gap: 2 },
  pneuTitulo: { fontSize: 15, fontWeight: '600', color: Cores.texto },
  pneuEstado: { flexGrow: 2, flexBasis: 300 },
  texto: { fontSize: 14, color: Cores.texto },
  // valor calculado: bloco de "resultado", nunca com cara de campo (spec, seção 2)
  total: { gap: 2, padding: Espaco.md, borderRadius: 8, backgroundColor: Cores.chipClaro },
  totalRotulo: { fontSize: 13, fontWeight: '600', color: Cores.primariaEscura },
  totalValor: { fontSize: 20, fontWeight: '700', color: Cores.primariaEscura },
});
