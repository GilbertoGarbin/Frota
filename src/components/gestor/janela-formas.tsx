import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { FormFormaRecebimento } from '@/components/gestor/forma-recebimento';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Janela } from '@/components/ui/janela';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores, Espaco } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import {
  descreverParcelas,
  listarFormasRecebimento,
  type FormaRecebimento,
} from '@/services/formas-recebimento.service';

/**
 * Formas de recebimento (como os clientes pagam o frete), numa janela por cima de Receber.
 * Editar troca a lista pelo formulário; ao salvar ou cancelar, volta para a lista.
 */
export function JanelaFormas({ aoFechar }: { aoFechar: () => void }) {
  const { dados, erro, recarregar } = useCarregar(listarFormasRecebimento);
  // undefined = só a lista; null = nova forma; FormaRecebimento = editando
  const [editando, setEditando] = useState<FormaRecebimento | null | undefined>(undefined);

  if (editando !== undefined) {
    return (
      <FormFormaRecebimento
        forma={editando}
        aoFechar={(id) => {
          setEditando(undefined);
          if (id) recarregar();
        }}
      />
    );
  }

  const colunas: Coluna<FormaRecebimento>[] = [
    { titulo: 'Nome', flex: 1.5, celula: (f) => f.nome },
    { titulo: 'Parcelas', flex: 2.5, celula: (f) => descreverParcelas(f.parcelas) },
    {
      titulo: 'Situação',
      largura: 100,
      celula: (f) => (f.ativo ? <Selo tipo="sucesso">Ativa</Selo> : <Selo tipo="neutro">Inativa</Selo>),
    },
  ];

  return (
    <Janela
      visivel
      titulo="Formas de recebimento"
      subtitulo="Inativas não aparecem para escolher no cliente nem na viagem."
      aoFechar={aoFechar}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {dados ? (
        <Tabela
          aoTocar={setEditando}
          colunas={colunas}
          itens={dados}
          chave={(f) => f.id}
          vazio="Nenhuma forma de recebimento cadastrada ainda."
          larguraMinima={520}
        />
      ) : erro ? null : (
        <ActivityIndicator color={Cores.primaria} />
      )}
      <View style={styles.rodape}>
        <Botao titulo="+ Nova forma" compacto onPress={() => setEditando(null)} desativado={!dados} />
        <Botao titulo="Fechar" variante="link" compacto onPress={aoFechar} />
      </View>
    </Janela>
  );
}

const styles = StyleSheet.create({
  rodape: { flexDirection: 'row', alignItems: 'center', gap: Espaco.sm },
});
