import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { CartaoResumo, Grade, Secao } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
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

// cor só do cartão de total (texto grande e em negrito, contraste suficiente)
const LARANJA = '#D97706';
// mesmas cores da viagem: azul entra, laranja sai, cinza zerado, verde/vermelho no resultado
const corDeSaida = (valor: number) => (valor > 0 ? LARANJA : Cores.textoSuave);

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

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
            <CartaoResumo rotulo="Faturamento bruto" cor={Cores.primaria} valor={formatarMoeda(dados.resumo.faturamento)} />
            <CartaoResumo
              rotulo="Custos operacionais"
              cor={corDeSaida(dados.resumo.custos_operacionais)}
              valor={formatarMoeda(dados.resumo.custos_operacionais)}
            />
            <CartaoResumo rotulo="Custos fixos" cor={corDeSaida(dados.resumo.custos_fixos)} valor={formatarMoeda(dados.resumo.custos_fixos)} />
            <CartaoResumo
              rotulo={dados.resumo.resultado >= 0 ? 'Resultado líquido (lucro)' : 'Resultado líquido (prejuízo)'}
              cor={dados.resumo.resultado >= 0 ? Cores.sucessoTexto : Cores.perigo}
              fundo={dados.resumo.resultado >= 0 ? Cores.sucessoFundo : Cores.perigoFundo}
              valor={formatarMoeda(dados.resumo.resultado)}
            />
          </Grade>

          <Secao
            titulo="Atenção necessária"
            acao={dados.alertas.length === 0 ? <Selo tipo="sucesso">Nenhum alerta no momento</Selo> : undefined}>
            {dados.alertas.map((a) => (
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
            ))}
          </Secao>

          <Secao titulo="Acesso rápido">
            <Grade>
              <Atalho
                icone="map-outline"
                rotulo="Viagens"
                valor={`${dados.contagens.viagensEmAndamento} em andamento`}
                detalhe={plural(dados.contagens.viagensProgramadas, 'programada', 'programadas')}
                onPress={() => router.navigate('/gestor/viagens')}
              />
              <Atalho
                icone="account-group-outline"
                rotulo="Motoristas"
                valor={plural(dados.contagens.motoristas, 'ativo', 'ativos')}
                onPress={() => router.navigate('/gestor/motoristas')}
              />
              <Atalho
                icone="truck-outline"
                rotulo="Veículos & Pneus"
                valor={plural(dados.contagens.veiculos, 'cadastrado', 'cadastrados')}
                onPress={() => router.navigate('/gestor/veiculos')}
              />
              <Atalho
                icone="hand-coin-outline"
                rotulo="Adiantamentos em aberto"
                valor={plural(dados.resumo.adiantamentos_abertos, 'viagem', 'viagens')}
                onPress={() => router.navigate({ pathname: '/gestor/viagens', params: { filtro: 'adiantamento' } })}
              />
              <Atalho
                icone="currency-usd"
                rotulo="Financeiro"
                valor="Fechamento do mês"
                onPress={() => router.navigate('/gestor/financeiro')}
              />
              <Atalho
                icone="archive-outline"
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

type PropsAtalho = {
  icone: keyof typeof MaterialCommunityIcons.glyphMap;
  rotulo: string;
  valor: string;
  detalhe?: string;
  onPress: () => void;
};

/** Cartão de acesso rápido: ícone, número e seta, sempre no mesmo azul para não poluir. */
function Atalho({ icone, rotulo, valor, detalhe, onPress }: PropsAtalho) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed, hovered }) => [styles.atalho, (pressed || hovered) && styles.atalhoSobre]}>
      <View style={styles.atalhoIcone}>
        <MaterialCommunityIcons name={icone} size={20} color={Cores.primaria} />
      </View>
      <View style={styles.atalhoTextos}>
        <Text style={styles.atalhoRotulo}>{rotulo}</Text>
        <Text style={styles.atalhoValor}>{valor}</Text>
        {detalhe ? <Text style={styles.atalhoRotulo}>{detalhe}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={Cores.textoSuave} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  atalho: {
    flexGrow: 1,
    flexBasis: 300,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    padding: Espaco.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  atalhoSobre: { borderColor: Cores.primaria, backgroundColor: Cores.chipClaro },
  atalhoIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Cores.chipClaro,
  },
  atalhoTextos: { flex: 1, minWidth: 0, gap: 1 },
  atalhoRotulo: { fontSize: 13, color: Cores.textoSuave },
  atalhoValor: { fontSize: 16, fontWeight: '700', color: Cores.texto },
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
