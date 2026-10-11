import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Tela } from '@/components/ui/tela';
import { cadastrar, mensagemDeErro } from '@/services/auth.service';

const SENHA_MIN = 8;

export default function Cadastro() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aguardandoEmail, setAguardandoEmail] = useState(false);

  async function aoCadastrar() {
    if (senha.length < SENHA_MIN) {
      setErro(`A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const entrou = await cadastrar(nome, email, senha);
      // se já entrou, a navegação acontece sozinha (ver _layout)
      if (!entrou) {
        setAguardandoEmail(true);
        setEnviando(false);
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  if (aguardandoEmail) {
    return (
      <Tela titulo="Confirme seu e-mail">
        <Aviso tipo="sucesso">
          {`Enviamos um link de confirmação para ${email.trim()}. Abra o link e depois volte para entrar.`}
        </Aviso>
        <Botao titulo="Ir para o login" onPress={() => router.replace('/entrar')} />
      </Tela>
    );
  }

  return (
    <Tela titulo="Criar conta" subtitulo="Conta do gestor da transportadora.">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo rotulo="Seu nome" value={nome} onChangeText={setNome} autoComplete="name" />
      <Campo
        rotulo="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      <Campo
        rotulo="Senha"
        ajuda={`Mínimo de ${SENHA_MIN} caracteres.`}
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="new-password"
        onSubmitEditing={aoCadastrar}
      />
      <Botao
        titulo="Criar conta"
        onPress={aoCadastrar}
        carregando={enviando}
        desativado={!nome.trim() || !email.trim() || !senha}
      />
      <Botao titulo="Já tenho conta" variante="link" onPress={() => router.replace('/entrar')} />
    </Tela>
  );
}
