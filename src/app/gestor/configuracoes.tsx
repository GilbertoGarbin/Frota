import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Secao } from '@/components/ui/cartao';
import { Segmentado } from '@/components/ui/segmentado';
import { Cores, Espaco } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { carregarConfiguracoes, salvarConfiguracoes } from '@/services/configuracoes.service';
import { mensagemDeErro } from '@/utils/erros';

const SIM_NAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
] as const;

// Configurações da transportadora — escolhas que valem para a conta toda (só o admin vê no menu)
export default function Configuracoes() {
  const { dados, erro } = useCarregar(carregarConfiguracoes);
  // o que a pessoa escolheu na tela; até mexer, vale o que está salvo
  const [escolha, setEscolha] = useState<boolean | null>(null);
  const exigeCanhoto = escolha ?? dados?.exigeCanhoto ?? null;
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);

  async function salvar() {
    if (exigeCanhoto === null) return;
    setSalvando(true);
    setAviso(null);
    try {
      await salvarConfiguracoes({ exigeCanhoto });
      setAviso({ tipo: 'sucesso', texto: 'Configurações salvas.' });
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemDeErro(e) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Pagina titulo="Configurações" subtitulo="Escolhas que valem para toda a transportadora" estreita>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {exigeCanhoto === null ? (
        erro ? null : <ActivityIndicator color={Cores.primaria} />
      ) : (
        <>
          <Secao titulo="Viagens">
            <Segmentado
              rotulo="Exigir canhoto para finalizar a viagem"
              opcoes={SIM_NAO}
              valor={exigeCanhoto ? 'sim' : 'nao'}
              onChange={(v) => setEscolha(v === 'sim')}
              ajuda="Vale para as viagens cadastradas daqui em diante. Em cada viagem dá para trocar só para ela. Quem faz mudança, por exemplo, costuma não ter canhoto."
            />
          </Secao>
          {aviso ? <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso> : null}
          <View style={{ flexDirection: 'row', gap: Espaco.md }}>
            <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
          </View>
        </>
      )}
    </Pagina>
  );
}
