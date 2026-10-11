// Aritmética de dinheiro no app, sempre em centavos inteiros (nunca ponto flutuante).
// Use só para exibição imediata (ex.: total do formulário, saldo enquanto está sem sinal);
// o valor que vale é o que o banco calcula.

export const emCentavos = (reais: number): number => Math.round(reais * 100);
export const emReais = (centavos: number): number => centavos / 100;

export function somar(valores: (number | null | undefined)[]): number {
  return emReais(valores.reduce<number>((total, v) => total + emCentavos(v ?? 0), 0));
}

/** litros × preço por litro, arredondado para centavos (igual à coluna "total" do banco) */
export function totalAbastecimento(litros: number, precoLitro: number): number {
  // milésimos de litro × milésimos de real = milionésimos de real
  const milionesimos = Math.round(litros * 1000) * Math.round(precoLitro * 1000);
  return emReais(Math.round(milionesimos / 10_000));
}

/** percentual de um valor, arredondado para centavos (igual à comissão do banco) */
export function percentualDe(valor: number, percentual: number): number {
  // centavos × centésimos de ponto percentual
  return emReais(Math.round((emCentavos(valor) * Math.round(percentual * 100)) / 10_000));
}
