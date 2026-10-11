import * as SQLite from 'expo-sqlite';

import type { Armazem, ItemFila, Operacao } from '@/db/armazem.tipos';

// SQLite no aparelho (decisao_stack_infra.md §2.3). Duas tabelas:
//   docs — cópia local em JSON (viagens, lançamentos, perfil), por coleção
//   fila — operações a enviar, na ordem em que foram feitas

let conexao: Promise<SQLite.SQLiteDatabase> | null = null;

function abrir(): Promise<SQLite.SQLiteDatabase> {
  conexao ??= (async () => {
    const db = await SQLite.openDatabaseAsync('frota.db');
    await db.execAsync(`
      pragma journal_mode = wal;
      create table if not exists docs (
        colecao text not null,
        id text not null,
        json text not null,
        primary key (colecao, id)
      );
      create table if not exists fila (
        seq integer primary key autoincrement,
        operacao text not null,
        descricao text not null,
        registro_id text,
        criado_em text not null,
        erro text
      );
    `);
    return db;
  })();
  return conexao;
}

type LinhaFila = {
  seq: number;
  operacao: string;
  descricao: string;
  registro_id: string | null;
  criado_em: string;
  erro: string | null;
};

export const armazem: Armazem = {
  async ler<T>(colecao: string) {
    const db = await abrir();
    const linhas = await db.getAllAsync<{ json: string }>('select json from docs where colecao = ?', colecao);
    return linhas.map((l) => JSON.parse(l.json) as T);
  },

  async gravar(colecao, id, doc) {
    const db = await abrir();
    await db.runAsync(
      'insert into docs (colecao, id, json) values (?, ?, ?) on conflict (colecao, id) do update set json = excluded.json',
      colecao,
      id,
      JSON.stringify(doc),
    );
  },

  async remover(colecao, id) {
    const db = await abrir();
    await db.runAsync('delete from docs where colecao = ? and id = ?', colecao, id);
  },

  async substituir(colecao, docs) {
    const db = await abrir();
    await db.withTransactionAsync(async () => {
      await db.runAsync('delete from docs where colecao = ?', colecao);
      for (const { id, doc } of docs) {
        await db.runAsync('insert into docs (colecao, id, json) values (?, ?, ?)', colecao, id, JSON.stringify(doc));
      }
    });
  },

  async enfileirar(itens) {
    const db = await abrir();
    const criadoEm = new Date().toISOString();
    // tudo ou nada: um lançamento com foto vira 2–3 operações que precisam entrar juntas
    await db.withTransactionAsync(async () => {
      for (const { descricao, registroId, ...operacao } of itens) {
        await db.runAsync(
          'insert into fila (operacao, descricao, registro_id, criado_em) values (?, ?, ?, ?)',
          JSON.stringify(operacao),
          descricao,
          registroId,
          criadoEm,
        );
      }
    });
  },

  async fila() {
    const db = await abrir();
    const linhas = await db.getAllAsync<LinhaFila>('select * from fila order by seq');
    return linhas.map(
      (l): ItemFila => ({
        ...(JSON.parse(l.operacao) as Operacao),
        seq: l.seq,
        descricao: l.descricao,
        registroId: l.registro_id,
        criado_em: l.criado_em,
        erro: l.erro,
      }),
    );
  },

  async marcarErro(seq, erro) {
    const db = await abrir();
    await db.runAsync('update fila set erro = ? where seq = ?', erro, seq);
  },

  async removerDaFila(seq) {
    const db = await abrir();
    await db.runAsync('delete from fila where seq = ?', seq);
  },

  async limpar() {
    const db = await abrir();
    await db.execAsync('delete from docs; delete from fila;');
  },
};
