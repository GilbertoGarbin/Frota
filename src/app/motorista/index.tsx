import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Cartao, EstadoSincronizacao, estilosMotorista as em, TelaMotorista } from '@/components/motorista/base';
import { Botao } from '@/components/ui/botao';
import { Selo } from '@/components/ui/selo';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useMotorista } from '@/context/MotoristaContext';
import { useSessao } from '@/context/SessaoContext';
import { resumoDoMes } from '@/services/motorista.service';
import { formatarData, formatarDecimal, formatarKm, formatarMoeda, mesAtual } from '@/utils/formato';

// 5.1 Início — decidir em segundos entre continuar uma viagem ou iniciar outra
export default function Inicio() {
  const router = useRouter();
  const { acesso } = useSessao();
  const { carregado, viagens, perfil, aoVivo } = useMotorista();

  if (!carregado) {
    return (
      <TelaMotorista>
        <ActivityIndicator color={Cores.primaria} />
      </TelaMotorista>
    );
  }

  const motorista = perfil.motorista;
  const veiculo = perfil.veiculos.find((v) => v.id === motorista?.veiculo_vinculado_id);
  const emAndamento = viagens.find((v) => v.status === 'em_andamento');
  const programadas = viagens
    .filter((v) => v.status === 'programada')
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
  const mes = resumoDoMes(viagens, mesAtual());
  const comissionado = motorista?.modelo_remuneracao === 'comissionado';
  const abrir = (id: string) => router.push({ pathname: '/motorista/viagem/[id]', params: { id } });

  return (
    <TelaMotorista>
      <View>
        <Text style={em.suave}>{acesso?.tenantNome}</Text>
        <Text style={styles.ola}>Olá, {(acesso?.nome ?? 'motorista').split(' ')[0]}</Text>
      </View>

      <EstadoSincronizacao />

      {/* Chip claro com texto escuro: o card verde sólido não passava no contraste (spec, seção 1) */}
      <Pressable accessibilityRole="link" onPress={() => router.navigate('/motorista/historico')} style={styles.chip}>
        <Text style={styles.chipTexto}>
          {comissionado
            ? `${formatarDecimal(motorista?.comissao_percentual ?? 0, 0)}% comissão · ${formatarMoeda(mes.comissao)} este mês`
            : `${mes.viagens.length} viagem(ns) · ${formatarKm(mes.km)} este mês`}
        </Text>
        <Text style={styles.chipTexto}>›</Text>
      </Pressable>

      {veiculo ? (
        <Text style={em.suave}>
          {veiculo.placa} · {veiculo.modelo} · {formatarKm(veiculo.km_atual)}
        </Text>
      ) : null}

      {emAndamento ? (
        <Cartao onPress={() => abrir(emAndamento.id)} rotuloAcessivel="Continuar viagem em andamento">
          <View style={em.linha}>
            <Selo tipo="aviso">Em andamento</Selo>
          </View>
          <Text style={em.titulo}>
            {emAndamento.origem} → {emAndamento.destino}
          </Text>
          <Text style={em.suave}>Frete {formatarMoeda(aoVivo(emAndamento).valor_frete_total)}</Text>
          <View style={styles.cta}>
            <Text style={styles.ctaTexto}>Continuar viagem ›</Text>
          </View>
        </Cartao>
      ) : null}

      {programadas.length > 0 ? <Text style={em.titulo}>Próximas viagens</Text> : null}
      {programadas.map((v) => {
        const veiculoDaViagem = perfil.veiculos.find((x) => x.id === v.veiculo_id);
        return (
          <Cartao key={v.id} onPress={() => abrir(v.id)} rotuloAcessivel={`Viagem ${v.origem} para ${v.destino}`}>
            <Text style={em.titulo}>
              {v.origem} → {v.destino}
            </Text>
            <Text style={em.suave}>
              {formatarData(v.data_prevista)}
              {veiculoDaViagem ? ` · ${veiculoDaViagem.placa}` : ''}
              {v.cliente ? ` · ${v.cliente}` : ''}
            </Text>
          </Cartao>
        );
      })}

      {!emAndamento && programadas.length === 0 ? (
        <Cartao>
          <Text style={em.titulo}>Nenhuma viagem programada</Text>
          <Text style={em.suave}>Quando o gestor programar uma viagem, ela aparece aqui.</Text>
          <Botao titulo="Iniciar viagem" onPress={() => router.push('/motorista/nova-viagem')} />
        </Cartao>
      ) : (
        <Botao titulo="+ Cadastrar nova viagem" variante="contorno" onPress={() => router.push('/motorista/nova-viagem')} />
      )}
    </TelaMotorista>
  );
}

const styles = StyleSheet.create({
  ola: { fontSize: 24, fontWeight: '700', color: Cores.texto },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.md,
    minHeight: 48,
    paddingHorizontal: Espaco.lg,
    borderRadius: Raio.md,
    backgroundColor: Cores.chipClaro,
  },
  chipTexto: { fontSize: 15, fontWeight: '600', color: Cores.primariaEscura },
  cta: { alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: Raio.sm, backgroundColor: Cores.primaria },
  ctaTexto: { fontSize: 16, fontWeight: '600', color: Cores.branco },
});
