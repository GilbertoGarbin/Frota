const MENSAGENS: [RegExp, string][] = [
  // Supabase Auth (vem em inglês)
  [/invalid login credentials/i, 'Login ou senha incorretos.'],
  [/should be different from the old/i, 'A nova senha precisa ser diferente da temporária.'],
  [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
  [/already registered|already been registered/i, 'Já existe uma conta com este e-mail.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 8 caracteres.'],
  [/unable to validate email|invalid email|email address .* is invalid/i, 'E-mail inválido.'],
  [/rate limit|too many requests|for security purposes/i, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'],
  [/auth session missing|jwt expired|token has expired|invalid jwt/i, 'O link expirou. Peça um link novo em "Esqueci minha senha".'],
  [/network|failed to fetch|fetch failed/i, 'Sem conexão. Verifique a internet e tente de novo.'],
  // Restrições do banco
  [/motoristas_tenant_id_cpf_key/, 'Já existe um motorista com este CPF.'],
  [/usuarios_um_admin_por_tenant/, 'A transportadora já tem um admin.'],
  [/veiculos_tenant_id_placa_key/, 'Já existe um veículo com esta placa.'],
  [/complementos_complemento_descrito/, 'Descreva o complemento: de onde para onde e o que está levando.'],
  [/motoristas_um_ativo_por_veiculo/, 'Este caminhão já está vinculado a outro motorista ativo.'],
  [/motoristas_tenant_id_veiculo_vinculado_id_fkey/, 'Este veículo está vinculado a um motorista.'],
  [/violates foreign key constraint/i, 'Este registro está em uso e não pode ser alterado assim.'],
  [/row-level security/i, 'Você não tem permissão para fazer isso.'],
];

// As mensagens das nossas funções do banco (raise exception) já vêm em português e passam direto.
export function mensagemDeErro(erro: unknown): string {
  const texto =
    erro && typeof erro === 'object' && 'message' in erro ? String(erro.message) : String(erro);
  for (const [padrao, mensagem] of MENSAGENS) {
    if (padrao.test(texto)) return mensagem;
  }
  return texto || 'Não foi possível concluir. Tente de novo.';
}
