import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Grade, Indicador, Secao } from '@/components/ui/cartao';
import { SeletorMes } from '@/components/ui/seletor-mes';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';
import { useCarregar } from '@/hooks/use-carregar';
import {
  buscarAlertas,
  buscarContagens,
  buscarResumoFinanceiro,
  type Alerta,
} from '@/services/gestao.service';
import { formatarMoeda, mesAtual, periodoDoMes, rotuloMes } from '@/utils/formato';

const ROTA_DO_ALERTA: Record<Alerta['destino'], Href> = {
  motoristas: '/gestor/motoristas',
  manutencoes: '/gestor/manutencoes',
  pneus: '/gestor/veiculos',
};

// Tela 2 — Visão Geral: resultado do mês e alertas prioritários
export default function VisaoGeral() {
  const router = useRouter();
  const { acesso } = useSessao();
  const [mes, setMes] = useState(mesAtual);
  const { inicio, fim } = periodoDoMes(mes);
  const buscar = useCallback(
    async () => ({
      resumo: await buscarResumoFinanceiro(inicio, fim),
      alertas: await buscarAlertas(),
      contagens: await buscarContagens(),
    }),
    [inicio, fim],
  );
  const { dados, erro } = useCarregar(buscar);

  return (
    <Pagina
      titulo="Visão Geral"
      subtitulo={`Olá, ${acesso?.nome ?? 'gestor'}. Resultado de ${rotuloMes(mes)} e alertas.`}
      acao={<SeletorMes mes={mes} onChange={setMes} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {!dados ? (
        erro ? null : <ActivityIndicator color={Cores.primaria} />
      ) : (
        <>
          <Grade>
            <Indicador rotulo="Faturamento bruto" valor={formatarMoeda(dados.resumo.faturamento)} />
            <Indicador rotulo="Custos operacionais" valor={formatarMoeda(dados.resumo.custos_operacionais)} />
            <Indicador rotulo="Custos fixos" valor={formatarMoeda(dados.resumo.custos_fixos)} />
            <Indicador
              rotulo={dados.resumo.resultado >= 0 ? 'Resultado líquido (lucro)' : 'Resultado líquido (prejuízo)'}
              tom={dados.resumo.resultado >= 0 ? 'sucesso' : 'perigo'}
              valor={formatarMoeda(dados.resumo.resultado)}
            />
          </Grade>

          <Secao titulo="Atenção necessária">
            {dados.alertas.length === 0 ? (
              <Text style={styles.suave}>Nenhum alerta no momento.</Text>
            ) : (
              dados.alertas.map((a) => (
                <Pressable
                  key={`${a.destino}-${a.referencia_id}-${a.mensagem}`}
                  accessibilityRole="link"
                  onPress={() => router.navigate(ROTA_DO_ALERTA[a.destino])}
                  style={[styles.alerta, a.gravidade === 'perigo' && styles.alertaPerigo]}>
                  <Text style={[styles.alertaTexto, a.gravidade === 'perigo' && styles.alertaTextoPerigo]}>
                    {a.gravidade === 'perigo' ? '✕' : '⚠'} {a.mensagem}
                  </Text>
                  <Text style={[styles.alertaTexto, a.gravidade === 'perigo' && styles.alertaTextoPerigo]}>Ver ›</Text>
                </Pressable>
              ))
            )}
          </Secao>

          <Secao titulo="Acesso rápido">
            <Grade>
              <Indicador
                rotulo="Viagens"
                valor={`${dados.contagens.viagensEmAndamento} em andamento`}
                detalhe={`${dados.contagens.viagensProgramadas} programada(s)`}
                onPress={() => router.navigate('/gestor/viagens')}
              />
              <Indicador
                rotulo="Motoristas"
                valor={`${dados.contagens.motoristas} ativo(s)`}
                onPress={() => router.navigate('/gestor/motoristas')}
              />
              <Indicador
                rotulo="Veículos & Pneus"
                valor={`${dados.contagens.veiculos} cadastrado(s)`}
                onPress={() => router.navigate('/gestor/veiculos')}
              />
              <Indicador
                rotulo="Adiantamentos em aberto"
                valor={`${dados.resumo.adiantamentos_abertos} viagem(ns)`}
                onPress={() => router.navigate({ pathname: '/gestor/viagens', params: { filtro: 'adiantamento' } })}
              />
              <Indicador rotulo="Financeiro" valor="Fechamento do mês" onPress={() => router.navigate('/gestor/financeiro')} />
              <Indicador
                rotulo="Custos fixos"
                valor={`${formatarMoeda(dados.resumo.custos_fixos)} / mês`}
                onPress={() => router.navigate('/gestor/custos-fixos')}
              />
            </Grade>
          </Secao>
        </>
      )}
    </Pagina>
  );
}

const styles = StyleSheet.create({
  suave: { fontSize: 14, color: Cores.textoSuave },
  alerta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.md,
    padding: Espaco.md,
    borderRadius: Raio.sm,
    backgroundColor: Cores.avisoFundo,
  },
  alertaPerigo: { backgroundColor: Cores.perigoFundo },
  alertaTexto: { flexShrink: 1, fontSize: 14, color: Cores.avisoTexto },
  alertaTextoPerigo: { color: Cores.perigoTexto },
});
