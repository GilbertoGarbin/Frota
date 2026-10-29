import { useState } from 'react';

import { JanelaFormas } from '@/components/gestor/janela-formas';
import { ListaContas, type ContaDaLista } from '@/components/gestor/lista-contas';
import { Botao } from '@/components/ui/botao';
import { useCarregar } from '@/hooks/use-carregar';
import { listarRecebimentos, marcarRecebido } from '@/services/financeiro.service';

async function carregar(): Promise<ContaDaLista[]> {
  return (await listarRecebimentos()).map((r) => ({
    id: r.id,
    descricao: r.descricao,
    detalhe: null,
    favorecido: null,
    chavePix: null,
    valor: r.valor,
    juros: r.juros,
    desconto: r.desconto,
    valorFinal: r.valor_final ?? r.valor,
    observacao: r.observacao,
    vencimento: r.vencimento,
    quitadoEm: r.recebido_em,
    viagem: r.viagem,
  }));
}

// Financeiro > Receber
export default function Receber() {
  const { dados, erro, recarregar } = useCarregar(carregar);
  const [formas, setFormas] = useState(false);
  return (
    <>
      <ListaContas
        tipo="receber"
        contas={dados}
        erro={erro}
        aoMarcar={async (id, quitar) => {
          await marcarRecebido(id, quitar);
          recarregar();
        }}
        aoEditar={recarregar}
        acaoExtra={<Botao titulo="Formas de recebimento" variante="contorno" compacto onPress={() => setFormas(true)} />}
      />
      {formas ? <JanelaFormas aoFechar={() => setFormas(false)} /> : null}
    </>
  );
}
