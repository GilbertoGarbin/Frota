import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { soDigitos } from '@/utils/cpf';

export type Papel = 'gestor' | 'motorista';

export type Acesso = {
  papel: Papel;
  tenantId: string;
  tenantNome: string;
  nome: string | null;
  motoristaId: string | null;
};

const chaveAcesso = (usuarioId: string) => `frota.acesso.${usuarioId}`;

const MENSAGENS: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
  [/already registered|already been registered/i, 'Já existe uma conta com este e-mail.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 8 caracteres.'],
  [/unable to validate email|invalid email|email address .* is invalid/i, 'E-mail inválido.'],
  [/rate limit|too many requests/i, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'],
  [/anonymous sign-ins are disabled/i, 'A ativação de aparelhos está desligada no servidor.'],
  [/network|failed to fetch|fetch failed/i, 'Sem conexão. Verifique a internet e tente de novo.'],
];

// Mensagens do Supabase Auth vêm em inglês; as das nossas funções do banco já vêm em português.
export function mensagemDeErro(erro: unknown): string {
  const texto =
    erro && typeof erro === 'object' && 'message' in erro ? String(erro.message) : String(erro);
  for (const [padrao, mensagem] of MENSAGENS) {
    if (padrao.test(texto)) return mensagem;
  }
  return texto || 'Não foi possível concluir. Tente de novo.';
}

export async function entrar(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) throw error;
}

/** Devolve true se a conta já entrou; false se falta confirmar o e-mail. */
export async function cadastrar(nome: string, email: string, senha: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password: senha,
    options: { data: { nome: nome.trim() } },
  });
  if (error) throw error;
  return data.session !== null;
}

export async function sair(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) await AsyncStorage.removeItem(chaveAcesso(data.session.user.id));
  // 'local': funciona sem internet e não derruba outros aparelhos do mesmo gestor
  await supabase.auth.signOut({ scope: 'local' });
}

export async function criarTransportadora(nome: string, nomeUsuario: string): Promise<void> {
  const { error } = await supabase.rpc('criar_tenant', {
    p_nome: nome.trim(),
    p_nome_usuario: nomeUsuario.trim() || null,
  });
  if (error) throw error;
}

/**
 * Ativa este aparelho para o motorista. Abre uma sessão anônima (se ainda não houver)
 * e a vincula ao motorista quando CPF + código conferem. Devolve false se não conferem.
 */
export async function ativarAparelho(cpf: string, codigo: string): Promise<boolean> {
  const { data: atual } = await supabase.auth.getSession();
  if (!atual.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }
  const { data, error } = await supabase.rpc('ativar_aparelho', {
    p_cpf: soDigitos(cpf),
    p_codigo: soDigitos(codigo),
  });
  if (error) throw error;
  return data === true;
}

/**
 * Papel e transportadora do usuário logado; null = sem acesso (não criou a transportadora,
 * aparelho revogado, motorista inativo). Sem internet, usa o último acesso conhecido —
 * o motorista precisa abrir o app na estrada.
 */
export async function buscarAcesso(usuarioId: string): Promise<Acesso | null> {
  const { data, error } = await supabase.rpc('meu_acesso');

  if (error) {
    const salvo = await AsyncStorage.getItem(chaveAcesso(usuarioId));
    if (salvo) return JSON.parse(salvo) as Acesso;
    throw error;
  }

  const linha = (data as Record<string, string | null>[] | null)?.[0];
  if (!linha) {
    await AsyncStorage.removeItem(chaveAcesso(usuarioId));
    return null;
  }
  const acesso: Acesso = {
    papel: linha.papel as Papel,
    tenantId: linha.tenant_id!,
    tenantNome: linha.tenant_nome!,
    nome: linha.nome,
    motoristaId: linha.motorista_id,
  };
  await AsyncStorage.setItem(chaveAcesso(usuarioId), JSON.stringify(acesso));
  return acesso;
}
