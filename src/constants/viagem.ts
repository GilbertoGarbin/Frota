import { formatarKm } from '@/utils/formato';

// Regras da viagem usadas no app do motorista e no painel do gestor.

/** Acima disso, o km final provavelmente foi digitado errado (um dígito a mais, número repetido). */
export const KM_MAXIMO_POR_VIAGEM = 5000;

/**
 * Aviso quando o km rodado passa do limite. Não bloqueia: quem digitou confere e confirma
 * tocando em Finalizar de novo com o mesmo número.
 */
export function avisoKmRodado(kmInicial: number | null, kmFinal: number): string | null {
  if (kmInicial === null) return null;
  const rodado = kmFinal - kmInicial;
  if (rodado <= KM_MAXIMO_POR_VIAGEM) return null;
  return (
    `Pelo km final, esta viagem rodou ${formatarKm(rodado)}. Confira o número do odômetro. ` +
    'Se estiver certo, toque em finalizar de novo.'
  );
}
