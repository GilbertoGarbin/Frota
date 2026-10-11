import type { Armazem, ItemFila } from '@/db/armazem.tipos';

// Na web o expo-sqlite exigiria cabeçalhos especiais no servidor (e ainda é alfa).
// O app do motorista é Android; esta versão em localStorage existe para desenvolver e
// testar o mesmo fluxo no navegador. Mesmo contrato do armazem.ts.

const PREFIXO = 'frota.local.';
const CHAVE_FILA = `${PREFIXO}fila`;
const CHAVE_SEQ = `${PREFIXO}seq`;
const chaveColecao = (colecao: string) => `${PREFIXO}docs.${colecao}`;

function lerJson<T>(chave: string, padrao: T): T {
  const bruto = window.localStorage.getItem(chave);
  return bruto ? (JSON.parse(bruto) as T) : padrao;
}
const gravarJson = (chave: string, valor: unknown) => window.localStorage.setItem(chave, JSON.stringify(valor));

type Colecao = Record<string, unknown>;

export const armazem: Armazem = {
  async ler<T>(colecao: string) {
    return Object.values(lerJson<Colecao>(chaveColecao(colecao), {})) as T[];
  },

  async gravar(colecao, id, doc) {
    gravarJson(chaveColecao(colecao), { ...lerJson<Colecao>(chaveColecao(colecao), {}), [id]: doc });
  },

  async remover(colecao, id) {
    const { [id]: _removido, ...resto } = lerJson<Colecao>(chaveColecao(colecao), {});
    gravarJson(chaveColecao(colecao), resto);
  },

  async substituir(colecao, docs) {
    gravarJson(chaveColecao(colecao), Object.fromEntries(docs.map(({ id, doc }) => [id, doc])));
  },

  async enfileirar(itens) {
    const fila = lerJson<ItemFila[]>(CHAVE_FILA, []);
    let seq = lerJson<number>(CHAVE_SEQ, 0);
    const criado_em = new Date().toISOString();
    for (const item of itens) fila.push({ ...item, seq: ++seq, criado_em, erro: null });
    gravarJson(CHAVE_FILA, fila);
    gravarJson(CHAVE_SEQ, seq);
  },

  async fila() {
    return lerJson<ItemFila[]>(CHAVE_FILA, []);
  },

  async marcarErro(seq, erro) {
    gravarJson(
      CHAVE_FILA,
      lerJson<ItemFila[]>(CHAVE_FILA, []).map((i) => (i.seq === seq ? { ...i, erro } : i)),
    );
  },

  async removerDaFila(seq) {
    gravarJson(
      CHAVE_FILA,
      lerJson<ItemFila[]>(CHAVE_FILA, []).filter((i) => i.seq !== seq),
    );
  },

  async limpar() {
    for (const chave of Object.keys(window.localStorage)) {
      if (chave.startsWith(PREFIXO)) window.localStorage.removeItem(chave);
    }
  },
};
