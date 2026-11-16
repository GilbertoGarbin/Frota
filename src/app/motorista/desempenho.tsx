import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Cartao, estilosMotorista as em, TelaMotorista, ValorCalculado } from '@/components/motorista/base';
import { GraficoBarras } from '@/components/motorista/grafico-barras';
import { SeletorMes } from '@/components/ui/seletor-mes';
import { useMotorista } from '@/context/MotoristaContext';
import { resumoDoMes, type ViagemMotorista } from '@/services/motorista.service';
import { emCentavos, emReais } from '@/utils/dinheiro';
import {
  deslocarMes,
  formatarDataHora,
  formatarKm,
  formatarMoeda,
  mesAtual,
  rotuloMes,
  rotuloMesCurto,
  type Mes,
} from '@/utils/formato';

// Meu desempenho — relatório do motorista: resumo do mês com comparação, gráficos dos últimos 6 meses
// e as melhores viagens. Só o que ele já vê (frete, km, a própria comissão); lê as viagens do aparelho.
const MESES_NO_GRAFICO = 6;

const indiceMes = ({ ano, mes }: Mes) => ano * 12 + mes;

/** "▲ +12% vs. mês anterior" (só exibição) */
function comparacao(atual: number, anterior: number): string | undefined {
  if (anterior <= 0) return atual > 0 ? 'Mês anterior sem viagens' : undefined;
  const variacao = Math.round(((atual - anterior) * 100) / anterior);
  if (variacao === 0) return '= igual ao mês anterior';
  return `${variacao > 0 ? '▲ +' : '▼ '}${variacao}% vs. mês anterior`;
}

/** comissão média por viagem, em centavos inteiros */
const mediaPorViagem = (total: number, viagens: number) =>
  viagens > 0 ? emReais(Math.round(emCentavos(total) / viagens)) : 0;

const kmDa = (v: ViagemMotorista) => (v.km_final ?? 0) - (v.km_inicial ?? 0);

export default function Desempenho() {
  const router = useRouter();
  const { viagens, perfil } = useMotorista();
  const comissionado = perfil.motorista?.modelo_remuneracao === 'comissionado';
  const [mes, setMes] = useState(mesAtual);

  // Gráfico: os 6 meses até hoje; se o mês escolhido for mais antigo, os 6 meses até ele
  const hoje = mesAtual();
  const fim = indiceMes(hoje) - indiceMes(mes) < MESES_NO_GRAFICO ? hoje : mes;
  const meses = Array.from({ length: MESES_NO_GRAFICO }, (_, i) => deslocarMes(fim, i - (MESES_NO_GRAFICO - 1)));
  const resumos = meses.map((m) => resumoDoMes(viagens, m));
  const selecionada = meses.findIndex((m) => indiceMes(m) === indiceMes(mes));

  const atual = resumoDoMes(viagens, mes);
  const anterior = resumoDoMes(viagens, deslocarMes(mes, -1));

  const barrasValor = meses.map((m, i) => ({
    rotulo: rotuloMesCurto(m),
    rotuloCompleto: rotuloMes(m),
    valor: comissionado ? resumos[i].comissao : resumos[i].km,
    texto: comissionado ? formatarMoeda(resumos[i].comissao) : formatarKm(resumos[i].km),
  }));
  const barrasViagens = meses.map((m, i) => {
    const n = resumos[i].viagens.length;
    return { rotulo: rotuloMesCurto(m), rotuloCompleto: rotuloMes(m), valor: n, texto: `${n} viagem${n === 1 ? '' : 's'}` };
  });

  // Melhores viagens no período do gráfico: por comissão (ou km, para quem não é comissionado)
  const doPeriodo = resumos.flatMap((r) => r.viagens);
  const melhores = [...doPeriodo]
    .sort((a, b) => (comissionado ? (b.comissao_valor ?? 0) - (a.comissao_valor ?? 0) : kmDa(b) - kmDa(a)))
    .slice(0, 3);
  const periodo = `${rotuloMes(meses[0])} a ${rotuloMes(meses[MESES_NO_GRAFICO - 1])}`;
  const selecionarMes = (i: number) => setMes(meses[i]);

  return (
    <TelaMotorista titulo="Meu desempenho" subtitulo="Viagens finalizadas, mês a mês." aoVoltar={() => router.back()}>
      <View style={em.linha}>
        <SeletorMes mes={mes} onChange={setMes} />
      </View>

      <View style={em.grade}>
        <View style={em.metade}>
          <ValorCalculado
            rotulo="Viagens"
            valor={String(atual.viagens.length)}
            nota={comparacao(atual.viagens.length, anterior.viagens.length)}
          />
        </View>
        <View style={em.metade}>
          <ValorCalculado rotulo="Km rodados" valor={formatarKm(atual.km)} nota={comparacao(atual.km, anterior.km)} />
        </View>
        {comissionado ? (
          <>
            <View style={em.metade}>
              <ValorCalculado
                rotulo="Comissão"
                valor={formatarMoeda(atual.comissao)}
                nota={comparacao(atual.comissao, anterior.comissao)}
              />
            </View>
            <View style={em.metade}>
              <ValorCalculado
                rotulo="Média por viagem"
                valor={formatarMoeda(mediaPorViagem(atual.comissao, atual.viagens.length))}
                nota={comparacao(
                  mediaPorViagem(atual.comissao, atual.viagens.length),
                  mediaPorViagem(anterior.comissao, anterior.viagens.length),
                )}
              />
            </View>
          </>
        ) : (
          <View style={{ flexBasis: '100%' }}>
            <ValorCalculado
              rotulo="Km médio por viagem"
              valor={formatarKm(atual.viagens.length > 0 ? Math.round(atual.km / atual.viagens.length) : 0)}
            />
          </View>
        )}
      </View>

      <GraficoBarras
        titulo={comissionado ? 'Comissão por mês' : 'Km rodados por mês'}
        barras={barrasValor}
        selecionada={selecionada}
        aoTocar={selecionarMes}
      />
      <GraficoBarras titulo="Viagens por mês" barras={barrasViagens} selecionada={selecionada} aoTocar={selecionarMes} />
      <Text style={em.suave}>Toque numa barra para ver aquele mês.</Text>

      <Text style={em.titulo}>Melhores viagens</Text>
      <Text style={em.suave}>{`${comissionado ? 'Maior comissão' : 'Mais km'} de ${periodo}.`}</Text>
      {melhores.length === 0 ? <Text style={em.suave}>Nenhuma viagem finalizada nesse período.</Text> : null}
      {melhores.map((v, i) => (
        <Cartao
          key={v.id}
          rotuloAcessivel={`${i + 1}º lugar: ${v.origem} para ${v.destino}`}
          onPress={() => router.push({ pathname: '/motorista/viagem/[id]', params: { id: v.id } })}>
          <Text style={em.titulo}>
            {`${i + 1}º · ${v.origem} → ${v.destino}`}
          </Text>
          <Text style={em.suave}>
            {formatarDataHora(v.data_hora_chegada)} · {formatarKm(kmDa(v))}
          </Text>
          {comissionado ? <Text style={em.texto}>Comissão {formatarMoeda(v.comissao_valor)}</Text> : null}
        </Cartao>
      ))}
    </TelaMotorista>
  );
}
