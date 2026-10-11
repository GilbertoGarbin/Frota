import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

// Arquivos locais do motorista (fotos e PDFs aguardando envio). Na web: arquivo.web.ts.

const pasta = () => {
  const dir = new Directory(Paths.document, 'pendentes');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

/**
 * Copia o arquivo (foto recém-tirada fica numa pasta temporária que o sistema pode limpar)
 * para a pasta permanente do app e devolve o novo endereço.
 */
export async function guardarArquivo(uri: string, extensao: string): Promise<string> {
  const destino = new File(pasta(), `${Crypto.randomUUID()}.${extensao}`);
  await new File(uri).copy(destino);
  return destino.uri;
}

export async function lerArquivo(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}

export async function apagarArquivo(uri: string): Promise<void> {
  const arquivo = new File(uri);
  if (arquivo.exists) arquivo.delete();
}
