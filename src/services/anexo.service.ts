import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { guardarArquivo } from '@/lib/arquivo';

/** Arquivo pronto para entrar na fila de envio */
export type Anexo = { uri: string; extensao: string; tipoConteudo: string; nome: string };

// Fotos são reduzidas no aparelho para ~300 KB antes de entrar na fila (decisao_stack_infra §2.3)
const LARGURA_MAXIMA = 1280;
const QUALIDADE = 0.6;
export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024; // limite do bucket

async function prepararFoto(uri: string): Promise<Anexo> {
  try {
    return await reduzirFoto(uri);
  } catch (e) {
    // na web, imagem que o navegador não abre (ex.: HEIC do iPhone) chega aqui sem mensagem
    if (e instanceof Error) throw e;
    throw new Error('Não foi possível abrir esta imagem. Use uma foto JPG, PNG ou WEBP.');
  }
}

async function reduzirFoto(uri: string): Promise<Anexo> {
  // renderiza uma vez para conhecer o tamanho real; só reduz (nunca amplia).
  // Só a largura é informada: a altura acompanha a proporção (passar height: null quebra na web).
  let imagem = await ImageManipulator.manipulate(uri).renderAsync();
  if (imagem.width > LARGURA_MAXIMA) {
    imagem = await ImageManipulator.manipulate(uri).resize({ width: LARGURA_MAXIMA }).renderAsync();
  }
  const reduzida = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: QUALIDADE });
  return {
    uri: await guardarArquivo(reduzida.uri, 'jpg'),
    extensao: 'jpg',
    tipoConteudo: 'image/jpeg',
    nome: 'foto.jpg',
  };
}

/** Abre a câmera. Devolve null se o motorista cancelou; lança erro se a permissão foi negada. */
export async function tirarFoto(): Promise<Anexo | null> {
  const permissao = await ImagePicker.requestCameraPermissionsAsync();
  if (!permissao.granted) {
    throw new Error('Sem permissão para usar a câmera. Libere a câmera para o Frota nos ajustes do celular.');
  }
  const resultado = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 });
  if (resultado.canceled || !resultado.assets?.[0]) return null;
  return prepararFoto(resultado.assets[0].uri);
}

const EXTENSAO_POR_TIPO: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Escolhe um arquivo já existente (JPG, PNG, WEBP ou PDF, até 10 MB). */
export async function anexarArquivo(): Promise<Anexo | null> {
  const resultado = await DocumentPicker.getDocumentAsync({
    type: Object.keys(EXTENSAO_POR_TIPO),
    copyToCacheDirectory: true,
    multiple: false,
    base64: false,
  });
  if (resultado.canceled || !resultado.assets?.[0]) return null;
  const arquivo = resultado.assets[0];
  const tipo = arquivo.mimeType ?? '';
  const extensao = EXTENSAO_POR_TIPO[tipo];
  if (!extensao) throw new Error('Formato não aceito. Use JPG, PNG, WEBP ou PDF.');
  if (arquivo.size && arquivo.size > TAMANHO_MAXIMO_BYTES) throw new Error('Arquivo maior que 10 MB.');

  // imagens passam pela mesma redução das fotos; PDF vai como está
  if (tipo !== 'application/pdf') return prepararFoto(arquivo.uri);
  return { uri: await guardarArquivo(arquivo.uri, extensao), extensao, tipoConteudo: tipo, nome: arquivo.name };
}
