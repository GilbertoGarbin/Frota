import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Cartao, estilosMotorista as em, TelaMotorista, ValorCalculado } from '@/components/motorista/base';
import { SeletorMes } from '@/components/ui/seletor-mes';
import { useMotorista } from '@/context/MotoristaContext';
import { resumoDoMes } from '@/services/motorista.service';
import { deslocarMes, formatarDataHora, formatarKm, formatarMoeda, mesAtual } from '@/utils/formato';

// 5.4 Histórico — só viagens finalizadas (ativas e programadas ficam no Início)
export default function Historico() {
  const router = useRouter();
  const { viagens, perfil } = useMotorista();
  const [mes, setMes] = useState(mesAtual);
  const comissionado = perfil.motorista?.modelo_remuneracao === 'comissionado';

  const atual = resumoDoMes(viagens, mes);
  const anterior = resumoDoMes(viagens, deslocarMes(mes, -1));
  // tendência: variação percentual entre dois totais já somados (só exibição)
  const tendencia =
    anterior.comissao > 0 ? Math.round(((atual.comissao - anterior.comissao) * 100) / anterior.comissao) : null;
  const finalizadas = [...atual.viagens].sort((a, b) => (b.data_hora_chegada ?? '').localeCompare(a.data_hora_chegada ?? ''));

  return (
    <TelaMotorista titulo="Viagens" subtitulo="Viagens finalizadas e resumo do mês.">
      <View style={em.linha}>
        <SeletorMes mes={mes} onChange={setMes} />
      </View>

      <View style={em.grade}>
        <View style={em.metade}>
          <ValorCalculado rotulo="Viagens no mês" valor={String(atual.viagens.length)} />
        </View>
        <View style={em.metade}>
          <ValorCalculado rotulo="Km rodados" valor={formatarKm(atual.km)} />
        </View>
        {comissionado ? (
          <View style={{ flexBasis: '100%' }}>
            <ValorCalculado
              rotulo="Comissão no mês"
              valor={formatarMoeda(atual.comissao)}
              nota={
                tendencia === null
                  ? undefined
                  : `${tendencia >= 0 ? '▲ +' : '▼ '}${tendencia}% em relação ao mês anterior`
              }
            />
          </View>
        ) : null}
      </View>

      {finalizadas.length === 0 ? <Text style={em.suave}>Nenhuma viagem finalizada neste mês.</Text> : null}
      {finalizadas.map((v) => (
        <Cartao
          key={v.id}
          rotuloAcessivel={`Viagem ${v.origem} para ${v.destino}`}
          onPress={() => router.push({ pathname: '/motorista/viagem/[id]', params: { id: v.id } })}>
          <Text style={em.titulo}>
            {v.origem} → {v.destino}
          </Text>
          <Text style={em.suave}>
            {formatarDataHora(v.data_hora_chegada)} · {formatarKm((v.km_final ?? 0) - (v.km_inicial ?? 0))}
          </Text>
          {comissionado ? <Text style={em.texto}>Comissão {formatarMoeda(v.comissao_valor)}</Text> : null}
        </Cartao>
      ))}
    </TelaMotorista>
  );
}
