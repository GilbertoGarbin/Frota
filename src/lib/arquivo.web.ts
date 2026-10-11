// Web (só desenvolvimento): o arquivo escolhido chega como blob: ou data:, que não sobrevive
// a recarregar a página. Guardamos como data URL para a fila conseguir enviar depois.

export async function guardarArquivo(uri: string, _extensao: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

export async function lerArquivo(uri: string): Promise<ArrayBuffer> {
  return (await fetch(uri)).arrayBuffer();
}

export async function apagarArquivo(_uri: string): Promise<void> {}
