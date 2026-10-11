import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { armazem } from '@/db/armazem';
import { supabase } from '@/lib/supabase';
import { buscarAcesso, sair as sairDoSupabase, type Acesso } from '@/services/auth.service';
import { apagarPin } from '@/services/pin.service';

export type EstadoSessao =
  | 'carregando'
  | 'sem_conexao' // logado, mas sem internet e sem acesso salvo neste aparelho
  | 'deslogado'
  | 'ativacao' // aparelho de motorista ainda não ativado (ou revogado)
  | 'sem_transportadora' // gestor logado que ainda não cadastrou a transportadora
  | 'gestor'
  | 'motorista';

type Sessao = {
  estado: EstadoSessao;
  /** Sessão anônima = aparelho de motorista (ativado ou em ativação). */
  anonimo: boolean;
  acesso: Acesso | null;
  email: string | null;
  nomeCadastro: string | null;
  /** Relê papel/transportadora no servidor (depois de criar a transportadora ou ativar o aparelho). */
  recarregarAcesso: () => Promise<void>;
  sair: () => Promise<void>;
};

const SessaoContext = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const valor = use(SessaoContext);
  if (!valor) throw new Error('useSessao deve ser usado dentro de <SessaoProvider>');
  return valor;
}

// undefined = ainda não sabemos; null = sabemos que não há
type Talvez<T> = T | null | undefined;

type Consulta = { usuarioId: string; acesso: Acesso | null; semConexao: boolean };

async function consultarAcesso(usuarioId: string): Promise<Consulta> {
  try {
    return { usuarioId, acesso: await buscarAcesso(usuarioId), semConexao: false };
  } catch {
    return { usuarioId, acesso: null, semConexao: true };
  }
}

export function SessaoProvider({ children }: PropsWithChildren) {
  const [sessao, setSessao] = useState<Talvez<Session>>(undefined);
  // Resultado da última consulta de acesso, com o usuário a quem pertence: ao trocar de
  // usuário, o resultado antigo deixa de valer sozinho (nunca mostra o acesso de outro).
  const [consulta, setConsulta] = useState<Consulta | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    // Não chamar o Supabase aqui dentro (trava o cliente): só guardamos a sessão
    const { data } = supabase.auth.onAuthStateChange((_evento, nova) => setSessao(nova));
    return () => data.subscription.unsubscribe();
  }, []);

  const usuarioId = sessao?.user.id;

  useEffect(() => {
    if (!usuarioId) return;
    let vigente = true;
    consultarAcesso(usuarioId).then((resultado) => {
      if (vigente) setConsulta(resultado);
    });
    return () => {
      vigente = false;
    };
  }, [usuarioId]);

  const consultaAtual = consulta?.usuarioId === usuarioId ? consulta : null;
  const semConexao = consultaAtual?.semConexao === true;
  const acesso: Talvez<Acesso> = consultaAtual && !semConexao ? consultaAtual.acesso : undefined;

  const recarregarAcesso = useCallback(async () => {
    if (usuarioId) setConsulta(await consultarAcesso(usuarioId));
  }, [usuarioId]);

  const sair = useCallback(async () => {
    await apagarPin();
    await armazem.limpar(); // cópia local e fila do motorista não ficam para o próximo usuário do aparelho
    await sairDoSupabase();
  }, []);

  let estado: EstadoSessao;
  if (sessao === undefined) estado = 'carregando';
  else if (sessao === null) estado = 'deslogado';
  else if (acesso === undefined) estado = semConexao ? 'sem_conexao' : 'carregando';
  else if (acesso === null) estado = sessao.user.is_anonymous ? 'ativacao' : 'sem_transportadora';
  else estado = acesso.papel;

  const nomeCadastro = sessao?.user.user_metadata?.nome;

  return (
    <SessaoContext
      value={{
        estado,
        anonimo: sessao?.user.is_anonymous === true,
        acesso: acesso ?? null,
        email: sessao?.user.email ?? null,
        nomeCadastro: typeof nomeCadastro === 'string' ? nomeCadastro : null,
        recarregarAcesso,
        sair,
      }}>
      {children}
    </SessaoContext>
  );
}
