import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Cartao, estilosMotorista as em, TelaMotorista, ValorCalculado } from '@/components/motorista/base';
import { Selo } from '@/components/ui/selo';
import { SeletorMes } from '@/components/ui/seletor-mes';
import { useMotorista } from '@/context/MotoristaContext';
import { resumoDoMes } from '@/services/motorista.service';
import { deslocarMes, formatarData, formatarDataHora, formatarKm, formatarMoeda, mesAtual } from '@/utils/formato';

// 5.4 Viagens — todas as viagens do motorista: em andamento, próximas e finalizadas (por mês).
// A aba da barra inferior é o caminho para trocar de viagem sem voltar ao Início.
export default function Historico() {
  const router = useRouter();
  const { viagens, perfil, aoVivo } = useMotorista();
  const [mes, setMes] = useState(mesAtual);
  const comissionado = perfil.motorista?.modelo_remuneracao === 'comissionado';

  const atual = resumoDoMes(viagens, mes);
  const anterior = resumoDoMes(viagens, deslocarMes(mes, -1));
  // tendência: variação percentual entre dois totais já somados (só exibição)
  const tendencia =
    anterior.comissao > 0 ? Math.round(((atual.comissao - anterior.comissao) * 100) / anterior.comissao) : null;
  const abrir = (id: string) => router.push({ pathname: '/motorista/viagem/[id]', params: { id } });
  const placa = (id: string | null) => perfil.veiculos.find((v) => v.id === id)?.placa;
  const emAndamento = viagens.filter((v) => v.status === 'em_andamento');
  const programadas = viagens
    .filter((v) => v.status === 'programada')
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
  const finalizadas = [...atual.viagens].sort((a, b) => (b.data_hora_chegada ?? '').localeCompare(a.data_hora_chegada ?? ''));

  return (
    <TelaMotorista titulo="Viagens" subtitulo="Toque numa viagem para abrir.">
      {emAndamento.map((v) => (
        <Cartao key={v.id} onPress={() => abrir(v.id)} rotuloAcessivel={`Viagem em andamento ${v.origem} para ${v.destino}`}>
          <View style={em.linha}>
            <Selo tipo="aviso">Em andamento</Selo>
          </View>
          <Text style={em.titulo}>
            {v.origem} → {v.destino}
          </Text>
          <Text style={em.suave}>Frete {formatarMoeda(aoVivo(v).valor_frete_total)}</Text>
        </Cartao>
      ))}

      {programadas.length > 0 ? <Text style={em.titulo}>Próximas viagens</Text> : null}
      {programadas.map((v) => (
        <Cartao key={v.id} onPress={() => abrir(v.id)} rotuloAcessivel={`Viagem ${v.origem} para ${v.destino}`}>
          <Text style={em.titulo}>
            {v.origem} → {v.destino}
          </Text>
          <Text style={em.suave}>
            {formatarData(v.data_prevista)}
            {placa(v.veiculo_id) ? ` · ${placa(v.veiculo_id)}` : ''}
            {v.cliente ? ` · ${v.cliente}` : ''}
          </Text>
        </Cartao>
      ))}

      <Text style={em.titulo}>Finalizadas</Text>
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
          onPress={() => abrir(v.id)}>
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
