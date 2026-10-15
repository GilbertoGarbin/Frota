import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Tela } from '@/components/ui/tela';
import { enviarLinkDeSenha } from '@/services/auth.service';
import { soDigitos } from '@/utils/cpf';
import { mensagemDeErro } from '@/utils/erros';

// Gestor e admin recebem um link por e-mail. Motorista não tem e-mail: quem cria a senha nova
// é o admin da transportadora (Gestor > Usuários > Redefinir senha).
export default function EsqueciSenha() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<'email' | 'motorista' | null>(null);

  async function aoEnviar() {
    const texto = login.trim();
    if (!texto) return;
    setErro(null);
    if (!texto.includes('@')) {
      if (soDigitos(texto).length === 11) return setResultado('motorista');
      return setErro('Digite seu e-mail ou o CPF com 11 números.');
    }
    setEnviando(true);
    try {
      await enviarLinkDeSenha(texto);
      setResultado('email');
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
    setEnviando(false);
  }

  const voltar = <Botao titulo="Voltar para o login" variante="link" onPress={() => router.replace('/entrar')} />;

  if (resultado === 'email') {
    return (
      <Tela titulo="Confira seu e-mail">
        <Aviso tipo="sucesso">
          {`Se ${login.trim()} tiver conta no Frota, enviamos um link para criar uma senha nova. Abra o e-mail e toque no link. Se não aparecer, olhe também no spam.`}
        </Aviso>
        {voltar}
      </Tela>
    );
  }

  if (resultado === 'motorista') {
    return (
      <Tela titulo="Senha do motorista">
        <Aviso tipo="info">
          Peça ao responsável da transportadora para criar uma senha nova para você. Ele faz isso no painel, em
          Usuários. Depois entre com o seu CPF e a senha que ele passar.
        </Aviso>
        {voltar}
      </Tela>
    );
  }

  return (
    <Tela titulo="Esqueci minha senha" subtitulo="Digite o e-mail ou o CPF que você usa para entrar.">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo
        rotulo="E-mail ou CPF"
        value={login}
        onChangeText={setLogin}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        keyboardType="email-address"
        onSubmitEditing={aoEnviar}
      />
      <Botao titulo="Continuar" onPress={aoEnviar} carregando={enviando} desativado={!login.trim()} />
      {voltar}
    </Tela>
  );
}
