import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Tela } from '@/components/ui/tela';
import { lerLinkDeSenha, redefinirSenhaPeloLink, SENHA_MIN } from '@/services/auth.service';
import { mensagemDeErro } from '@/utils/erros';

// Aberta pelo link do e-mail de "Esqueci minha senha" (só na web). Fica fora dos grupos de
// sessão no _layout: precisa abrir mesmo com outra conta logada neste navegador.
export default function RedefinirSenha() {
  const router = useRouter();
  const [link] = useState(() => (Platform.OS === 'web' ? lerLinkDeSenha(window.location.hash) : null));
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const pedirOutro = (
    <Botao titulo="Pedir um link novo" variante="contorno" onPress={() => router.replace('/esqueci-senha')} />
  );

  if (!link || 'erro' in link) {
    return (
      <Tela titulo="Criar senha nova">
        <Aviso tipo="erro">{link ? link.erro : 'Abra esta página pelo link que enviamos para o seu e-mail.'}</Aviso>
        {pedirOutro}
        <Botao titulo="Voltar para o login" variante="link" onPress={() => router.replace('/')} />
      </Tela>
    );
  }
  const valido = link;

  async function aoSalvar() {
    if (senha.length < SENHA_MIN) return setErro(`A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`);
    if (senha !== confirmacao) return setErro('As duas senhas não são iguais.');
    setErro(null);
    setEnviando(true);
    try {
      await redefinirSenhaPeloLink(valido, senha);
      // já entrou com a senha nova: a porta de entrada leva para a tela certa
      router.replace('/');
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Tela titulo="Criar senha nova" subtitulo="Escolha a senha que você vai usar para entrar no Frota.">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo
        rotulo="Nova senha"
        ajuda={`Mínimo de ${SENHA_MIN} caracteres.`}
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="new-password"
      />
      <Campo
        rotulo="Repita a nova senha"
        value={confirmacao}
        onChangeText={setConfirmacao}
        secureTextEntry
        autoComplete="new-password"
        onSubmitEditing={aoSalvar}
      />
      <Botao titulo="Salvar senha" onPress={aoSalvar} carregando={enviando} desativado={!senha || !confirmacao} />
    </Tela>
  );
}
