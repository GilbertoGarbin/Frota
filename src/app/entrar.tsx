import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Tela } from '@/components/ui/tela';
import { entrar } from '@/services/auth.service';
import { mensagemDeErro } from '@/utils/erros';

// Login único: o sistema descobre pelo cadastro se é admin, gestor ou motorista (ver SessaoContext).
export default function Entrar() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEntrar() {
    if (!login.trim() || !senha) return;
    setErro(null);
    setEnviando(true);
    try {
      await entrar(login, senha);
      // a navegação acontece sozinha quando a sessão muda (ver _layout)
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Tela titulo="Entrar">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo
        rotulo="E-mail ou CPF"
        ajuda="Motorista: use o CPF e a senha que a transportadora passou."
        value={login}
        onChangeText={setLogin}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        keyboardType="email-address"
      />
      <Campo
        rotulo="Senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={aoEntrar}
      />
      <Botao titulo="Entrar" onPress={aoEntrar} carregando={enviando} desativado={!login.trim() || !senha} />
      <Botao titulo="Esqueci minha senha" variante="link" compacto onPress={() => router.push('/esqueci-senha')} />
      <Botao
        titulo="Cadastrar minha transportadora"
        variante="link"
        onPress={() => router.push('/cadastro')}
      />
    </Tela>
  );
}
