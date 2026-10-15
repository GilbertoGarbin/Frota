import { supabase } from '@/lib/supabase';
import type { StatusAssinatura } from '@/services/auth.service';
import type { PapelUsuario } from '@/services/usuarios.service';

// Tela do super admin (dono do sistema): todas as transportadoras, usuários e assinatura.

export type Empresa = {
  id: string;
  nome: string;
  criadaEm: string;
  status: StatusAssinatura;
  trialExpiraEm: string | null;
  pagoAte: string | null;
  liberada: boolean;
  /** -1 = sem limite; 0 = vencida */
  diasRestantes: number;
  qtdUsuarios: number;
  qtdMotoristas: number;
  qtdVeiculos: number;
  adminId: string | null;
  adminNome: string | null;
  adminEmail: string | null;
  adminUltimoLogin: string | null;
};

export type UsuarioDaEmpresa = {
  id: string;
  nome: string | null;
  papel: PapelUsuario;
  login: string;
  ativo: boolean;
  primeiroAcesso: boolean;
  ultimoLogin: string | null;
};

export async function listarEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase.rpc('plataforma_empresas');
  if (error) throw error;
  return data.map((e) => ({
    id: e.tenant_id,
    nome: e.nome,
    criadaEm: e.criado_em,
    status: e.assinatura_status as StatusAssinatura,
    trialExpiraEm: e.trial_expira_em,
    pagoAte: e.pago_ate,
    liberada: e.assinatura_liberada,
    diasRestantes: e.assinatura_dias_restantes,
    qtdUsuarios: e.qtd_usuarios,
    qtdMotoristas: e.qtd_motoristas,
    qtdVeiculos: e.qtd_veiculos,
    adminId: e.admin_id,
    adminNome: e.admin_nome,
    adminEmail: e.admin_email,
    adminUltimoLogin: e.admin_ultimo_login,
  }));
}

export async function listarUsuariosDaEmpresa(tenantId: string): Promise<UsuarioDaEmpresa[]> {
  const { data, error } = await supabase.rpc('plataforma_usuarios', { p_tenant_id: tenantId });
  if (error) throw error;
  return data.map((u) => ({
    id: u.id,
    nome: u.nome,
    papel: u.papel as PapelUsuario,
    login: u.login,
    ativo: u.ativo,
    primeiroAcesso: u.primeiro_acesso,
    ultimoLogin: u.ultimo_login,
  }));
}

export async function ativarAssinatura(tenantId: string, dias: number): Promise<void> {
  const { error } = await supabase.rpc('plataforma_assinatura', { p_tenant_id: tenantId, p_acao: 'ativar', p_dias: dias });
  if (error) throw error;
}

export async function tornarVitalicia(tenantId: string): Promise<void> {
  const { error } = await supabase.rpc('plataforma_assinatura', { p_tenant_id: tenantId, p_acao: 'vitalicio' });
  if (error) throw error;
}

export async function bloquearEmpresa(tenantId: string): Promise<void> {
  const { error } = await supabase.rpc('plataforma_assinatura', { p_tenant_id: tenantId, p_acao: 'bloquear' });
  if (error) throw error;
}
