import { FunctionsHttpError } from '@supabase/supabase-js';
import * as DocumentPicker from 'expo-document-picker';

import { lerArquivo } from '@/lib/arquivo';
import { supabase } from '@/lib/supabase';
import { TAMANHO_MAXIMO_BYTES } from '@/services/anexo.service';

// Leitura da nota fiscal do posto (PDF do DANFE ou XML da NF-e) pela Edge Function ler-nota.
// Mesmo formato de supabase/functions/ler-nota/nota.ts (a função fica fora do tsc do app).

export type CombustivelNota = 'diesel_s10' | 'diesel_s500' | 'arla32';

export type ItemNota = {
  descricao: string;
  combustivel: CombustivelNota | null;
  quantidade: number;
  /** valor pago pelo item, já com desconto */
  valor: number;
  precoUnitario: number;
};

export type NotaLida = {
  chave: string | null;
  emitente: string | null;
  data: string | null;
  total: number | null;
  placa: string | null;
  km: number | null;
  itens: ItemNota[];
};

const TIPOS_XML = ['text/xml', 'application/xml'];

function paraBase64(dados: ArrayBuffer): string {
  const bytes = new Uint8Array(dados);
  let binario = '';
  const pedaco = 0x8000;
  for (let i = 0; i < bytes.length; i += pedaco) {
    binario += String.fromCharCode(...bytes.subarray(i, i + pedaco));
  }
  return btoa(binario);
}

/**
 * Escolhe o PDF ou o XML da nota e lê. Devolve null se a pessoa cancelou. O arquivo só serve
 * para a leitura: guardar como comprovante é outro botão (Anexar arquivo), se a pessoa quiser.
 */
export async function lerNotaFiscal(): Promise<NotaLida | null> {
  const resultado = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', ...TIPOS_XML],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (resultado.canceled || !resultado.assets?.[0]) return null;
  const arquivo = resultado.assets[0];
  const ehXml = TIPOS_XML.includes(arquivo.mimeType ?? '') || /\.xml$/i.test(arquivo.name);
  const ehPdf = arquivo.mimeType === 'application/pdf' || /\.pdf$/i.test(arquivo.name);
  if (!ehXml && !ehPdf) throw new Error('Escolha o PDF ou o XML da nota fiscal.');
  if (arquivo.size && arquivo.size > TAMANHO_MAXIMO_BYTES) throw new Error('Arquivo maior que 10 MB.');

  const conteudo = paraBase64(await lerArquivo(arquivo.uri));
  const { data, error } = await supabase.functions.invoke<NotaLida>('ler-nota', {
    body: { tipo: ehXml ? 'xml' : 'pdf', conteudo },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const resposta = await error.context.json().catch(() => null);
      if (resposta?.error) throw new Error(resposta.error);
    }
    throw error;
  }
  if (!data || data.itens.length === 0) {
    throw new Error('Não encontramos os itens desta nota. Lance o abastecimento à mão.');
  }
  return data;
}

/** Itens de combustível, o diesel primeiro (é o abastecimento principal; Arla vem junto). */
export function combustiveisDaNota(nota: NotaLida): (ItemNota & { combustivel: CombustivelNota })[] {
  return nota.itens
    .filter((i): i is ItemNota & { combustivel: CombustivelNota } => i.combustivel !== null)
    .sort((a, b) => Number(a.combustivel === 'arla32') - Number(b.combustivel === 'arla32'));
}
