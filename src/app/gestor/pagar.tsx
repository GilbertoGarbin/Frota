import { contaDePagamento, ListaContas, type ContaDaLista } from '@/components/gestor/lista-contas';
import { useCarregar } from '@/hooks/use-carregar';
import { listarPagamentos, marcarPagamento } from '@/services/financeiro.service';

async function carregar(): Promise<ContaDaLista[]> {
  return (await listarPagamentos()).map(contaDePagamento);
}

// Financeiro > Pagar
export default function Pagar() {
  const { dados, erro, recarregar } = useCarregar(carregar);
  return (
    <ListaContas
      tipo="pagar"
      contas={dados}
      erro={erro}
      aoMarcar={async (id, quitar) => {
        await marcarPagamento(id, quitar);
        recarregar();
      }}
      aoEditar={recarregar}
    />
  );
}
