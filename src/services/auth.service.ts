import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { soDigitos } from '@/utils/cpf';

export type Papel = 'admin' | 'gestor' | 'motorista';

export type StatusAssinatura = 'trial' | 'ativo' | 'inadimplente' | 'bloqueado' | 'cancelado' | 'vitalicio';

export type Assinatura = {
  status: StatusAssinatura;
  /** false = vencida ou bloqueada: o servidor já fechou o acesso aos dados */
  liberada: boolean;
  /** -1 = sem limite; 0 = vencida */
  diasRestantes: number;
  /** venceu, mas ainda está nos dias de tolerância */
  emCarencia: boolean;
  diasCarencia: number;
};

export type Acesso = {
  papel: Papel;
  tenantId: string;
  tenantNome: string;
  nome: string | null;
  motoristaId: string | null;
  /** entrou com senha temporária: precisa trocar antes de usar */
  primeiroAcesso: boolean;
  assinatura: Assinatura;
};

const chaveAcesso = (usuarioId: string) => `frota.acesso.${usuarioId}`;

// Motorista não tem e-mail: o login dele no Supabase Auth é "<cpf>@<este domínio>".
// Precisa ser igual ao da Edge Function supabase/functions/gerenciar-usuario.
export const DOMINIO_LOGIN_MOTORISTA = 'motorista.g2frota.vercel.app';
export const SENHA_MIN = 8;

/** E-mail (gestor e admin) ou CPF (motorista) → e-mail de login no Supabase Auth */
export function emailDoLogin(login: string): string | null {
  const texto = login.trim().toLowerCase();
  if (texto.includes('@')) return texto;
  const cpf = soDigitos(texto);
  return cpf.length === 11 ? `${cpf}@${DOMINIO_LOGIN_MOTORISTA}` : null;
}

export async function entrar(login: string, senha: string): Promise<void> {
  const email = emailDoLogin(login);
  if (!email) throw new Error('Digite seu e-mail ou o CPF com 11 números.');
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
}

/** Troca a senha temporária pela definitiva e libera o uso do sistema. */
export async function trocarSenha(nova: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) throw error;
  const { error: erroRpc } = await supabase.rpc('concluir_primeiro_acesso');
  if (erroRpc) throw erroRpc;
}

export async function souSuperadmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('sou_superadmin');
  if (error) throw error;
  return data === true;
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
    p_nome_usuario: nomeUsuario.trim() || undefined,
  });
  if (error) throw error;
}

/**
 * Papel, transportadora e assinatura do usuário logado; null = sem acesso (não criou a
 * transportadora, acesso desligado pelo admin, motorista inativo). Sem internet, usa o último
 * acesso conhecido — o motorista precisa abrir o app na estrada.
 */
export async function buscarAcesso(usuarioId: string): Promise<Acesso | null> {
  const { data, error } = await supabase.rpc('meu_acesso');

  if (error) {
    const salvo = await AsyncStorage.getItem(chaveAcesso(usuarioId));
    if (salvo) return lerAcessoSalvo(salvo);
    throw error;
  }

  const linha = data?.[0];
  if (!linha) {
    await AsyncStorage.removeItem(chaveAcesso(usuarioId));
    return null;
  }
  const acesso: Acesso = {
    papel: linha.papel as Papel,
    tenantId: linha.tenant_id,
    tenantNome: linha.tenant_nome,
    nome: linha.nome,
    motoristaId: linha.motorista_id,
    primeiroAcesso: linha.primeiro_acesso,
    assinatura: {
      status: linha.assinatura_status as StatusAssinatura,
      liberada: linha.assinatura_liberada,
      diasRestantes: linha.assinatura_dias_restantes,
      emCarencia: linha.assinatura_em_carencia,
      diasCarencia: linha.assinatura_dias_carencia,
    },
  };
  await AsyncStorage.setItem(chaveAcesso(usuarioId), JSON.stringify(acesso));
  return acesso;
}

// Acesso salvo por uma versão anterior do app (sem assinatura nem primeiro acesso)
function lerAcessoSalvo(texto: string): Acesso {
  const salvo = JSON.parse(texto) as Partial<Acesso> & Pick<Acesso, 'papel' | 'tenantId' | 'tenantNome'>;
  return {
    nome: null,
    motoristaId: null,
    ...salvo,
    primeiroAcesso: salvo.primeiroAcesso ?? false,
    assinatura: salvo.assinatura ?? {
      status: 'ativo',
      liberada: true,
      diasRestantes: -1,
      emCarencia: false,
      diasCarencia: 0,
    },
  };
}
