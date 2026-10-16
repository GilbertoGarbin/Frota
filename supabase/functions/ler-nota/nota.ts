// Leitura de nota fiscal de posto (NF-e/NFC-e) — só regras, sem dependências, para poder testar
// fora do Deno. Entrada: o texto do DANFE (PDF digital) ou o XML da nota.
// Saída: o que o abastecimento precisa; o que não for achado volta null e a pessoa completa.

export type Combustivel = 'diesel_s10' | 'diesel_s500' | 'arla32';

export type ItemNota = {
  descricao: string;
  /** null = item que não é combustível (lubrificante, filtro…) */
  combustivel: Combustivel | null;
  quantidade: number;
  /** valor pago pelo item, já com desconto */
  valor: number;
  /** valor ÷ quantidade, 4 casas (o desconto do posto entra aqui) */
  precoUnitario: number;
};

export type NotaLida = {
  chave: string | null;
  emitente: string | null;
  /** aaaa-mm-dd */
  data: string | null;
  total: number | null;
  placa: string | null;
  km: number | null;
  itens: ItemNota[];
};

// "2.830,88" → 2830.88; "420,0000" → 420
function numeroBr(texto: string): number {
  return Number(texto.replace(/\./g, '').replace(',', '.'));
}

const centavos = (v: number) => Math.round(v * 100);
const quatroCasas = (v: number) => Math.round(v * 10000) / 10000;

function classificar(descricao: string, ncm: string | null): Combustivel | null {
  const d = descricao.toUpperCase();
  if (/ARLA|UREIA|URÉIA/.test(d) || ncm === '31021010') return 'arla32';
  if (/DIESEL|S-?10\b|S-?500\b/.test(d) || ncm?.startsWith('271019')) {
    return /S-?500/.test(d) ? 'diesel_s500' : 'diesel_s10';
  }
  return null;
}

function item(descricao: string, ncm: string | null, quantidade: number, valor: number): ItemNota {
  return {
    descricao: descricao.replace(/\s+/g, ' ').trim(),
    combustivel: classificar(descricao, ncm),
    quantidade,
    valor,
    precoUnitario: quantidade > 0 ? quatroCasas(valor / quantidade) : 0,
  };
}

/** Placa e km que o posto escreve nas informações complementares ("PLACA: BDX9E10 KM: 912940"). */
function placaEKm(texto: string): Pick<NotaLida, 'placa' | 'km'> {
  const placa = /PLACA\s*[:=]?\s*([A-Z]{3})-?(\d[A-Z0-9]\d{2})\b/i.exec(texto);
  // "KM:" ou "HODOMETRO:" com dois-pontos — evita o "BR 116 KM 145" do endereço do posto
  const km = /\b(?:KM|HOD[OÔ]METRO|ODOMETRO|ODÔMETRO)\s*[:=]\s*([\d.]+(?:,\d+)?)/i.exec(texto);
  return {
    placa: placa ? `${placa[1]}${placa[2]}`.toUpperCase() : null,
    km: km ? numeroBr(km[1]) || null : null,
  };
}

/** ISO aaaa-mm-dd a partir de dd/mm/aaaa */
const isoDeBr = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;

// --- DANFE em PDF (texto extraído) ---------------------------------------------------

/**
 * Linha de produto do DANFE: NCM (8) CST (3) CFOP (4) UNID QTDE V.UNIT e depois os valores.
 * Conforme o layout vem "% desconto" ou "valor do desconto" antes do valor líquido, ou
 * direto o valor total; a conta quantidade × unitário decide qual é qual.
 */
const LINHA_PRODUTO =
  /(\d{8})\s+\d{3,4}\s+\d{4}\s+([A-Z]{1,3})\s+([\d.]+,\d+)\s+([\d.]+,\d+)\s+([\d.]+,\d+)(?:\s+([\d.]+,\d+))?/g;

function valorDoItem(quantidade: number, unitario: number, a: number, b: number | null): number {
  const bruto = quantidade * unitario;
  const perto = (x: number, y: number) => Math.abs(centavos(x) - centavos(y)) <= 2;
  if (b !== null) {
    if (perto(b, bruto * (1 - a / 100))) return b; // % desconto, valor líquido
    if (perto(b, bruto - a)) return b; // valor do desconto, valor líquido
  }
  if (perto(a, bruto)) return a; // sem coluna de desconto: valor total
  return Math.round(bruto * 100) / 100;
}

export function lerTextoDanfe(texto: string): NotaLida {
  const chave = /CHAVE DE ACESSO\s+((?:\d\s*){44})/i.exec(texto);
  const emitente =
    /Recebemos de\s+(.+?)\s+os produtos/i.exec(texto)?.[1] ?? /DANFE\s*([^\n]+)/i.exec(texto)?.[1] ?? null;
  const data =
    /DATA DA EMISS[ÃA]O\s+(\d{2}\/\d{2}\/\d{4})/i.exec(texto)?.[1] ??
    /Emiss[ãa]o:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(texto)?.[1] ??
    null;
  const total = /VALOR TOTAL DA NOTA\s+([\d.]+,\d{2})/i.exec(texto)?.[1] ?? /Valor Total:?\s*([\d.]+,\d{2})/i.exec(texto)?.[1];

  // Produtos: cada linha numérica; a descrição é o texto entre o produto anterior e esta linha
  const inicioProdutos = Math.max(0, texto.search(/DADOS DOS PRODUTOS/i));
  const corpo = texto.slice(inicioProdutos);
  const itens: ItemNota[] = [];
  let fimAnterior = corpo.search(/AL[ÍI]Q\.?\s*%/i);
  if (fimAnterior < 0) fimAnterior = 0;
  for (const m of corpo.matchAll(LINHA_PRODUTO)) {
    const [inteiro, ncm, , qtde, unit, a, b] = m;
    // primeira linha com texto: pula sobras numéricas da linha anterior e anotações do
    // sistema do posto (#DATA#…); tira o código interno do produto do começo
    const descricao = (
      corpo
        .slice(fimAnterior, m.index)
        .replace(/AL[ÍI]Q\.?\s*%/i, '')
        .replace(/#[^\n]*/g, '')
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l && !/^[\d.,%\s]+$/.test(l)) ?? ''
    ).replace(/^\d{3,}\s+/, '');
    const quantidade = numeroBr(qtde);
    itens.push(item(descricao, ncm, quantidade, valorDoItem(quantidade, numeroBr(unit), numeroBr(a), b ? numeroBr(b) : null)));
    fimAnterior = (m.index ?? 0) + inteiro.length;
  }

  return {
    chave: chave ? chave[1].replace(/\s/g, '') : null,
    emitente: emitente ? emitente.trim() : null,
    data: data ? isoDeBr(data) : null,
    total: total ? numeroBr(total) : null,
    ...placaEKm(texto),
    itens,
  };
}

// --- XML da NF-e / NFC-e -------------------------------------------------------------

const tag = (xml: string, nome: string) => new RegExp(`<${nome}>([^<]*)</${nome}>`).exec(xml)?.[1] ?? null;

export function lerXmlNota(xml: string): NotaLida {
  const chave = /Id="NFe(\d{44})"/.exec(xml)?.[1] ?? tag(xml, 'chNFe');
  const emit = /<emit>([\s\S]*?)<\/emit>/.exec(xml)?.[1] ?? '';
  const dhEmi = tag(xml, 'dhEmi') ?? tag(xml, 'dEmi');
  const total = tag(xml, 'vNF');
  const itens = [...xml.matchAll(/<det\b[^>]*>([\s\S]*?)<\/det>/g)].map(([, det]) => {
    const quantidade = Number(tag(det, 'qCom') ?? 0);
    const bruto = Number(tag(det, 'vProd') ?? 0);
    const desconto = Number(tag(det, 'vDesc') ?? 0);
    return item(tag(det, 'xProd') ?? '', tag(det, 'NCM'), quantidade, Math.round((bruto - desconto) * 100) / 100);
  });
  return {
    chave,
    emitente: tag(emit, 'xFant') ?? tag(emit, 'xNome'),
    data: dhEmi ? dhEmi.slice(0, 10) : null,
    total: total ? Number(total) : null,
    ...placaEKm(tag(xml, 'infCpl') ?? ''),
    itens,
  };
}
