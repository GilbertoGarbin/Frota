import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { armazem } from '@/db/armazem';
import { supabase } from '@/lib/supabase';
import { buscarAcesso, buscarPlataforma, sair as sairDoSupabase, type Acesso } from '@/services/auth.service';
import { apagarPin } from '@/services/pin.service';

export type EstadoSessao =
  | 'carregando'
  | 'sem_conexao' // logado, mas sem internet e sem acesso salvo neste aparelho
  | 'deslogado'
  | 'sem_transportadora' // conta criada pelo site que ainda não cadastrou a transportadora
  | 'plataforma' // super admin (dono do sistema)
  | 'primeiro_acesso' // entrou com senha temporária: precisa trocar
  | 'assinatura_vencida' // transportadora com avaliação/assinatura vencida ou bloqueada
  | 'gestor' // admin ou gestor da transportadora (acesso.papel diz qual)
  | 'motorista';

type Sessao = {
  estado: EstadoSessao;
  acesso: Acesso | null;
  email: string | null;
  nomeCadastro: string | null;
  /** Relê papel/transportadora no servidor (depois de criar a transportadora ou trocar a senha). */
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

type Consulta = {
  usuarioId: string;
  acesso: Acesso | null;
  /** null = não é super admin */
  plataforma: { primeiroAcesso: boolean } | null;
  semConexao: boolean;
};

async function consultarAcesso(usuarioId: string): Promise<Consulta> {
  try {
    const acesso = await buscarAcesso(usuarioId);
    // Super admin não pertence a nenhuma transportadora
    const plataforma = acesso ? null : await buscarPlataforma();
    return { usuarioId, acesso, plataforma, semConexao: false };
  } catch {
    return { usuarioId, acesso: null, plataforma: null, semConexao: true };
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
  else if (acesso === null) {
    const plataforma = consultaAtual?.plataforma;
    if (plataforma) estado = plataforma.primeiroAcesso ? 'primeiro_acesso' : 'plataforma';
    // Aparelho ativado pelo código antigo (sessão anônima) e já sem acesso: entra com CPF e senha
    else if (sessao.user.is_anonymous) estado = 'deslogado';
    else estado = 'sem_transportadora';
  } else if (acesso.primeiroAcesso) estado = 'primeiro_acesso';
  else if (!acesso.assinatura.liberada) estado = 'assinatura_vencida';
  else estado = acesso.papel === 'motorista' ? 'motorista' : 'gestor';

  const nomeCadastro = sessao?.user.user_metadata?.nome;

  return (
    <SessaoContext
      value={{
        estado,
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
