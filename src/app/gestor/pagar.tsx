import { ListaContas, type ContaDaLista } from '@/components/gestor/lista-contas';
import { useCarregar } from '@/hooks/use-carregar';
import { listarPagamentos, marcarPagamento } from '@/services/financeiro.service';
import { ROTULO_PAGAMENTO, type FormaPagamento } from '@/services/viagens.service';

async function carregar(): Promise<ContaDaLista[]> {
  return (await listarPagamentos()).map((p) => ({
    id: p.id,
    descricao: p.descricao,
    detalhe: [p.favorecido, p.forma ? ROTULO_PAGAMENTO[p.forma as FormaPagamento] : null].filter(Boolean).join(' · ') || null,
    chavePix: p.chave_pix,
    valor: p.valor,
    vencimento: p.vencimento,
    quitadoEm: p.pago_em,
    viagem: p.viagem,
  }));
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
    />
  );
}
