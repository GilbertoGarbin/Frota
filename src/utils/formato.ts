import { soDigitos } from '@/utils/cpf';

// Entrada e exibição no padrão brasileiro. Nada aqui faz conta com dinheiro:
// cálculo financeiro é do banco (numeric), o app só lê e mostra.

/** "1.234,56" → 1234.56. Devolve null para vazio e NaN para texto inválido. */
export function lerDecimal(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, '').replace(',', '.');
  if (!limpo) return null;
  return /^\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : NaN;
}

export function formatarDecimal(valor: number | null | undefined, casas = 2): string {
  if (valor === null || valor === undefined) return '';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/**
 * Máscara de digitação de valores e porcentagens, como em caixa eletrônico: os números entram
 * pela direita e as casas decimais ficam sempre fixas. "1" → "0,01"; "1400" → "14,00";
 * "123456" → "1.234,56". Vazio continua vazio (campo opcional).
 */
export function mascararDecimal(texto: string, casas = 2): string {
  const digitos = soDigitos(texto).replace(/^0+/, '').slice(0, 13);
  if (!digitos) return '';
  const cheio = digitos.padStart(casas + 1, '0');
  const inteiro = cheio.slice(0, -casas).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiro},${cheio.slice(-casas)}`;
}

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarPercentual(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined) return '—';
  return `${formatarDecimal(valor, casas)}%`;
}

// --- Meses (seletor de período) -------------------------------------------------
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export type Mes = { ano: number; mes: number }; // mes: 1 a 12

const dois = (n: number) => String(n).padStart(2, '0');

export function mesAtual(): Mes {
  const hoje = new Date();
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
}

export function deslocarMes({ ano, mes }: Mes, delta: number): Mes {
  const indice = ano * 12 + (mes - 1) + delta;
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

export function rotuloMes({ ano, mes }: Mes): string {
  return `${MESES[mes - 1]} ${ano}`;
}

/** Primeiro e último dia do mês, em ISO */
export function periodoDoMes({ ano, mes }: Mes): { inicio: string; fim: string } {
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { inicio: `${ano}-${dois(mes)}-01`, fim: `${ano}-${dois(mes)}-${dois(ultimoDia)}` };
}

/** Hoje, no fuso do aparelho, em ISO (aaaa-mm-dd) */
export function hojeIso(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${dois(hoje.getMonth() + 1)}-${dois(hoje.getDate())}`;
}

/** Data e hora de um timestamp do servidor, no fuso do aparelho: "31/12/2026 14:30" */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

export function formatarKm(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

/** Máscara de digitação dd/mm/aaaa */
export function mascararData(texto: string): string {
  const d = soDigitos(texto).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "31/12/2027" → "2027-12-31". null para vazio; undefined para data inválida. */
export function lerData(texto: string): string | null | undefined {
  if (!texto.trim()) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return undefined;
  const [, dia, mes, ano] = m;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  const confere =
    data.getUTCFullYear() === Number(ano) &&
    data.getUTCMonth() === Number(mes) - 1 &&
    data.getUTCDate() === Number(dia);
  return confere ? `${ano}-${mes}-${dia}` : undefined;
}

/** "2027-12-31" → "31/12/2027" */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Dias de hoje até a data ISO (negativo = já passou) */
export function diasAte(iso: string): number {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  const hoje = new Date();
  const inicioHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((Date.UTC(ano, mes - 1, dia) - inicioHoje) / 86_400_000);
}

export function formatarTelefone(texto: string): string {
  const d = soDigitos(texto).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
