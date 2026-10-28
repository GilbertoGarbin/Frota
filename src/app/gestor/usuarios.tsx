import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Janela } from '@/components/ui/janela';
import { Seletor } from '@/components/ui/seletor';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';
import { useCarregar } from '@/hooks/use-carregar';
import { SENHA_MIN } from '@/services/auth.service';
import type { Motorista } from '@/services/motoristas.service';
import {
  carregarTelaUsuarios,
  criarAcessoMotorista,
  criarGestor,
  definirAcesso,
  gerarSenhaTemporaria,
  redefinirSenha,
  type UsuarioEmpresa,
} from '@/services/usuarios.service';
import { formatarCpf } from '@/utils/cpf';
import { mensagemDeErro } from '@/utils/erros';
import { formatarDataHora } from '@/utils/formato';

type Tela =
  | { tipo: 'lista' }
  | { tipo: 'gestor' }
  | { tipo: 'motorista' }
  | { tipo: 'senha'; usuario: UsuarioEmpresa }
  | { tipo: 'pronto'; titulo: string; login: string; senha: string };

const PAPEL: Record<UsuarioEmpresa['papel'], string> = { admin: 'Admin', gestor: 'Gestor', motorista: 'Motorista' };

const loginVisivel = (u: Pick<UsuarioEmpresa, 'papel' | 'login'>) =>
  u.papel === 'motorista' ? formatarCpf(u.login) : u.login;

// Só o admin da transportadora: cria gestores, dá acesso aos motoristas, redefine senhas.
export default function Usuarios() {
  const { acesso } = useSessao();
  const { dados, erro, recarregar } = useCarregar(carregarTelaUsuarios);
  const [tela, setTela] = useState<Tela>({ tipo: 'lista' });
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const voltar = () => setTela({ tipo: 'lista' });
  const concluir = (titulo: string, login: string, senha: string) => {
    recarregar();
    setTela({ tipo: 'pronto', titulo, login, senha });
  };

  if (acesso?.papel !== 'admin') {
    return (
      <Pagina titulo="Usuários">
        <Aviso tipo="info">Só o admin da transportadora gerencia usuários.</Aviso>
      </Pagina>
    );
  }

  // formulários e o resultado abrem numa janela por cima da lista
  let janela: ReactNode = null;
  if (tela.tipo === 'gestor') {
    janela = (
      <FormGestor
        aoCancelar={voltar}
        aoCriar={(nome, email, senha) => concluir(`${nome} já pode entrar`, email, senha)}
      />
    );
  } else if (tela.tipo === 'motorista' && dados) {
    janela = (
      <FormMotorista
        motoristas={dados.motoristasSemAcesso}
        aoCancelar={voltar}
        aoCriar={(m, senha) => concluir(`${m.nome} já pode entrar`, formatarCpf(m.cpf), senha)}
      />
    );
  } else if (tela.tipo === 'senha') {
    const u = tela.usuario;
    janela = (
      <FormSenha
        usuario={u}
        aoCancelar={voltar}
        aoRedefinir={(senha) => concluir(`Senha de ${u.nome ?? 'usuário'} redefinida`, loginVisivel(u), senha)}
      />
    );
  } else if (tela.tipo === 'pronto') {
    janela = (
      <Janela visivel titulo={tela.titulo} aoFechar={voltar}>
        <DadosDeAcesso login={tela.login} senha={tela.senha} />
        <Botao titulo="Fechar" onPress={voltar} />
      </Janela>
    );
  }

  async function alternar(u: UsuarioEmpresa) {
    setErroAcao(null);
    setOcupado(u.id);
    try {
      await definirAcesso(u.id, !u.ativo);
      recarregar();
    } catch (e) {
      setErroAcao(mensagemDeErro(e));
    }
    setOcupado(null);
  }

  const colunas: Coluna<UsuarioEmpresa>[] = [
    { titulo: 'Nome', flex: 1.6, celula: (u) => u.nome ?? '—' },
    {
      titulo: 'Papel',
      celula: (u) => <Selo tipo={u.papel === 'admin' ? 'info' : 'neutro'}>{PAPEL[u.papel]}</Selo>,
    },
    { titulo: 'Login', flex: 1.6, celula: loginVisivel },
    { titulo: 'Último acesso', flex: 1.2, celula: (u) => (u.ultimoLogin ? formatarDataHora(u.ultimoLogin) : 'Nunca entrou') },
    {
      titulo: 'Situação',
      celula: (u) =>
        !u.ativo ? (
          <Selo tipo="perigo">Desligado</Selo>
        ) : u.primeiroAcesso ? (
          <Selo tipo="aviso">Senha temporária</Selo>
        ) : (
          <Selo tipo="sucesso">Ativo</Selo>
        ),
    },
    {
      titulo: 'Ações',
      flex: 1.8,
      celula: (u) =>
        u.papel === 'admin' ? (
          <Text style={styles.suave}>Você</Text>
        ) : (
          <View style={styles.acoes}>
            <Botao
              titulo="Redefinir senha"
              variante="contorno"
              compacto
              onPress={() => setTela({ tipo: 'senha', usuario: u })}
            />
            <Botao
              titulo={u.ativo ? 'Desligar' : 'Religar'}
              variante="link"
              compacto
              carregando={ocupado === u.id}
              onPress={() => alternar(u)}
            />
          </View>
        ),
    },
  ];

  return (
    <Pagina
      titulo="Usuários"
      acao={
        <View style={styles.acoes}>
          <Botao titulo="+ Gestor" compacto onPress={() => setTela({ tipo: 'gestor' })} desativado={!dados} />
          <Botao
            titulo="+ Acesso de motorista"
            variante="contorno"
            compacto
            onPress={() => setTela({ tipo: 'motorista' })}
            desativado={!dados}
          />
        </View>
      }>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {erroAcao ? <Aviso tipo="erro">{erroAcao}</Aviso> : null}
      {dados ? (
        <>
          <Tabela
            colunas={colunas}
            itens={dados.usuarios}
            chave={(u) => u.id}
            vazio="Nenhum usuário."
            larguraMinima={980}
          />
          {dados.motoristasSemAcesso.length > 0 ? (
            <Aviso tipo="info">
              {`${dados.motoristasSemAcesso.length} motorista(s) ativo(s) ainda sem acesso ao app: ${dados.motoristasSemAcesso
                .map((m) => m.nome)
                .join(', ')}.`}
            </Aviso>
          ) : null}
        </>
      ) : erro ? null : (
        <ActivityIndicator color={Cores.primaria} />
      )}
      {janela}
    </Pagina>
  );
}

/** Login e senha temporária para passar à pessoa (só aparecem aqui). */
function DadosDeAcesso({ login, senha }: { login: string; senha: string }) {
  return (
    <View style={styles.caixa}>
      <Text style={styles.caixaRotulo}>Login</Text>
      <Text selectable style={styles.caixaValor}>
        {login}
      </Text>
      <Text style={styles.caixaRotulo}>Senha temporária</Text>
      <Text selectable style={[styles.caixaValor, styles.senha]}>
        {senha}
      </Text>
      <Text style={styles.suave}>
        Passe estes dados para a pessoa. No primeiro login ela cria a própria senha. A senha temporária não será
        mostrada de novo.
      </Text>
    </View>
  );
}

function CampoSenha({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  return (
    <View style={styles.senhaLinha}>
      <View style={styles.flex}>
        <Campo
          rotulo="Senha temporária"
          ajuda={`Sugestão gerada pelo sistema. Mínimo de ${SENHA_MIN} caracteres.`}
          value={valor}
          onChangeText={aoMudar}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <Botao titulo="Gerar outra" variante="link" compacto onPress={() => aoMudar(gerarSenhaTemporaria())} />
    </View>
  );
}

// Envia o formulário e mostra o erro sem fechar a tela
function useEnvio() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(acao: () => Promise<void>) {
    setErro(null);
    setEnviando(true);
    try {
      await acao();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }
  return { erro, setErro, enviando, enviar };
}

type PropsGestor = { aoCancelar: () => void; aoCriar: (nome: string, email: string, senha: string) => void };

function FormGestor({ aoCancelar, aoCriar }: PropsGestor) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState(gerarSenhaTemporaria);
  const { erro, setErro, enviando, enviar } = useEnvio();

  const aoSalvar = () => {
    if (senha.length < SENHA_MIN) return setErro(`A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`);
    return enviar(async () => {
      await criarGestor(nome, email, senha);
      aoCriar(nome.trim(), email.trim().toLowerCase(), senha);
    });
  };

  return (
    <Janela visivel titulo="Novo gestor" subtitulo="Usa o painel inteiro, mas não cadastra usuários." aoFechar={aoCancelar}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo rotulo="Nome" value={nome} onChangeText={setNome} autoComplete="name" />
      <Campo
        rotulo="E-mail"
        ajuda="É o login do gestor."
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      <CampoSenha valor={senha} aoMudar={setSenha} />
      <Botao titulo="Criar gestor" onPress={aoSalvar} carregando={enviando} desativado={!nome.trim() || !email.trim()} />
      <Botao titulo="Cancelar" variante="link" onPress={aoCancelar} />
    </Janela>
  );
}

type PropsMotorista = {
  motoristas: Motorista[];
  aoCancelar: () => void;
  aoCriar: (motorista: Motorista, senha: string) => void;
};

function FormMotorista({ motoristas, aoCancelar, aoCriar }: PropsMotorista) {
  const [motoristaId, setMotoristaId] = useState<string | null>(motoristas.length === 1 ? motoristas[0].id : null);
  const [senha, setSenha] = useState(gerarSenhaTemporaria);
  const { erro, setErro, enviando, enviar } = useEnvio();
  const escolhido = motoristas.find((m) => m.id === motoristaId);

  const aoSalvar = () => {
    if (!escolhido) return;
    if (senha.length < SENHA_MIN) return setErro(`A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`);
    return enviar(async () => {
      await criarAcessoMotorista(escolhido.id, senha);
      aoCriar(escolhido, senha);
    });
  };

  return (
    <Janela visivel titulo="Acesso de motorista" subtitulo="O motorista entra no app ou na web com o CPF." aoFechar={aoCancelar}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {motoristas.length === 0 ? (
        <Aviso tipo="info">
          Todos os motoristas ativos já têm acesso. Para um motorista novo, cadastre-o antes em Motoristas.
        </Aviso>
      ) : (
        <>
          <Seletor
            rotulo="Motorista"
            opcoes={motoristas.map((m) => ({ valor: m.id, rotulo: m.nome }))}
            valor={motoristaId}
            onChange={setMotoristaId}
          />
          {escolhido ? <Campo rotulo="Login (CPF)" value={formatarCpf(escolhido.cpf)} editable={false} /> : null}
          <CampoSenha valor={senha} aoMudar={setSenha} />
          <Botao titulo="Criar acesso" onPress={aoSalvar} carregando={enviando} desativado={!escolhido} />
        </>
      )}
      <Botao titulo="Cancelar" variante="link" onPress={aoCancelar} />
    </Janela>
  );
}

type PropsSenha = { usuario: UsuarioEmpresa; aoCancelar: () => void; aoRedefinir: (senha: string) => void };

function FormSenha({ usuario, aoCancelar, aoRedefinir }: PropsSenha) {
  const [senha, setSenha] = useState(gerarSenhaTemporaria);
  const { erro, setErro, enviando, enviar } = useEnvio();

  const aoSalvar = () => {
    if (senha.length < SENHA_MIN) return setErro(`A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`);
    return enviar(async () => {
      await redefinirSenha(usuario.id, senha);
      aoRedefinir(senha);
    });
  };

  return (
    <Janela
      visivel
      titulo="Redefinir senha"
      subtitulo={`${usuario.nome ?? ''} · ${loginVisivel(usuario)}. No próximo login, a pessoa cria uma senha nova.`}
      aoFechar={aoCancelar}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <CampoSenha valor={senha} aoMudar={setSenha} />
      <Botao titulo="Redefinir senha" onPress={aoSalvar} carregando={enviando} />
      <Botao titulo="Cancelar" variante="link" onPress={aoCancelar} />
    </Janela>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.sm },
  suave: { fontSize: 13, lineHeight: 19, color: Cores.textoSuave },
  senhaLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaco.sm },
  caixa: { gap: Espaco.xs, padding: Espaco.lg, borderRadius: Raio.md, backgroundColor: Cores.chipClaro },
  caixaRotulo: { fontSize: 13, fontWeight: '600', color: Cores.primariaEscura, marginTop: Espaco.sm },
  caixaValor: { fontSize: 20, fontWeight: '700', color: Cores.primariaEscura },
  senha: { letterSpacing: 2 },
});
