// Edge Function gerenciar-usuario — cria logins e redefine senhas (precisa da service_role,
// que nunca vai para o app). Deploy: npx supabase functions deploy gerenciar-usuario
//
// Ações (POST, JSON, com o token do usuário logado no Authorization):
//   { acao: 'criar_gestor', nome, email, senha }        — admin da transportadora
//   { acao: 'criar_motorista', motorista_id, senha }    — admin; o login é o CPF do cadastro
//   { acao: 'resetar_senha', usuario_id, senha }        — admin (da própria empresa) ou super admin
// Toda senha criada aqui é temporária: a pessoa troca no primeiro login (usuarios.primeiro_acesso).
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Motorista não tem e-mail: o login dele no Supabase Auth é "<cpf>@<este domínio>".
// Precisa ser igual a DOMINIO_LOGIN_MOTORISTA em src/services/auth.service.ts.
const DOMINIO_LOGIN_MOTORISTA = 'motorista.g2frota.vercel.app';
const SENHA_MIN = 8;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class Recusa extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Chamador = { id: string; superadmin: boolean; tenantId: string | null; ehAdmin: boolean };

async function identificar(req: Request): Promise<Chamador> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Recusa('Login necessário.', 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Recusa('Sessão inválida. Entre de novo.', 401);
  const id = data.user.id;

  const [{ data: plataforma }, { data: usuario }] = await Promise.all([
    admin.from('plataforma_admins').select('usuario_id').eq('usuario_id', id).maybeSingle(),
    admin.from('usuarios').select('tenant_id, papel, ativo').eq('id', id).maybeSingle(),
  ]);
  const ehAdmin = usuario?.papel === 'admin' && usuario.ativo === true;
  return { id, superadmin: !!plataforma, tenantId: ehAdmin ? usuario.tenant_id : null, ehAdmin };
}

function conferirSenha(senha: unknown): string {
  if (typeof senha !== 'string' || senha.length < SENHA_MIN) {
    throw new Recusa(`A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`);
  }
  return senha;
}

async function criarLogin(email: string, senha: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      throw new Recusa('Já existe um login com este e-mail ou CPF.');
    }
    throw new Recusa(error.message);
  }
  return data.user.id;
}

// Se a gravação em usuarios falhar, o login recém-criado não pode ficar solto
async function gravarOuDesfazer(usuarioId: string, linha: Record<string, unknown>) {
  const { error } = await admin.from('usuarios').insert({ id: usuarioId, primeiro_acesso: true, ...linha });
  if (error) {
    await admin.auth.admin.deleteUser(usuarioId);
    throw new Recusa(error.message);
  }
}

async function criarGestor(c: Chamador, corpo: Record<string, unknown>) {
  if (!c.ehAdmin || !c.tenantId) throw new Recusa('Apenas o admin da transportadora cadastra usuários.', 403);
  const nome = String(corpo.nome ?? '').trim();
  const email = String(corpo.email ?? '').trim().toLowerCase();
  if (!nome) throw new Recusa('Informe o nome.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Recusa('E-mail inválido.');
  if (email.endsWith(`@${DOMINIO_LOGIN_MOTORISTA}`)) throw new Recusa('E-mail inválido.');
  const senha = conferirSenha(corpo.senha);

  const id = await criarLogin(email, senha);
  await gravarOuDesfazer(id, { tenant_id: c.tenantId, papel: 'gestor', nome });
  return { usuario_id: id };
}

async function criarMotorista(c: Chamador, corpo: Record<string, unknown>) {
  if (!c.ehAdmin || !c.tenantId) throw new Recusa('Apenas o admin da transportadora cadastra usuários.', 403);
  const senha = conferirSenha(corpo.senha);
  const { data: motorista } = await admin
    .from('motoristas')
    .select('id, nome, cpf, status')
    .eq('id', String(corpo.motorista_id ?? ''))
    .eq('tenant_id', c.tenantId)
    .maybeSingle();
  if (!motorista) throw new Recusa('Motorista não encontrado.', 404);
  if (motorista.status !== 'ativo') throw new Recusa('Motorista inativo. Ative o cadastro antes de criar o acesso.');

  const id = await criarLogin(`${motorista.cpf}@${DOMINIO_LOGIN_MOTORISTA}`, senha);
  // Um acesso ativo por motorista: desliga o aparelho antigo (ativação por código)
  await admin.from('usuarios').update({ ativo: false }).eq('motorista_id', motorista.id).eq('ativo', true);
  await gravarOuDesfazer(id, {
    tenant_id: c.tenantId,
    papel: 'motorista',
    motorista_id: motorista.id,
    nome: motorista.nome,
  });
  return { usuario_id: id };
}

async function resetarSenha(c: Chamador, corpo: Record<string, unknown>) {
  const senha = conferirSenha(corpo.senha);
  const usuarioId = String(corpo.usuario_id ?? '');
  const { data: alvo } = await admin.from('usuarios').select('id, tenant_id').eq('id', usuarioId).maybeSingle();
  if (!alvo) throw new Recusa('Usuário não encontrado.', 404);
  const podeComoAdmin = c.ehAdmin && alvo.tenant_id === c.tenantId;
  if (!c.superadmin && !podeComoAdmin) throw new Recusa('Sem permissão para redefinir esta senha.', 403);

  const { error } = await admin.auth.admin.updateUserById(usuarioId, { password: senha });
  if (error) throw new Recusa(error.message);
  await admin.from('usuarios').update({ primeiro_acesso: true }).eq('id', usuarioId);
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ error: 'Use POST.' }, 405);

  try {
    const corpo = (await req.json()) as Record<string, unknown>;
    const chamador = await identificar(req);
    switch (corpo.acao) {
      case 'criar_gestor':
        return resposta(await criarGestor(chamador, corpo));
      case 'criar_motorista':
        return resposta(await criarMotorista(chamador, corpo));
      case 'resetar_senha':
        return resposta(await resetarSenha(chamador, corpo));
      default:
        throw new Recusa('Ação inválida.');
    }
  } catch (e) {
    if (e instanceof Recusa) return resposta({ error: e.message }, e.status);
    console.error(e);
    return resposta({ error: 'Erro interno. Tente de novo.' }, 500);
  }
});
