import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { TelaMotorista } from '@/components/motorista/base';
import { ConfirmarViagem, ViagemEmAndamento, ViagemFinalizada } from '@/components/motorista/viagem-telas';
import { Aviso } from '@/components/ui/aviso';
import { Cores } from '@/constants/tema';
import { useMotorista } from '@/context/MotoristaContext';

// Uma viagem, na tela do estado em que ela está: confirmar → em andamento → finalizada
export default function Viagem() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { carregado, viagens } = useMotorista();
  const viagem = viagens.find((v) => v.id === id);

  if (!viagem) {
    return (
      <TelaMotorista titulo="Viagem" aoVoltar={() => router.back()}>
        {carregado ? <Aviso tipo="info">Viagem não encontrada neste aparelho.</Aviso> : <ActivityIndicator color={Cores.primaria} />}
      </TelaMotorista>
    );
  }
  if (viagem.status === 'programada') return <ConfirmarViagem viagem={viagem} />;
  if (viagem.status === 'em_andamento') return <ViagemEmAndamento viagem={viagem} />;
  return <ViagemFinalizada viagem={viagem} />;
}
