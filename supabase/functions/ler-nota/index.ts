// Edge Function ler-nota — lê a nota fiscal do posto (PDF do DANFE ou XML da NF-e/NFC-e) e
// devolve os dados para preencher o abastecimento. Não grava nada: quem confere e salva é a
// pessoa, no app ou no painel. Deploy: npx supabase functions deploy ler-nota
//
// POST, JSON, com o token do usuário logado no Authorization:
//   { tipo: 'pdf' | 'xml', conteudo: <base64 do arquivo> }
// Resposta: NotaLida (ver nota.ts) ou { error }.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extractText } from 'npm:unpdf@1';

import { lerTextoDanfe, lerXmlNota } from './nota.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function base64ParaBytes(texto: string): Uint8Array {
  const binario = atob(texto.replace(/^data:[^,]*,/, ''));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ error: 'Use POST.' }, 405);

  // só quem está logado no Frota (motorista ou gestor) usa a leitura
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const { data: usuario } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
  if (!usuario?.user) return resposta({ error: 'Sessão inválida. Entre de novo.' }, 401);

  let corpo: { tipo?: string; conteudo?: string };
  try {
    corpo = await req.json();
  } catch {
    return resposta({ error: 'Envio inválido.' }, 400);
  }
  if (!corpo.conteudo || (corpo.tipo !== 'pdf' && corpo.tipo !== 'xml')) {
    return resposta({ error: 'Envie o PDF ou o XML da nota.' }, 400);
  }

  try {
    const bytes = base64ParaBytes(corpo.conteudo);
    if (bytes.length > TAMANHO_MAXIMO) return resposta({ error: 'Arquivo maior que 10 MB.' }, 400);
    if (corpo.tipo === 'xml') {
      return resposta(lerXmlNota(new TextDecoder().decode(bytes)));
    }
    const { text } = await extractText(bytes, { mergePages: true });
    const texto = Array.isArray(text) ? text.join('\n') : text;
    if (!texto.trim()) {
      // PDF escaneado (é uma imagem): não tem texto para ler
      return resposta({ error: 'Este PDF é uma foto da nota, sem texto. Lance à mão ou use o XML da nota.' }, 422);
    }
    return resposta(lerTextoDanfe(texto));
  } catch (e) {
    console.error(e);
    return resposta({ error: 'Não foi possível ler este arquivo. Confira se é o PDF ou o XML da nota.' }, 422);
  }
});
