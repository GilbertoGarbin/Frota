import * as Crypto from 'expo-crypto';

import type { TablesInsert } from '@/db/database.types';
import { apagarArquivo, lerArquivo } from '@/lib/arquivo';
import { supabase } from '@/lib/supabase';
import type { Anexo } from '@/services/anexo.service';
import type { Viagem } from '@/services/viagens.service';

// Lançamentos feitos pelo gestor dentro de uma viagem (qualquer status). Diferente do app do
// motorista, aqui não há fila offline: o painel grava direto e mostra o erro na hora.

export type TipoDocumento = 'canhoto' | 'cte' | 'nota_fiscal' | 'comprovante' | 'outro';

/** Envia o arquivo para {tenant}/{viagem}/{id}.{ext} e devolve o caminho. */
async function enviarArquivo(tenantId: string, viagemId: string, id: string, anexo: Anexo): Promise<string> {
  const caminho = `${tenantId}/${viagemId}/${id}.${anexo.extensao}`;
  const conteudo = await lerArquivo(anexo.uri);
  const { error } = await supabase.storage
    .from('comprovantes')
    .upload(caminho, conteudo, { contentType: anexo.tipoConteudo, upsert: false });
  if (error) throw error;
  await apagarArquivo(anexo.uri).catch(() => {});
  return caminho;
}

/** O comprovante anexado num lançamento também aparece na lista de Documentos da viagem. */
async function registrarComprovante(viagemId: string, caminho: string): Promise<void> {
  const { error } = await supabase.from('documentos').insert({ viagem_id: viagemId, tipo: 'comprovante', arquivo_path: caminho });
  if (error) throw error;
}

export type DadosAbastecimentoGestor = Pick<
  TablesInsert<'abastecimentos'>,
  'data' | 'km' | 'posto' | 'combustivel' | 'litros' | 'preco_litro' | 'tanque_cheio' | 'forma_pagamento' | 'chave_pix' | 'vencimento'
>;

export async function lancarAbastecimentoGestor(
  tenantId: string,
  viagem: Pick<Viagem, 'id' | 'veiculo_id'>,
  dados: DadosAbastecimentoGestor,
  anexo: Anexo | null,
): Promise<void> {
  const id = Crypto.randomUUID();
  const caminho = anexo ? await enviarArquivo(tenantId, viagem.id, id, anexo) : null;
  const { error } = await supabase
    .from('abastecimentos')
    .insert({ id, viagem_id: viagem.id, veiculo_id: viagem.veiculo_id, ...dados, comprovante_path: caminho });
  if (error) throw error;
  if (caminho) await registrarComprovante(viagem.id, caminho);
}

export type DadosDespesaGestor = Pick<
  TablesInsert<'despesas'>,
  'data' | 'categoria' | 'valor' | 'forma_pagamento' | 'local' | 'descricao' | 'chave_pix' | 'vencimento'
>;

export async function lancarDespesaGestor(
  tenantId: string,
  viagemId: string,
  dados: DadosDespesaGestor,
  anexo: Anexo | null,
): Promise<void> {
  const id = Crypto.randomUUID();
  const caminho = anexo ? await enviarArquivo(tenantId, viagemId, id, anexo) : null;
  const { error } = await supabase.from('despesas').insert({ id, viagem_id: viagemId, ...dados, comprovante_path: caminho });
  if (error) throw error;
  if (caminho) await registrarComprovante(viagemId, caminho);
}

export async function enviarDocumentoGestor(
  tenantId: string,
  viagemId: string,
  tipo: TipoDocumento,
  anexo: Anexo,
): Promise<void> {
  const id = Crypto.randomUUID();
  const caminho = await enviarArquivo(tenantId, viagemId, id, anexo);
  const { error } = await supabase.from('documentos').insert({ id, viagem_id: viagemId, tipo, arquivo_path: caminho });
  if (error) throw error;
}
