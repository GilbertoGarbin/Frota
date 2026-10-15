import { FunctionsHttpError } from '@supabase/supabase-js';
import { getRandomValues } from 'expo-crypto';

import { supabase } from '@/lib/supabase';
import { listarMotoristasAtivos, type Motorista } from '@/services/motoristas.service';

export type PapelUsuario = 'admin' | 'gestor' | 'motorista';

export type UsuarioEmpresa = {
  id: string;
  nome: string | null;
  papel: PapelUsuario;
  /** e-mail (admin e gestor) ou CPF (motorista) */
  login: string;
  motoristaId: string | null;
  ativo: boolean;
  primeiroAcesso: boolean;
  ultimoLogin: string | null;
};

export type TelaUsuarios = {
  usuarios: UsuarioEmpresa[];
  /** motoristas ativos que ainda não têm login com senha */
  motoristasSemAcesso: Motorista[];
};

// Criar login e redefinir senha precisam da service_role: passam pela Edge Function.
async function gerenciar(corpo: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.functions.invoke('gerenciar-usuario', { body: corpo });
  if (!error) return;
  if (error instanceof FunctionsHttpError) {
    const resposta = await error.context.json().catch(() => null);
    if (resposta?.error) throw new Error(resposta.error);
  }
  throw error;
}

export async function carregarTelaUsuarios(): Promise<TelaUsuarios> {
  const [lista, motoristas] = await Promise.all([supabase.rpc('usuarios_da_empresa'), listarMotoristasAtivos()]);
  if (lista.error) throw lista.error;
  const usuarios: UsuarioEmpresa[] = lista.data.map((u) => ({
    id: u.id,
    nome: u.nome,
    papel: u.papel as PapelUsuario,
    login: u.login,
    motoristaId: u.motorista_id,
    ativo: u.ativo,
    primeiroAcesso: u.primeiro_acesso,
    ultimoLogin: u.ultimo_login,
  }));
  const comLogin = new Set(usuarios.flatMap((u) => (u.motoristaId ? [u.motoristaId] : [])));
  return { usuarios, motoristasSemAcesso: motoristas.filter((m) => !comLogin.has(m.id)) };
}

export function criarGestor(nome: string, email: string, senha: string) {
  return gerenciar({ acao: 'criar_gestor', nome: nome.trim(), email: email.trim(), senha });
}

export function criarAcessoMotorista(motoristaId: string, senha: string) {
  return gerenciar({ acao: 'criar_motorista', motorista_id: motoristaId, senha });
}

/** Nova senha temporária: a pessoa é obrigada a trocar no próximo login. */
export function redefinirSenha(usuarioId: string, senha: string) {
  return gerenciar({ acao: 'resetar_senha', usuario_id: usuarioId, senha });
}

export async function definirAcesso(usuarioId: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.rpc('definir_acesso_usuario', { p_usuario_id: usuarioId, p_ativo: ativo });
  if (error) throw error;
}

/** Senha temporária fácil de ditar: 4 letras + 4 números (sem letras/números parecidos). */
export function gerarSenhaTemporaria(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const numeros = '23456789';
  const sorteio = getRandomValues(new Uint32Array(8));
  return Array.from(sorteio, (n, i) => (i < 4 ? letras[n % letras.length] : numeros[n % numeros.length])).join('');
}
