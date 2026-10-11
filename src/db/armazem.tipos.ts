// Armazenamento local do app do motorista: cópia do que ele precisa para trabalhar sem sinal
// e a fila de envio (outbox). No celular é SQLite (armazem.ts); na web, localStorage (armazem.web.ts).

export type TabelaLancamento = 'abastecimentos' | 'despesas' | 'paradas' | 'complementos' | 'documentos';

export type FuncaoViagem =
  | 'iniciar_viagem'
  | 'finalizar_viagem'
  | 'criar_viagem_motorista'
  | 'editar_viagem_motorista';

/** O que fazer no servidor. Toda operação é idempotente: reenviar não duplica. */
export type Operacao =
  | { op: 'inserir'; tabela: TabelaLancamento; linha: Record<string, unknown> }
  | { op: 'rpc'; funcao: FuncaoViagem; args: Record<string, unknown> }
  | { op: 'upload'; origem: string; destino: string; tipoConteudo: string };

export type ItemFila = Operacao & {
  /** ordem de envio (crescente) */
  seq: number;
  /** descrição curta para mostrar ao motorista ("Despesa de R$ 50,00") */
  descricao: string;
  /** id do registro local que este item cria, para poder descartar junto */
  registroId: string | null;
  criado_em: string;
  /** preenchido quando o servidor recusou; a fila para aqui até o motorista decidir */
  erro: string | null;
};

export type Armazem = {
  /** todos os documentos de uma coleção */
  ler<T>(colecao: string): Promise<T[]>;
  gravar(colecao: string, id: string, doc: unknown): Promise<void>;
  remover(colecao: string, id: string): Promise<void>;
  /** troca o conteúdo inteiro da coleção */
  substituir(colecao: string, docs: { id: string; doc: unknown }[]): Promise<void>;

  enfileirar(itens: (Operacao & { descricao: string; registroId: string | null })[]): Promise<void>;
  fila(): Promise<ItemFila[]>;
  marcarErro(seq: number, erro: string | null): Promise<void>;
  removerDaFila(seq: number): Promise<void>;

  /** apaga tudo (ao desvincular o aparelho) */
  limpar(): Promise<void>;
};
