import { Campo } from '@/components/ui/campo';
import { CampoData } from '@/components/ui/campo-data';
import type { FormaPagamento } from '@/services/viagens.service';
import { lerData } from '@/utils/formato';

// Campos extras do pagamento direto ao posto, iguais no app do motorista e no painel:
// PIX pago pela empresa → chave PIX do posto; nota a prazo → vencimento.

type Props = {
  pagamento: FormaPagamento | null;
  chavePix: string;
  aoMudarChavePix: (valor: string) => void;
  vencimento: string;
  aoMudarVencimento: (valor: string) => void;
};

export function CamposPagamento({ pagamento, chavePix, aoMudarChavePix, vencimento, aoMudarVencimento }: Props) {
  if (pagamento === 'pix_empresa') {
    return (
      <Campo
        rotulo="Chave PIX do posto"
        ajuda="A empresa paga o posto por PIX. Copie a chave que o frentista passar."
        value={chavePix}
        onChangeText={aoMudarChavePix}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="CNPJ, telefone, e-mail ou chave aleatória"
      />
    );
  }
  if (pagamento === 'a_prazo') {
    return (
      <CampoData
        rotulo="Vencimento da nota"
        ajuda="Até quando a empresa precisa pagar o posto."
        valor={vencimento}
        onChange={aoMudarVencimento}
      />
    );
  }
  return null;
}

/**
 * Converte os campos extras para gravar. Devolve uma mensagem de erro (texto) quando o
 * vencimento foi digitado errado.
 */
export function dadosDoPagamento(
  pagamento: FormaPagamento,
  chavePix: string,
  vencimento: string,
): { chave_pix: string | null; vencimento: string | null } | string {
  const venc = pagamento === 'a_prazo' ? lerData(vencimento) : null;
  if (venc === undefined) return 'Vencimento inválido. Use dia/mês/ano.';
  return {
    chave_pix: pagamento === 'pix_empresa' ? chavePix.trim() || null : null,
    vencimento: venc ?? null,
  };
}
