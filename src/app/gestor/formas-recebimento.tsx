import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { FormFormaRecebimento } from '@/components/gestor/forma-recebimento';
import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import {
  descreverParcelas,
  listarFormasRecebimento,
  type FormaRecebimento,
} from '@/services/formas-recebimento.service';

// Financeiro > Formas de recebimento: como os clientes pagam o frete (usadas no cliente e na viagem)
export default function FormasRecebimento() {
  const { dados, erro, recarregar } = useCarregar(listarFormasRecebimento);
  // undefined = só a lista; null = nova forma; FormaRecebimento = editando
  const [editando, setEditando] = useState<FormaRecebimento | null | undefined>(undefined);

  const colunas: Coluna<FormaRecebimento>[] = [
    { titulo: 'Nome', flex: 1.5, celula: (f) => f.nome },
    { titulo: 'Parcelas', flex: 2.5, celula: (f) => descreverParcelas(f.parcelas) },
    {
      titulo: 'Situação',
      celula: (f) => (f.ativo ? <Selo tipo="sucesso">Ativa</Selo> : <Selo tipo="neutro">Inativa</Selo>),
    },
  ];

  return (
    <Pagina
      titulo="Formas de recebimento"
      acao={<Botao titulo="+ Nova forma" compacto onPress={() => setEditando(null)} desativado={!dados} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {dados ? (
        <Tabela
          aoTocar={setEditando}
          colunas={colunas}
          itens={dados}
          chave={(f) => f.id}
          vazio="Nenhuma forma de recebimento cadastrada ainda."
          larguraMinima={760}
        />
      ) : erro ? null : (
        <ActivityIndicator color={Cores.primaria} />
      )}
      {editando !== undefined ? (
        <FormFormaRecebimento
          forma={editando}
          aoFechar={(id) => {
            setEditando(undefined);
            if (id) recarregar();
          }}
        />
      ) : null}
    </Pagina>
  );
}
